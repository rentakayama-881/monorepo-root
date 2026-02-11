package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ValidationCaseLog is an append-only audit trail entry for a Validation Case.
type ValidationCaseLog struct {
	ent.Schema
}

func (ValidationCaseLog) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "validation_case_logs"},
	}
}

func (ValidationCaseLog) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (ValidationCaseLog) Fields() []ent.Field {
	return []ent.Field{
		field.Int("validation_case_id").
			Positive(),
		// Null means system-generated.
		field.Int("actor_user_id").
			Optional().
			Nillable().
			Positive(),
		field.String("event_type").
			MaxLen(64).
			NotEmpty(),
		field.JSON("detail_json", map[string]interface{}{}).
			Optional(),
	}
}

func (ValidationCaseLog) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("validation_case", ValidationCase.Type).
			Ref("case_logs").
			Field("validation_case_id").
			Required().
			Unique(),
		edge.From("actor_user", User.Type).
			Ref("validation_case_logs").
			Field("actor_user_id").
			Unique(),
	}
}

func (ValidationCaseLog) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("validation_case_id"),
		index.Fields("actor_user_id"),
		index.Fields("event_type"),
		index.Fields("validation_case_id", "created_at"),
	}
}

