package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ArtifactSubmission stores the validator's delivered work for a Validation Case.
// The actual file is stored in Feature Service documents; this table stores the reference ID.
type ArtifactSubmission struct {
	ent.Schema
}

func (ArtifactSubmission) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "artifact_submissions"},
	}
}

func (ArtifactSubmission) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (ArtifactSubmission) Fields() []ent.Field {
	return []ent.Field{
		field.Int("validation_case_id").
			Positive(),
		field.Int("validator_user_id").
			Positive(),
		field.String("document_id").
			NotEmpty(),
	}
}

func (ArtifactSubmission) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("validation_case", ValidationCase.Type).
			Ref("artifact_submissions").
			Field("validation_case_id").
			Required().
			Unique(),
		edge.From("validator_user", User.Type).
			Ref("artifact_submissions").
			Field("validator_user_id").
			Required().
			Unique(),
	}
}

func (ArtifactSubmission) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("validation_case_id").
			Unique(),
		index.Fields("validator_user_id"),
	}
}

