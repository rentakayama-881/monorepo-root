package services

import (
	"encoding/json"
	"testing"
	"time"
)

func TestFeatureServiceTypes_JSONRoundTrip(t *testing.T) {
	t.Run("featureTransferDto", func(t *testing.T) {
		holdUntil := time.Date(2025, 6, 15, 12, 0, 0, 0, time.UTC)
		dto := featureTransferDto{
			ID:         "transfer-abc",
			SenderID:   1,
			ReceiverID: 2,
			Amount:     100_000,
			Status:     "pending",
			HoldUntil:  &holdUntil,
		}

		b, err := json.Marshal(dto)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded featureTransferDto
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.ID != dto.ID {
			t.Errorf("ID = %q, want %q", decoded.ID, dto.ID)
		}
		if decoded.SenderID != dto.SenderID {
			t.Errorf("SenderID = %d, want %d", decoded.SenderID, dto.SenderID)
		}
		if decoded.ReceiverID != dto.ReceiverID {
			t.Errorf("ReceiverID = %d, want %d", decoded.ReceiverID, dto.ReceiverID)
		}
		if decoded.Amount != dto.Amount {
			t.Errorf("Amount = %d, want %d", decoded.Amount, dto.Amount)
		}
		if decoded.Status != dto.Status {
			t.Errorf("Status = %q, want %q", decoded.Status, dto.Status)
		}
		if decoded.HoldUntil == nil {
			t.Fatal("HoldUntil should not be nil")
		}
		if !decoded.HoldUntil.Equal(holdUntil) {
			t.Errorf("HoldUntil = %v, want %v", decoded.HoldUntil, holdUntil)
		}
	})

	t.Run("featureTransferDto nil holdUntil", func(t *testing.T) {
		dto := featureTransferDto{
			ID:         "transfer-xyz",
			SenderID:   10,
			ReceiverID: 20,
			Amount:     50_000,
			Status:     "released",
			HoldUntil:  nil,
		}

		b, err := json.Marshal(dto)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded featureTransferDto
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.HoldUntil != nil {
			t.Error("HoldUntil should be nil")
		}
	})

	t.Run("featureDisputeDto", func(t *testing.T) {
		dto := featureDisputeDto{
			ID:         "dispute-123",
			TransferID: "transfer-abc",
			Status:     "open",
		}

		b, err := json.Marshal(dto)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded featureDisputeDto
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.ID != dto.ID {
			t.Errorf("ID = %q, want %q", decoded.ID, dto.ID)
		}
		if decoded.TransferID != dto.TransferID {
			t.Errorf("TransferID = %q, want %q", decoded.TransferID, dto.TransferID)
		}
		if decoded.Status != dto.Status {
			t.Errorf("Status = %q, want %q", decoded.Status, dto.Status)
		}
	})

	t.Run("featureServiceError", func(t *testing.T) {
		errDto := featureServiceError{
			Code:    "INSUFFICIENT_BALANCE",
			Message: "Not enough funds",
			Details: []string{"detail-1", "detail-2"},
		}

		b, err := json.Marshal(errDto)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded featureServiceError
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.Code != errDto.Code {
			t.Errorf("Code = %q, want %q", decoded.Code, errDto.Code)
		}
		if decoded.Message != errDto.Message {
			t.Errorf("Message = %q, want %q", decoded.Message, errDto.Message)
		}
		if len(decoded.Details) != 2 {
			t.Errorf("Details length = %d, want 2", len(decoded.Details))
		}
	})

	t.Run("featureServiceResponse success", func(t *testing.T) {
		transfer := featureTransferDto{ID: "t-1", Amount: 10_000, Status: "pending"}
		resp := featureServiceResponse[featureTransferDto]{
			Success: true,
			Data:    &transfer,
			Message: "OK",
		}

		b, err := json.Marshal(resp)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded featureServiceResponse[featureTransferDto]
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if !decoded.Success {
			t.Error("Success should be true")
		}
		if decoded.Data == nil {
			t.Fatal("Data should not be nil")
		}
		if decoded.Data.ID != "t-1" {
			t.Errorf("Data.ID = %q, want %q", decoded.Data.ID, "t-1")
		}
	})

	t.Run("featureServiceResponse error", func(t *testing.T) {
		fsErr := featureServiceError{Code: "NOT_FOUND", Message: "Transfer not found"}
		resp := featureServiceResponse[featureTransferDto]{
			Success: false,
			Error:   &fsErr,
		}

		b, err := json.Marshal(resp)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded featureServiceResponse[featureTransferDto]
		if err := json.Unmarshal(b, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.Success {
			t.Error("Success should be false")
		}
		if decoded.Error == nil {
			t.Fatal("Error should not be nil")
		}
		if decoded.Error.Code != "NOT_FOUND" {
			t.Errorf("Error.Code = %q, want %q", decoded.Error.Code, "NOT_FOUND")
		}
	})
}

func TestPlaceholder_GetFeatureTransfer(t *testing.T) {
	t.Skip("requires HTTP call to Feature Service")
}

func TestPlaceholder_GetFeatureDispute(t *testing.T) {
	t.Skip("requires HTTP call to Feature Service")
}

func TestPlaceholder_ConfirmLockFunds(t *testing.T) {
	t.Skip("requires database connection and HTTP call to Feature Service")
}

func TestPlaceholder_SubmitArtifact(t *testing.T) {
	t.Skip("requires database connection and HTTP call to Feature Service")
}

func TestPlaceholder_ShareDocumentWithCaseOwner(t *testing.T) {
	t.Skip("requires HTTP call to Feature Service")
}

func TestPlaceholder_MarkEscrowReleased(t *testing.T) {
	t.Skip("requires database connection and HTTP call to Feature Service")
}

func TestPlaceholder_MarkEscrowReleasedInternalByTransferID(t *testing.T) {
	t.Skip("requires database connection")
}
