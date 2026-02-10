package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ValidationCase holds the schema definition for the ValidationCase entity.
// This is the domain replacement for the legacy "Thread".
type ValidationCase struct {
	ent.Schema
}

func (ValidationCase) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "validation_cases"},
	}
}

func (ValidationCase) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the ValidationCase.
func (ValidationCase) Fields() []ent.Field {
	return []ent.Field{
		field.Int("category_id").
			Positive(),
		// Case owner (requester).
		field.Int("user_id").
			Positive(),
		field.String("title").
			NotEmpty(),
		field.String("summary").
			Optional().
			Default(""),
		field.String("content_type").
			MaxLen(32).
			Default("json"),
		field.JSON("content_json", map[string]interface{}{}).
			Optional(),
		field.JSON("meta", map[string]interface{}{}).
			Optional(),

		// Monetary / workflow fields (IDR integer amounts).
		field.Int64("bounty_amount").
			Default(0),
		field.String("status").
			MaxLen(32).
			Default("open"),
		field.String("sensitivity_level").
			MaxLen(8).
			Default("S1"),
		field.String("intake_schema_version").
			MaxLen(64).
			Default("quick-intake-v1"),
		field.String("clarification_state").
			MaxLen(64).
			Default("none"),
		field.Int("owner_inactivity_count").
			NonNegative().
			Default(0),

		// Feature-service linkage (escrow/dispute/document IDs).
		field.String("escrow_transfer_id").
			Optional().
			Nillable(),
		field.String("dispute_id").
			Optional().
			Nillable(),
		field.Int("accepted_final_offer_id").
			Optional().
			Nillable().
			Positive(),
		field.String("artifact_document_id").
			Optional().
			Nillable(),
		field.String("certified_artifact_document_id").
			Optional().
			Nillable(),
	}
}

// Edges of the ValidationCase.
func (ValidationCase) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("validation_cases").
			Field("user_id").
			Required().
			Unique(),
		edge.From("category", Category.Type).
			Ref("validation_cases").
			Field("category_id").
			Required().
			Unique(),
		edge.From("tags", Tag.Type).
			Ref("validation_cases"),

		edge.To("case_logs", ValidationCaseLog.Type),
		edge.To("consultation_requests", ConsultationRequest.Type),
		edge.To("final_offers", FinalOffer.Type),
		edge.To("artifact_submissions", ArtifactSubmission.Type),
		edge.To("endorsements", Endorsement.Type),
	}
}

func (ValidationCase) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("category_id"),
		index.Fields("user_id"),
		index.Fields("status"),
		index.Fields("sensitivity_level"),
		index.Fields("clarification_state"),
	}
}
