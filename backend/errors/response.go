package errors

// ErrorResponse returns a standard error response payload.
func ErrorResponse(err *AppError) map[string]interface{} {
	response := map[string]interface{}{
		"code":    err.Code,
		"message": err.Message,
	}
	if err.Details != "" {
		response["details"] = err.Details
	}
	return response
}
