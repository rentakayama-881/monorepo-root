package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// SudoSession holds the schema definition for the SudoSession entity.
type SudoSession struct {
	ent.Schema
}

func (SudoSession) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "sudo_sessions"},
	}
}

func (SudoSession) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the SudoSession.
func (SudoSession) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.String("token_hash").
			Unique().
			NotEmpty(),
		field.Time("expires_at").
			Default(time.Now),
		field.String("ip_address").
			Optional().
			MaxLen(45),
		field.String("user_agent").
			Optional().
			MaxLen(512),
		field.Time("last_used_at").
			Optional().
			Nillable(),
	}
}

// Edges of the SudoSession.
func (SudoSession) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("sudo_sessions").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (SudoSession) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("token_hash").Unique(),
		index.Fields("user_id"),
	}
}
