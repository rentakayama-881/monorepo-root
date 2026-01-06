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

// UserBadge holds the schema definition for the UserBadge entity.
type UserBadge struct {
	ent.Schema
}

func (UserBadge) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "user_badges"},
	}
}

func (UserBadge) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the UserBadge.
func (UserBadge) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.Int("badge_id").
			Positive(),
		field.Text("reason").
			Optional().
			Default(""),
		field.Int("granted_by").
			Positive(),
		field.Time("granted_at").
			Default(time.Now),
		field.Time("revoked_at").
			Optional().
			Nillable(),
		field.Text("revoke_reason").
			Optional().
			Default(""),
	}
}

// Edges of the UserBadge.
func (UserBadge) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("user_badges").
			Field("user_id").
			Required().
			Unique(),
		edge.From("badge", Badge.Type).
			Ref("user_badges").
			Field("badge_id").
			Required().
			Unique(),
		edge.From("admin", Admin.Type).
			Ref("granted_badges").
			Field("granted_by").
			Required().
			Unique(),
	}
}

func (UserBadge) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
		index.Fields("badge_id"),
	}
}
