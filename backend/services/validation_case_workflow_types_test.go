package services

import (
"testing"
)

func TestWorkflowDTOTypes(t *testing.T) {
t.Run("FinalOfferItem", func(t *testing.T) {
item := FinalOfferItem{
ID:               1,
ValidationCaseID: 10,
Amount:           50000,
HoldHours:        48,
Terms:            "Standard terms",
Status:           "pending",
}
if item.Amount != 50000 {
t.Errorf("Amount = %d, want 50000", item.Amount)
}
})

t.Run("EscrowDraft", func(t *testing.T) {
draft := EscrowDraft{
ReceiverUsername: "validator1",
Amount:          100000,
HoldHours:       72,
Message:         "Escrow for case #42",
}
if draft.ReceiverUsername != "validator1" {
t.Errorf("ReceiverUsername = %q", draft.ReceiverUsername)
}
})

t.Run("CaseLogItem", func(t *testing.T) {
item := CaseLogItem{
ID:               1,
ValidationCaseID: 10,
EventType:        "consultation_approved",
Detail:           map[string]interface{}{"note": "approved"},
CreatedAt:        1234567890,
}
if item.EventType != "consultation_approved" {
t.Errorf("EventType = %q", item.EventType)
}
})

t.Run("MatchingScoreBreakdown", func(t *testing.T) {
score := MatchingScoreBreakdown{
Total:             85,
DomainFit:         90,
EvidenceFit:       80,
HistoryDispute:    100,
ResponsivenessSLA: 70,
StakeGuarantee:    85,
}
if score.Total != 85 {
t.Errorf("Total = %d, want 85", score.Total)
}
})
}
