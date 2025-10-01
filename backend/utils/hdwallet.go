package utils

import (
	"fmt"
	"os"

	bip39 "github.com/tyler-smith/go-bip39"
	bip32 "github.com/tyler-smith/go-bip32"
	"github.com/ethereum/go-ethereum/crypto"
)

func GenerateHDWalletAddress(userID uint) (string, error) {
	mnemonic := os.Getenv("MASTER_WALLET_MNEMONIC")
	if mnemonic == "" {
		return "", fmt.Errorf("MASTER_WALLET_MNEMONIC not set in env")
	}
	seed := bip39.NewSeed(mnemonic, "")
	masterKey, err := bip32.NewMasterKey(seed)
	if err != nil {
		return "", fmt.Errorf("failed to create master key: %w", err)
	}
	p44 := bip32.FirstHardenedChild + 44
	p60 := bip32.FirstHardenedChild + 60
	p0h := bip32.FirstHardenedChild + 0
	key := masterKey

	if key, err = key.NewChildKey(p44); err != nil {
		return "", fmt.Errorf("failed at m/44': %w", err)
	}
	if key, err = key.NewChildKey(p60); err != nil {
		return "", fmt.Errorf("failed at m/60': %w", err)
	}
	if key, err = key.NewChildKey(p0h); err != nil {
		return "", fmt.Errorf("failed at m/0': %w", err)
	}
	if key, err = key.NewChildKey(0); err != nil {
		return "", fmt.Errorf("failed at m/0: %w", err)
	}
	if key, err = key.NewChildKey(uint32(userID)); err != nil {
		return "", fmt.Errorf("failed at userID: %w", err)
	}
	priv, err := crypto.ToECDSA(key.Key)
	if err != nil {
		return "", fmt.Errorf("failed to get ECDSA key: %w", err)
	}
	address := crypto.PubkeyToAddress(priv.PublicKey)
	return address.Hex(), nil
}
