package database

import (
	"gorm.io/gorm"
        "backend-gin/utils"
)

// DepositAddress model
type DepositAddress struct {
	gorm.Model
	UserID  uint   `gorm:"uniqueIndex"`
	Address string `gorm:"uniqueIndex"`
        LastBalance float64 `gorm:"default:0"`
        LastBalanceWei string `gorm:"type:text;default:'0'"`
}

// AutoMigrate di InitDB()
// DB.AutoMigrate(&DepositAddress{})

func GetOrCreateUserDepositAddress(userID uint) (string, error) {
	var dep DepositAddress
	result := DB.Where("user_id = ?", userID).First(&dep)
	if result.Error == nil {
		return dep.Address, nil
	}
	// Buat address baru dari HD wallet
	addr, err := utils.GenerateHDWalletAddress(userID)
	if err != nil {
		return "", err
	}
	// Simpan ke DB
	dep = DepositAddress{UserID: userID, Address: addr}
	if err := DB.Create(&dep).Error; err != nil {
		return "", err
	}
	return addr, nil
}
