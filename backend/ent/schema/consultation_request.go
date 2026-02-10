package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ConsultationRequest is a validator's request to consult on a Validation Case.
type ConsultationRequest struct {
	ent.Schema
}

func (ConsultationRequest) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "consultation_requests"},
	}
}

func (ConsultationRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (ConsultationRequest) Fields() []ent.Field {
	return []ent.Field{
		field.Int("validation_case_id").
			Positive(),
		field.Int("validator_user_id").
			Positive(),
		field.String("status").
			MaxLen(32).
			Default("pending"),
		field.Time("approved_at").
			Optional().
			Nillable(),
		field.Time("rejected_at").
			Optional().
			Nillable(),
		field.Time("expires_at").
			Optional().
			Nillable(),
		field.Time("owner_response_due_at").
			Optional().
			Nillable(),
		field.Int("reminder_count").
			NonNegative().
			Default(0),
		field.String("auto_closed_reason").
			MaxLen(128).
			Optional().
			Nillable(),
	}
}

func (ConsultationRequest) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("validation_case", ValidationCase.Type).
			Ref("consultation_requests").
			Field("validation_case_id").
			Required().
			Unique(),
		edge.From("validator_user", User.Type).
			Ref("consultation_requests").
			Field("validator_user_id").
			Required().
			Unique(),
	}
}

func (ConsultationRequest) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("validation_case_id", "validator_user_id").
			Unique(),
		index.Fields("validation_case_id"),
		index.Fields("validator_user_id"),
		index.Fields("status"),
		index.Fields("owner_response_due_at"),
	}
}
