package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Endorsement is a PHASE 2 (future) feature.
// It exists only in the domain model and must not be exposed in the UI yet.
//
// Applies ONLY to Certified Artifacts and can only be made by validators.
type Endorsement struct {
	ent.Schema
}

func (Endorsement) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "endorsements"},
	}
}

func (Endorsement) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (Endorsement) Fields() []ent.Field {
	return []ent.Field{
		field.Int("validation_case_id").
			Positive(),
		field.Int("validator_user_id").
			Positive(),
		field.String("certified_artifact_document_id").
			Optional().
			Nillable(),
		field.String("stance").
			MaxLen(32).
			Optional().
			Default("endorse"),
		field.Text("note").
			Optional().
			Default(""),
	}
}

func (Endorsement) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("validation_case", ValidationCase.Type).
			Ref("endorsements").
			Field("validation_case_id").
			Required().
			Unique(),
		edge.From("validator_user", User.Type).
			Ref("endorsements").
			Field("validator_user_id").
			Required().
			Unique(),
	}
}

func (Endorsement) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("validation_case_id", "validator_user_id").
			Unique(),
	}
}

