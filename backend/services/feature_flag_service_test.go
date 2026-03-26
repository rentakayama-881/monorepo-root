package services

import (
	"testing"
)

// =============================================================================
// Pure function tests
// =============================================================================

func TestRolloutBucket_Deterministic(t *testing.T) {
	// Same key+userID should always produce the same bucket
	bucket1 := rolloutBucket("feature_x", 42)
	bucket2 := rolloutBucket("feature_x", 42)
	if bucket1 != bucket2 {
		t.Fatalf("rolloutBucket should be deterministic: got %d and %d", bucket1, bucket2)
	}
}

func TestRolloutBucket_Range(t *testing.T) {
	// Result must be in range [0, 99]
	for userID := uint(0); userID < 1000; userID++ {
		bucket := rolloutBucket("test_feature", userID)
		if bucket >= 100 {
			t.Fatalf("rolloutBucket(%q, %d) = %d, expected < 100", "test_feature", userID, bucket)
		}
	}
}

func TestRolloutBucket_DifferentKeys(t *testing.T) {
	// Different keys should (usually) produce different buckets for same user
	bucketA := rolloutBucket("feature_a", 1)
	bucketB := rolloutBucket("feature_b", 1)
	// Not guaranteed to differ, but at least the function shouldn't panic
	_ = bucketA
	_ = bucketB
}

func TestRolloutBucket_DifferentUsers(t *testing.T) {
	// Different users should (usually) produce different buckets for same key
	bucket1 := rolloutBucket("feature_x", 1)
	bucket2 := rolloutBucket("feature_x", 2)
	// Not guaranteed to differ, but validates the function handles different inputs
	_ = bucket1
	_ = bucket2
}

func TestRolloutBucket_Distribution(t *testing.T) {
	// Verify rough uniform distribution across 1000 users
	counts := make([]int, 100)
	numUsers := uint(10000)
	for i := uint(0); i < numUsers; i++ {
		bucket := rolloutBucket("distribution_test", i)
		counts[bucket]++
	}

	// Each bucket should get roughly numUsers/100 = 100 hits
	// Allow ±60 tolerance (very generous to avoid flaky tests)
	expected := int(numUsers) / 100
	for i, count := range counts {
		if count < expected-60 || count > expected+60 {
			t.Errorf("bucket %d has %d entries, expected ~%d (±60)", i, count, expected)
		}
	}
}

// =============================================================================
// DB-dependent tests (placeholders)
// =============================================================================

func TestPlaceholder_FeatureFlagService_IsEnabled(t *testing.T) {
	t.Skip("requires database connection")
}

func TestPlaceholder_FeatureFlagService_CRUD(t *testing.T) {
	t.Skip("requires database connection")
}
