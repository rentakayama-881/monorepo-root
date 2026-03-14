package services

import (
	"context"
	"math"
	"strings"
	"time"

	"backend-gin/ent"
	"backend-gin/ent/consultationrequest"
	"backend-gin/ent/finaloffer"
	"backend-gin/ent/tag"
	"backend-gin/ent/validationcase"
)

func clampScore(v int) int {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

func overlapScore(caseTags map[string]struct{}, historyTags map[string]struct{}) int {
	if len(caseTags) == 0 {
		return 50
	}
	if len(historyTags) == 0 {
		return 0
	}
	matches := 0
	for slug := range caseTags {
		if _, ok := historyTags[slug]; ok {
			matches++
		}
	}
	return clampScore(int(math.Round(float64(matches) * 100 / float64(len(caseTags)))))
}

func extractTagSetByPrefix(tags []*ent.Tag, prefix string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, t := range tags {
		slug := strings.ToLower(strings.TrimSpace(t.Slug))
		if slug == "" {
			continue
		}
		if strings.HasPrefix(slug, prefix) {
			out[slug] = struct{}{}
		}
	}
	return out
}

func stakeGuaranteeScore(guaranteeAmount int64) int {
	required := minCredibilityStakeIDR()
	if required <= 0 {
		required = 100_000
	}
	if guaranteeAmount <= 0 {
		return 0
	}
	ratio := float64(guaranteeAmount) / float64(required)
	switch {
	case ratio >= 3.0:
		return 100
	case ratio >= 2.0:
		return 85
	case ratio >= 1.5:
		return 70
	case ratio >= 1.0:
		return 55
	default:
		return 35
	}
}

func responsivenessSLAScore(approvedReqs []*ent.ConsultationRequest, firstOfferByCase map[int]time.Time, now time.Time) int {
	if len(approvedReqs) == 0 {
		return 50
	}

	total := 0
	count := 0
	for _, req := range approvedReqs {
		if req.ApprovedAt == nil {
			continue
		}
		approvedAt := *req.ApprovedAt
		offerAt, hasOffer := firstOfferByCase[req.ValidationCaseID]
		score := 50
		if hasOffer {
			if offerAt.Before(approvedAt) {
				offerAt = approvedAt
			}
			lag := offerAt.Sub(approvedAt)
			switch {
			case lag <= 2*time.Hour:
				score = 100
			case lag <= 8*time.Hour:
				score = 80
			case lag <= 24*time.Hour:
				score = 60
			default:
				score = 30
			}
		} else {
			if now.Sub(approvedAt) > 24*time.Hour {
				score = 0
			}
		}
		total += score
		count++
	}

	if count == 0 {
		return 50
	}
	return clampScore(int(math.Round(float64(total) / float64(count))))
}

func (s *EntValidationCaseWorkflowService) buildMatchingScore(
	ctx context.Context,
	vc *ent.ValidationCase,
	validatorUserID int,
	guaranteeAmount int64,
) (*MatchingScoreBreakdown, error) {
	caseDomain := extractTagSetByPrefix(vc.Edges.Tags, "domain-")
	caseEvidence := extractTagSetByPrefix(vc.Edges.Tags, "evidence-")

	offers, err := s.client.FinalOffer.Query().
		Where(finaloffer.ValidatorUserIDEQ(validatorUserID)).
		Order(ent.Desc(finaloffer.FieldCreatedAt)).
		Limit(300).
		All(ctx)
	if err != nil {
		return nil, err
	}

	caseIDs := make([]int, 0, len(offers))
	seenCase := make(map[int]struct{})
	firstOfferByCase := make(map[int]time.Time)
	for _, offer := range offers {
		if _, ok := seenCase[offer.ValidationCaseID]; !ok {
			seenCase[offer.ValidationCaseID] = struct{}{}
			caseIDs = append(caseIDs, offer.ValidationCaseID)
		}
		if current, ok := firstOfferByCase[offer.ValidationCaseID]; !ok || offer.CreatedAt.Before(current) {
			firstOfferByCase[offer.ValidationCaseID] = offer.CreatedAt
		}
	}

	var historyCases []*ent.ValidationCase
	if len(caseIDs) > 0 {
		historyCases, err = s.client.ValidationCase.Query().
			Where(validationcase.IDIn(caseIDs...)).
			WithTags(func(q *ent.TagQuery) {
				q.Where(tag.IsActiveEQ(true))
			}).
			All(ctx)
		if err != nil {
			return nil, err
		}
	}

	historyDomain := map[string]struct{}{}
	historyEvidence := map[string]struct{}{}
	disputedCount := 0
	for _, hc := range historyCases {
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "domain-") {
			historyDomain[slug] = struct{}{}
		}
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "evidence-") {
			historyEvidence[slug] = struct{}{}
		}
		if normalizeStatus(hc.Status) == "disputed" {
			disputedCount++
		}
	}

	domainScore := overlapScore(caseDomain, historyDomain)
	evidenceScore := overlapScore(caseEvidence, historyEvidence)

	historyDisputeScore := 50
	if len(historyCases) > 0 {
		historyDisputeScore = clampScore(int(math.Round((1 - float64(disputedCount)/float64(len(historyCases))) * 100)))
	}

	approvedReqs, err := s.client.ConsultationRequest.Query().
		Where(
			consultationrequest.ValidatorUserIDEQ(validatorUserID),
			consultationrequest.ApprovedAtNotNil(),
		).
		Limit(200).
		All(ctx)
	if err != nil {
		return nil, err
	}
	responsivenessScore := responsivenessSLAScore(approvedReqs, firstOfferByCase, time.Now())

	stakeScore := stakeGuaranteeScore(guaranteeAmount)
	total := clampScore(int(math.Round(float64(domainScore+evidenceScore+historyDisputeScore+responsivenessScore+stakeScore) / 5)))

	return &MatchingScoreBreakdown{
		Total:             total,
		DomainFit:         domainScore,
		EvidenceFit:       evidenceScore,
		HistoryDispute:    historyDisputeScore,
		ResponsivenessSLA: responsivenessScore,
		StakeGuarantee:    stakeScore,
	}, nil
}

