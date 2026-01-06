package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Admin holds the schema definition for the Admin entity.
type Admin struct {
	ent.Schema
}

func (Admin) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "admins"},
	}
}

func (Admin) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Admin.
func (Admin) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").
			Unique().
			NotEmpty(),
		field.String("password_hash").
			NotEmpty().
			Sensitive(),
		field.String("name").
			NotEmpty(),
	}
}

// Edges of the Admin.
func (Admin) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("granted_badges", UserBadge.Type),
	}
}

func (Admin) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("email").Unique(),
	}
}
