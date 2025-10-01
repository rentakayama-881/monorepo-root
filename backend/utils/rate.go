package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func GetTokenToIDRRate(coinGeckoID string) (float64, error) {
	url := fmt.Sprintf("https://api.coingecko.com/api/v3/simple/price?ids=%s&vs_currencies=idr", coinGeckoID)
	resp, err := http.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	var data map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return 0, err
	}
	return data[coinGeckoID]["idr"], nil
}
