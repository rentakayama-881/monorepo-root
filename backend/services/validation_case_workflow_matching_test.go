package services

import (
	"testing"
)

func TestClampScore(t *testing.T) {
	tests := []struct {
		input int
		want  int
	}{
		{-10, 0},
		{0, 0},
		{50, 50},
		{100, 100},
		{150, 100},
	}
	for _, tt := range tests {
		got := clampScore(tt.input)
		if got != tt.want {
			t.Errorf("clampScore(%d) = %d, want %d", tt.input, got, tt.want)
		}
	}
}

func TestOverlapScore(t *testing.T) {
	tests := []struct {
		name        string
		caseTags    map[string]struct{}
		historyTags map[string]struct{}
		want        int
	}{
		{"empty case tags", nil, map[string]struct{}{"a": {}}, 50},
		{"empty history tags", map[string]struct{}{"a": {}}, nil, 0},
		{"full overlap", map[string]struct{}{"a": {}, "b": {}}, map[string]struct{}{"a": {}, "b": {}}, 100},
		{"half overlap", map[string]struct{}{"a": {}, "b": {}}, map[string]struct{}{"a": {}}, 50},
		{"no overlap", map[string]struct{}{"a": {}}, map[string]struct{}{"b": {}}, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := overlapScore(tt.caseTags, tt.historyTags)
			if got != tt.want {
				t.Errorf("overlapScore() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestStakeGuaranteeScore(t *testing.T) {
	tests := []struct {
		name   string
		amount int64
		want   int
	}{
		{"zero guarantee", 0, 0},
		{"negative", -100, 0},
		{"low ratio", 50000, 35},
		{"at minimum", 100000, 55},
		{"1.5x", 150000, 70},
		{"2x", 200000, 85},
		{"3x", 300000, 100},
		{"very high", 1000000, 100},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := stakeGuaranteeScore(tt.amount)
			if got != tt.want {
				t.Errorf("stakeGuaranteeScore(%d) = %d, want %d", tt.amount, got, tt.want)
			}
		})
	}
}
