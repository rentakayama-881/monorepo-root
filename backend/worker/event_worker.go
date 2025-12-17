package worker

import (
	"context"
	"errors"
	"log"
	"math/big"
	"strings"
	"time"

	"backend-gin/config"
	"backend-gin/database"
	"backend-gin/models"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"gorm.io/gorm"
)

const (
	cursorName   = "escrow_sync"
	pollInterval = 15 * time.Second
	maxRange     = uint64(5000)
)

var (
	factoryABI                 abi.ABI
	factoryEscrowDeployedTopic common.Hash
	escrowEventTopics          map[common.Hash]string
)

func init() {
	var err error
	factoryABI, err = abi.JSON(strings.NewReader(`[
        {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"orderId","type":"bytes32"},{"indexed":false,"internalType":"address","name":"escrow","type":"address"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"amountUSDT","type":"uint256"}],"name":"EscrowDeployed","type":"event"}
    ]`))
	if err != nil {
		log.Fatalf("worker: gagal parse ABI factory: %v", err)
	}
	factoryEscrowDeployedTopic = factoryABI.Events["EscrowDeployed"].ID

	escrowEventTopics = map[common.Hash]string{
		crypto.Keccak256Hash([]byte("Funded(address,uint256)")):      models.OrderStatusFunded,
		crypto.Keccak256Hash([]byte("Delivered(bytes)")):             models.OrderStatusDelivered,
		crypto.Keccak256Hash([]byte("DisputeOpened(address,bytes)")): models.OrderStatusDisputed,
		crypto.Keccak256Hash([]byte("Resolved(bytes)")):              models.OrderStatusResolved,
		crypto.Keccak256Hash([]byte("Refunded(uint256)")):            models.OrderStatusRefunded,
		crypto.Keccak256Hash([]byte("Released(uint256,uint256)")):    models.OrderStatusReleased,
	}
}

// StartEventWorker menjalankan sinkronisasi event on-chain secara periodik.
func StartEventWorker(ctx context.Context) {
	if config.RPCURL == "" {
		return
	}

	go func() {
		client, err := ethclient.DialContext(ctx, config.RPCURL)
		if err != nil {
			log.Printf("worker: gagal koneksi RPC (%s): %v", config.RPCURL, err)
			return
		}
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		for {
			syncOnce(ctx, client)
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func syncOnce(ctx context.Context, client *ethclient.Client) {
	cursor, err := loadCursor()
	if err != nil {
		log.Printf("worker: gagal membaca cursor: %v", err)
		return
	}

	latest, err := client.BlockNumber(ctx)
	if err != nil {
		log.Printf("worker: gagal mengambil block terbaru: %v", err)
		return
	}

	if cursor.LastProcessed == 0 {
		cursor.LastProcessed = latest
		_ = saveCursor(cursor)
		return
	}

	from := cursor.LastProcessed + 1
	if from > latest {
		return
	}

	to := latest
	if span := to - from; span > maxRange {
		to = from + maxRange
	}

	addresses := collectAddresses()
	if len(addresses) == 0 {
		cursor.LastProcessed = to
		_ = saveCursor(cursor)
		return
	}

	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(from)),
		ToBlock:   big.NewInt(int64(to)),
		Addresses: addresses,
	}

	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		log.Printf("worker: gagal menarik log: %v", err)
		return
	}

	for _, lg := range logs {
		if strings.EqualFold(lg.Address.Hex(), config.EscrowFactoryAddress.Hex()) {
			handleFactoryLog(lg)
			continue
		}
		handleEscrowLog(lg)
	}

	cursor.LastProcessed = to
	_ = saveCursor(cursor)
}

func handleFactoryLog(lg types.Log) {
	if len(lg.Topics) == 0 || lg.Topics[0] != factoryEscrowDeployedTopic {
		return
	}

	if len(lg.Topics) < 4 {
		log.Printf("worker: log EscrowDeployed tidak lengkap pada blok %d", lg.BlockNumber)
		return
	}

	var ev struct {
		Escrow     common.Address
		Buyer      common.Address
		Seller     common.Address
		AmountUSDT *big.Int
	}

	if err := factoryABI.UnpackIntoInterface(&ev, "EscrowDeployed", lg.Data); err != nil {
		log.Printf("worker: gagal unpack EscrowDeployed: %v", err)
		return
	}

	orderID := strings.ToLower(lg.Topics[1].Hex())
	buyer := strings.ToLower(common.HexToAddress(lg.Topics[2].Hex()).Hex())
	seller := strings.ToLower(common.HexToAddress(lg.Topics[3].Hex()).Hex())
	escrowAddr := strings.ToLower(ev.Escrow.Hex())
	txHash := strings.ToLower(lg.TxHash.Hex())

	var order models.Order
	if err := database.DB.Where("order_id_hex = ?", orderID).First(&order).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("worker: gagal memuat order %s: %v", orderID, err)
		}
		return
	}

	order.EscrowAddress = escrowAddr
	order.TxHash = txHash
	order.Status = models.OrderStatusDeployed
	if order.BuyerWallet == "" {
		order.BuyerWallet = buyer
	}
	if order.SellerWallet == "" {
		order.SellerWallet = seller
	}

	if err := database.DB.Save(&order).Error; err != nil {
		log.Printf("worker: gagal menyimpan order %s: %v", orderID, err)
	}
}

func handleEscrowLog(lg types.Log) {
	status, ok := escrowEventTopics[lg.Topics[0]]
	if !ok {
		return
	}

	escrowAddr := strings.ToLower(lg.Address.Hex())

	var order models.Order
	if err := database.DB.Where("escrow_address = ?", escrowAddr).First(&order).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("worker: gagal menemukan order untuk escrow %s: %v", escrowAddr, err)
		}
		return
	}

	if order.Status == status {
		return
	}

	order.Status = status
	if order.TxHash == "" {
		order.TxHash = strings.ToLower(lg.TxHash.Hex())
	}

	if err := database.DB.Save(&order).Error; err != nil {
		log.Printf("worker: gagal memperbarui status order %s: %v", order.OrderIDHex, err)
	}
}

func collectAddresses() []common.Address {
	seen := map[string]struct{}{}
	addrs := make([]common.Address, 0)

	factory := strings.ToLower(config.EscrowFactoryAddress.Hex())
	if factory != "" {
		seen[factory] = struct{}{}
		addrs = append(addrs, config.EscrowFactoryAddress)
	}

	var orders []models.Order
	database.DB.Where("escrow_address <> ''").Find(&orders)
	for _, o := range orders {
		addr := strings.ToLower(strings.TrimSpace(o.EscrowAddress))
		if addr == "" {
			continue
		}
		if _, ok := seen[addr]; ok {
			continue
		}
		seen[addr] = struct{}{}
		addrs = append(addrs, common.HexToAddress(addr))
	}

	return addrs
}

func loadCursor() (*models.ChainCursor, error) {
	var cursor models.ChainCursor
	err := database.DB.Where("name = ? AND chain_id = ?", cursorName, config.ChainID.Uint64()).First(&cursor).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		cursor = models.ChainCursor{Name: cursorName, ChainID: config.ChainID.Uint64(), LastProcessed: 0}
		if createErr := database.DB.Create(&cursor).Error; createErr != nil {
			return nil, createErr
		}
		return &cursor, nil
	}
	return &cursor, err
}

func saveCursor(cursor *models.ChainCursor) error {
	return database.DB.Save(cursor).Error
}
