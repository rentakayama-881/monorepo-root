package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ParseIDParam extracts and parses an ID parameter from the request URL
// Returns the parsed ID and true if successful, or sends an error response and returns false
func ParseIDParam(c *gin.Context, paramName string) (uint, bool) {
	idStr := c.Param(paramName)
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid " + paramName})
		return 0, false
	}
	return uint(id), true
}

// ParseOptionalIntQuery extracts and parses an optional integer query parameter
// Returns the parsed value or the default if not provided or invalid
func ParseOptionalIntQuery(c *gin.Context, key string, defaultValue int) int {
	val, err := strconv.Atoi(c.DefaultQuery(key, strconv.Itoa(defaultValue)))
	if err != nil {
		return defaultValue
	}
	return val
}
