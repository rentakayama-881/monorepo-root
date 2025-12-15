// Example Go worker for listening to EscrowFactory/Escrow events and updating DB

package worker

import (
    "context"
    "log"
    "time"

    "github.com/ethereum/go-ethereum/ethclient"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/core/types"
     ethereum "github.com/ethereum/go-ethereum"
    // import your DB/model packages
)

const (
    RPC_URL = "https://polygon-rpc.com" // or your node/Infura endpoint
    ESCROW_FACTORY_ADDRESS = "0x..."    // fill with deployed address
)

func RunEscrowEventListener() {
    client, err := ethclient.Dial(RPC_URL)
    if err != nil {
        log.Fatalf("Failed to connect to Ethereum RPC: %v", err)
    }

    escrowFactory := common.HexToAddress(ESCROW_FACTORY_ADDRESS)
    query := ethereum.FilterQuery{
        Addresses: []common.Address{escrowFactory /*, ...escrow addresses as needed */},
    }

    logs := make(chan types.Log)
    sub, err := client.SubscribeFilterLogs(context.Background(), query, logs)
    if err != nil {
        log.Fatalf("Failed to subscribe to logs: %v", err)
    }

    go func() {
        for {
            select {
            case err := <-sub.Err():
                log.Println("Subscription error:", err)
                time.Sleep(time.Second * 10)
                // try restart or alert
            case vLog := <-logs:
                // Parse ABI, decode event
                // Example: handleEscrowDeployed, handleFunded, handleDelivered, etc.
                handleEvent(vLog)
            }
        }
    }()
}

func handleEvent(vLog types.Log) {
    // Load ABI, identify event by vLog.Topics[0]
    // Parse data, update DB accordingly
    // Example:
    // if vLog.Topics[0] == EscrowDeployedTopic { ... }
    // else if vLog.Topics[0] == FundedTopic { ... }
    // etc.
    log.Printf("Received event: %x\n", vLog.Topics[0].Bytes())
    // You can decode event parameters here and call DB update functions
}
