package handlers

func evaluateSupplierBalance(needed, balance float64, hasBalance bool) supplierBalanceCheckResult {
	if needed <= 0 {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown, Reason: "invalid needed amount"}
	}
	if !hasBalance {
		return supplierBalanceCheckResult{State: supplierBalanceStateUnknown}
	}
	if balance < needed {
		return supplierBalanceCheckResult{State: supplierBalanceStateInsufficient, Balance: balance}
	}
	return supplierBalanceCheckResult{State: supplierBalanceStateEnough, Balance: balance}
}

func extractSupplierBalanceFromProfile(userMap map[string]interface{}) (float64, bool) {
	balance, ok := extractFloatFromMap(userMap, "balance", "Balance", "money")
	if ok {
		return balance, true
	}

	rows, ok := userMap["balances"].([]interface{})
	if !ok || len(rows) == 0 {
		return 0, false
	}

	best := 0.0
	found := false
	for _, row := range rows {
		balanceMap, ok := row.(map[string]interface{})
		if !ok {
			continue
		}
		value, valueOK := extractFloatFromMap(balanceMap, "balance")
		if !valueOK {
			continue
		}
		if !found || value > best {
			best = value
			found = true
		}
	}
	return best, found
}
