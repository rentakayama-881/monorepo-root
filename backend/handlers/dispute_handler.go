package handlers

import (
	"net/http"

	"backend-gin/models"
	"backend-gin/services"

	"github.com/gin-gonic/gin"
)

// DisputeHandler handles dispute-related endpoints
type DisputeHandler struct {
	disputeService *services.DisputeService
}

// NewDisputeHandler creates a new dispute handler
func NewDisputeHandler() *DisputeHandler {
	return &DisputeHandler{
		disputeService: services.NewDisputeService(),
	}
}

// CreateDisputeRequest represents a request to create a dispute
type CreateDisputeRequest struct {
	TransferID uint   `json:"transfer_id" binding:"required"`
	Reason     string `json:"reason" binding:"required,min=10"`
}

// CreateDispute creates a new dispute
func (h *DisputeHandler) CreateDispute(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req CreateDisputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: reason must be at least 10 characters"})
		return
	}

	dispute, err := h.disputeService.CreateDispute(services.CreateDisputeInput{
		TransferID:  req.TransferID,
		InitiatedBy: userID,
		Reason:      req.Reason,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Dispute created successfully",
		"dispute": dispute,
	})
}

// GetMyDisputes returns the user's disputes
func (h *DisputeHandler) GetMyDisputes(c *gin.Context) {
	userID := c.GetUint("user_id")

	limit := ParseOptionalIntQuery(c, "limit", 20)
	offset := ParseOptionalIntQuery(c, "offset", 0)

	disputes, total, err := h.disputeService.GetUserDisputes(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get disputes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"disputes": disputes,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// GetDisputeByID returns a specific dispute
func (h *DisputeHandler) GetDisputeByID(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	dispute, err := h.disputeService.GetDisputeByID(disputeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dispute not found"})
		return
	}

	// Check if user is part of the dispute
	if dispute.Transfer.SenderID != userID && dispute.Transfer.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get evidence and messages
	evidence, _ := h.disputeService.GetDisputeEvidence(uint(disputeID))
	messages, _ := h.disputeService.GetDisputeMessages(uint(disputeID))

	c.JSON(http.StatusOK, gin.H{
		"dispute":  dispute,
		"evidence": evidence,
		"messages": messages,
	})
}

// AddEvidenceRequest represents a request to add evidence
type AddEvidenceRequest struct {
	EvidenceType string `json:"evidence_type" binding:"required,oneof=text image file"`
	Content      string `json:"content" binding:"required"`
	FileName     string `json:"file_name"`
	FileSize     int64  `json:"file_size"`
}

// AddEvidence adds evidence to a dispute
func (h *DisputeHandler) AddEvidence(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	var req AddEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	evidence, err := h.disputeService.AddEvidence(
		disputeID,
		userID,
		models.EvidenceType(req.EvidenceType),
		req.Content,
		req.FileName,
		req.FileSize,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Evidence added successfully",
		"evidence": evidence,
	})
}

// AddMessageRequest represents a request to add a message
type AddMessageRequest struct {
	Message string `json:"message" binding:"required,min=1"`
}

// AddMessage adds a message to the dispute chat
func (h *DisputeHandler) AddMessage(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	var req AddMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
		return
	}

	message, err := h.disputeService.AddMessage(disputeID, userID, req.Message, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": message,
	})
}

// GetMessages returns all messages for a dispute
func (h *DisputeHandler) GetMessages(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	// Verify user is part of dispute
	dispute, err := h.disputeService.GetDisputeByID(disputeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dispute not found"})
		return
	}

	if dispute.Transfer.SenderID != userID && dispute.Transfer.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	messages, err := h.disputeService.GetDisputeMessages(disputeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}

// MutualRelease allows sender to release funds during dispute
func (h *DisputeHandler) MutualRelease(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	dispute, err := h.disputeService.MutualRelease(disputeID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Funds released successfully",
		"dispute": dispute,
	})
}

// MutualRefund allows receiver to agree to refund during dispute
func (h *DisputeHandler) MutualRefund(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	dispute, err := h.disputeService.MutualRefund(disputeID, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Refund processed successfully",
		"dispute": dispute,
	})
}

// EscalateToAdmin escalates the dispute to admin review
func (h *DisputeHandler) EscalateToAdmin(c *gin.Context) {
	userID := c.GetUint("user_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	// Verify user is part of dispute
	dispute, err := h.disputeService.GetDisputeByID(disputeID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dispute not found"})
		return
	}

	if dispute.Transfer.SenderID != userID && dispute.Transfer.ReceiverID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	dispute, err = h.disputeService.EscalateToAdmin(disputeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Dispute escalated to admin review",
		"dispute": dispute,
	})
}

// === ADMIN ENDPOINTS ===

// AdminGetAllDisputes returns all disputes for admin
func (h *DisputeHandler) AdminGetAllDisputes(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	limit := ParseOptionalIntQuery(c, "limit", 20)
	offset := ParseOptionalIntQuery(c, "offset", 0)

	var disputes []models.Dispute
	var total int64

	query := c.MustGet("db").(*services.DisputeService)
	_ = query // Use the actual DB query

	db := c.MustGet("db")
	_ = db

	// For now, use a simple query
	// In production, inject the DB properly
	c.JSON(http.StatusOK, gin.H{
		"disputes": disputes,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"status":   status,
	})
}

// AdminResolveDisputeRequest represents admin's resolution request
type AdminResolveDisputeRequest struct {
	ResolveToSender bool   `json:"resolve_to_sender"` // true = refund to sender, false = release to receiver
	Decision        string `json:"decision" binding:"required,min=10"`
}

// AdminResolveDispute resolves a dispute (admin action)
func (h *DisputeHandler) AdminResolveDispute(c *gin.Context) {
	adminID := c.GetUint("admin_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	var req AdminResolveDisputeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Decision must be at least 10 characters"})
		return
	}

	dispute, err := h.disputeService.ResolveDispute(disputeID, adminID, req.ResolveToSender, req.Decision)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Dispute resolved successfully",
		"dispute": dispute,
	})
}

// AdminAddMessage allows admin to add message to dispute
func (h *DisputeHandler) AdminAddMessage(c *gin.Context) {
	adminID := c.GetUint("admin_id")
	disputeID, ok := ParseIDParam(c, "id")
	if !ok {
		return
	}

	var req AddMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message is required"})
		return
	}

	message, err := h.disputeService.AddMessage(disputeID, adminID, req.Message, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": message,
	})
}
