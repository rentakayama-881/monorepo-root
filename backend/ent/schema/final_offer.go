package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// FinalOffer is a validator's formal offer for a Validation Case (contract terms + amount).
type FinalOffer struct {
	ent.Schema
}

func (FinalOffer) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "final_offers"},
	}
}

func (FinalOffer) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (FinalOffer) Fields() []ent.Field {
	return []ent.Field{
		field.Int("validation_case_id").
			Positive(),
		field.Int("validator_user_id").
			Positive(),
		// submission_key enforces idempotency for validator submit-final-offer action.
		// Nullable to avoid breaking existing rows during online migration.
		field.String("submission_key").
			MaxLen(96).
			Optional().
			Nillable().
			Unique(),
		field.Int64("amount").
			Positive(),
		field.Int("hold_hours").
			Positive().
			Default(168),
		field.Text("terms").
			Optional().
			Default(""),
		field.String("status").
			MaxLen(32).
			Default("submitted"),
		field.Time("accepted_at").
			Optional().
			Nillable(),
		field.Time("rejected_at").
			Optional().
			Nillable(),
	}
}

func (FinalOffer) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("validation_case", ValidationCase.Type).
			Ref("final_offers").
			Field("validation_case_id").
			Required().
			Unique(),
		edge.From("validator_user", User.Type).
			Ref("final_offers").
			Field("validator_user_id").
			Required().
			Unique(),
	}
}

func (FinalOffer) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("validation_case_id"),
		index.Fields("validator_user_id"),
		index.Fields("validation_case_id", "validator_user_id"),
		index.Fields("status"),
	}
}