// buildMatchingScoreBatch computes matching score using pre-loaded data to avoid N+1 queries.
func (s *EntValidationCaseWorkflowService) buildMatchingScoreBatch(
	vc *ent.ValidationCase,
	validatorUserID int,
	guaranteeAmount int64,
	offers []*ent.FinalOffer,
	approvedReqs []*ent.ConsultationRequest,
	historyCaseByID map[int]*ent.ValidationCase,
) (*MatchingScoreBreakdown, error) {
	caseDomain := extractTagSetByPrefix(vc.Edges.Tags, "domain-")
	caseEvidence := extractTagSetByPrefix(vc.Edges.Tags, "evidence-")

	// Build history from pre-loaded offers
	firstOfferByCase := make(map[int]time.Time)
	caseIDs := make([]int, 0)
	seenCase := make(map[int]struct{})
	for _, offer := range offers {
		if _, ok := seenCase[offer.ValidationCaseID]; !ok {
			seenCase[offer.ValidationCaseID] = struct{}{}
			caseIDs = append(caseIDs, offer.ValidationCaseID)
		}
		if current, ok := firstOfferByCase[offer.ValidationCaseID]; !ok || offer.CreatedAt.Before(current) {
			firstOfferByCase[offer.ValidationCaseID] = offer.CreatedAt
		}
	}

	historyDomain := map[string]struct{}{}
	historyEvidence := map[string]struct{}{}
	disputedCount := 0
	historyCaseCount := 0
	for _, caseID := range caseIDs {
		hc, ok := historyCaseByID[caseID]
		if !ok {
			continue
		}
		historyCaseCount++
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "domain-") {
			historyDomain[slug] = struct{}{}
		}
		for slug := range extractTagSetByPrefix(hc.Edges.Tags, "evidence-") {
			historyEvidence[slug] = struct{}{}
		}
		if normalizeStatus(hc.Status) == "disputed" {
			disputedCount++
		}
	}

	domainScore := overlapScore(caseDomain, historyDomain)
	evidenceScore := overlapScore(caseEvidence, historyEvidence)

	historyDisputeScore := 50
	if historyCaseCount > 0 {
		historyDisputeScore = clampScore(int(math.Round((1 - float64(disputedCount)/float64(historyCaseCount)) * 100)))
	}

	responsivenessScore := responsivenessSLAScore(approvedReqs, firstOfferByCase, time.Now())
	stakeScore := stakeGuaranteeScore(guaranteeAmount)
	total := clampScore(int(math.Round(float64(domainScore+evidenceScore+historyDisputeScore+responsivenessScore+stakeScore) / 5)))

	return &MatchingScoreBreakdown{
		Total:             total,
		DomainFit:         domainScore,
		EvidenceFit:       evidenceScore,
		HistoryDispute:    historyDisputeScore,
		ResponsivenessSLA: responsivenessScore,
		StakeGuarantee:    stakeScore,
	}, nil
}
