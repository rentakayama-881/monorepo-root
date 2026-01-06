package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// TOTPPendingToken holds the schema definition for the TOTPPendingToken entity.
type TOTPPendingToken struct {
	ent.Schema
}

func (TOTPPendingToken) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "totp_pending_tokens"},
	}
}

func (TOTPPendingToken) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the TOTPPendingToken.
func (TOTPPendingToken) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.String("token_hash").
			Unique().
			NotEmpty(),
		field.Time("expires_at"),
		field.Time("used_at").
			Optional().
			Nillable(),
	}
}

// Edges of the TOTPPendingToken.
func (TOTPPendingToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("totp_pending_tokens").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (TOTPPendingToken) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("token_hash").Unique(),
		index.Fields("user_id"),
	}
}
