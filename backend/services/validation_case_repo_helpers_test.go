package services

import (
"testing"
)

func TestContainsUint(t *testing.T) {
tests := []struct {
values []uint
target uint
want   bool
}{
{[]uint{1, 2, 3}, 2, true},
{[]uint{1, 2, 3}, 4, false},
{[]uint{}, 1, false},
{nil, 1, false},
}
for _, tt := range tests {
got := containsUint(tt.values, tt.target)
if got != tt.want {
t.Errorf("containsUint(%v, %d) = %v, want %v", tt.values, tt.target, got, tt.want)
}
}
}

func TestDedupeUint(t *testing.T) {
tests := []struct {
name  string
input []uint
wantN int
}{
{"empty", []uint{}, 0},
{"nil", nil, 0},
{"no dupes", []uint{1, 2, 3}, 3},
{"with dupes", []uint{1, 2, 1, 3, 2}, 3},
{"zeros filtered", []uint{0, 1, 0, 2}, 2},
{"all zeros", []uint{0, 0, 0}, 0},
}
for _, tt := range tests {
t.Run(tt.name, func(t *testing.T) {
got := dedupeUint(tt.input)
if len(got) != tt.wantN {
t.Errorf("len = %d, want %d", len(got), tt.wantN)
}
})
}
}

func TestValidatorIDSet(t *testing.T) {
set := validatorIDSet([]uint{1, 2, 3, 0, 2})
if len(set) != 3 {
t.Errorf("set size = %d, want 3", len(set))
}
if _, ok := set[0]; ok {
t.Error("zero should be excluded")
}
if _, ok := set[1]; !ok {
t.Error("1 should be present")
}
}

func TestValidatorPairKey(t *testing.T) {
k1 := validatorPairKey(1, 2)
k2 := validatorPairKey(2, 1)
if k1 != k2 {
t.Errorf("pair keys should be symmetric: %q vs %q", k1, k2)
}
if k1 != "1:2" {
t.Errorf("pair key = %q, want '1:2'", k1)
}
}

func TestActiveAssignmentValidatorIDs(t *testing.T) {
assignments := []RepoAssignmentItem{
{ValidatorUserID: 1, Status: "active"},
{ValidatorUserID: 2, Status: "active"},
{ValidatorUserID: 3, Status: "removed"},
{ValidatorUserID: 0, Status: "active"},
{ValidatorUserID: 1, Status: "active"},
}
got := activeAssignmentValidatorIDs(assignments)
if len(got) != 2 {
t.Errorf("got %d IDs, want 2", len(got))
}
}

func TestHasValidatorUploadedOutput(t *testing.T) {
files := []RepoCaseFileItem{
{Kind: "validator_output", UploadedBy: 1},
{Kind: "case_readme", UploadedBy: 2},
{Kind: "validator_output", UploadedBy: 3},
}
if !hasValidatorUploadedOutput(files, 1) {
t.Error("should find validator 1's output")
}
if hasValidatorUploadedOutput(files, 2) {
t.Error("validator 2 has readme not output")
}
if hasValidatorUploadedOutput(files, 99) {
t.Error("validator 99 has no files")
}
}

func TestConfidenceVoteCountByValidator(t *testing.T) {
votes := []RepoConfidenceVoteItem{
{VoterUserID: 10, ValidatorUserID: 1},
{VoterUserID: 11, ValidatorUserID: 1},
{VoterUserID: 12, ValidatorUserID: 2},
{VoterUserID: 13, ValidatorUserID: 0},
}
counts := confidenceVoteCountByValidator(votes)
if counts[1] != 2 {
t.Errorf("validator 1 count = %d, want 2", counts[1])
}
if counts[2] != 1 {
t.Errorf("validator 2 count = %d, want 1", counts[2])
}
}

func TestViewerConfidenceVote(t *testing.T) {
votes := []RepoConfidenceVoteItem{
{VoterUserID: 10, ValidatorUserID: 1},
{VoterUserID: 11, ValidatorUserID: 2},
}
got := viewerConfidenceVote(votes, 10)
if got == nil || *got != 1 {
t.Errorf("expected validator 1, got %v", got)
}
got = viewerConfidenceVote(votes, 99)
if got != nil {
t.Errorf("expected nil for non-voter, got %v", got)
}
got = viewerConfidenceVote(votes, 0)
if got != nil {
t.Errorf("expected nil for zero viewer, got %v", got)
}
}

func TestNormalizeConfidenceVotes_Empty(t *testing.T) {
got := normalizeConfidenceVotes(nil, nil)
if got == nil {
t.Error("expected non-nil empty slice")
}
}
