package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Badge holds the schema definition for the Badge entity.
type Badge struct {
	ent.Schema
}

func (Badge) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "badges"},
	}
}

func (Badge) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Badge.
func (Badge) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			NotEmpty(),
		field.String("slug").
			Unique().
			NotEmpty(),
		field.Text("description").
			Optional().
			Default(""),
		field.String("icon_type").
			Default("verified").
			Comment("Icon type: verified, admin, moderator, contributor, premium, trusted, checkmark"),
		field.String("color").
			Default("#6366f1"),
	}
}

// Edges of the Badge.
func (Badge) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("user_badges", UserBadge.Type),
		edge.From("primary_users", User.Type).
			Ref("primary_badge"),
	}
}

func (Badge) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("slug").Unique(),
	}
}
