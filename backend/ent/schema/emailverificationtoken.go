package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// EmailVerificationToken holds the schema definition for the EmailVerificationToken entity.
type EmailVerificationToken struct {
	ent.Schema
}

func (EmailVerificationToken) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "email_verification_tokens"},
	}
}

func (EmailVerificationToken) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the EmailVerificationToken.
func (EmailVerificationToken) Fields() []ent.Field {
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

// Edges of the EmailVerificationToken.
func (EmailVerificationToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("email_verification_tokens").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (EmailVerificationToken) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("token_hash").Unique(),
	}
}
