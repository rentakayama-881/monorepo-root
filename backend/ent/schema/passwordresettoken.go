package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// PasswordResetToken holds the schema definition for the PasswordResetToken entity.
type PasswordResetToken struct {
	ent.Schema
}

func (PasswordResetToken) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "password_reset_tokens"},
	}
}

func (PasswordResetToken) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the PasswordResetToken.
func (PasswordResetToken) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.String("token_hash").
			Unique().
			MaxLen(128).
			NotEmpty(),
		field.Time("expires_at"),
		field.Time("used_at").
			Optional().
			Nillable(),
	}
}

// Edges of the PasswordResetToken.
func (PasswordResetToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("password_reset_tokens").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (PasswordResetToken) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("token_hash").Unique(),
	}
}
