package config

import (
	"crypto/ecdsa"
	"log"
	"math/big"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

var (
	JWTKey                  []byte
	BackendSignerPrivateKey *ecdsa.PrivateKey
	BackendSignerAddress    common.Address
	EscrowFactoryAddress    common.Address
	ChainID                 = big.NewInt(0)
	RPCURL                  string
)

func InitConfig() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("ERROR: JWT_SECRET is not set in environment variables")
	}

	JWTKey = []byte(secret)

	chainIDStr := os.Getenv("CHAIN_ID")
	if chainIDStr == "" {
		ChainID.SetInt64(137)
	} else {
		if _, ok := ChainID.SetString(chainIDStr, 10); !ok {
			log.Fatalf("ERROR: invalid CHAIN_ID %s", chainIDStr)
		}
	}

	signerKeyHex := strings.TrimPrefix(os.Getenv("BACKEND_SIGNER_PRIVATE_KEY"), "0x")
	if signerKeyHex == "" {
		log.Fatal("ERROR: BACKEND_SIGNER_PRIVATE_KEY is not set")
	}

	key, err := crypto.HexToECDSA(signerKeyHex)
	if err != nil {
		log.Fatalf("ERROR: failed parsing BACKEND_SIGNER_PRIVATE_KEY: %v", err)
	}
	BackendSignerPrivateKey = key
	BackendSignerAddress = crypto.PubkeyToAddress(key.PublicKey)

	factory := os.Getenv("ESCROW_FACTORY_ADDRESS")
	if factory == "" {
		log.Fatal("ERROR: ESCROW_FACTORY_ADDRESS is not set")
	}
	EscrowFactoryAddress = common.HexToAddress(factory)
	if EscrowFactoryAddress == (common.Address{}) {
		log.Fatal("ERROR: invalid ESCROW_FACTORY_ADDRESS")
	}

	RPCURL = os.Getenv("RPC_URL")
	if RPCURL == "" {
		log.Println("WARN: RPC_URL tidak disetel; worker event akan nonaktif")
	}
}
