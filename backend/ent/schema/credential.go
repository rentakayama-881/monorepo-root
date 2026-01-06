package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Credential holds the schema definition for the Credential entity.
type Credential struct {
	ent.Schema
}

func (Credential) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "credentials"},
	}
}

func (Credential) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Credential.
func (Credential) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.String("platform").
			Optional().
			Default(""),
		field.String("description").
			Optional().
			Default(""),
	}
}

// Edges of the Credential.
func (Credential) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("credentials").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (Credential) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
	}
}
