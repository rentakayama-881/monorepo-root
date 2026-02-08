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

// Session holds the schema definition for the Session entity.
type Session struct {
	ent.Schema
}

func (Session) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "sessions"},
	}
}

func (Session) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Session.
func (Session) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.String("refresh_token_hash").
			Unique().
			MaxLen(128).
			NotEmpty(),
		field.String("access_token_jti").
			Optional().
			MaxLen(64),
		field.String("ip_address").
			Optional().
			MaxLen(45),
		field.String("user_agent").
			Optional().
			MaxLen(512),
		field.Time("expires_at").
			Default(time.Now),
		field.Time("last_used_at").
			Default(time.Now),
		field.Time("revoked_at").
			Optional().
			Nillable(),
		field.String("revoke_reason").
			Optional().
			MaxLen(100),
		field.String("token_family").
			NotEmpty().
			MaxLen(64),
		field.Bool("is_used").
			Default(false),
	}
}

// Edges of the Session.
func (Session) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("sessions").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (Session) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
		index.Fields("token_family"),
	}
}
