package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Tag holds the schema definition for the Tag entity.
type Tag struct {
	ent.Schema
}

func (Tag) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "tags"},
	}
}

func (Tag) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Tag.
func (Tag) Fields() []ent.Field {
	return []ent.Field{
		field.String("slug").
			NotEmpty().
			Unique(),
		field.String("name").
			NotEmpty(),
		field.String("description").
			Optional().
			Default(""),
		field.String("color").
			Optional().
			Default("#1f6feb"), // GitHub blue default
		field.String("icon").
			Optional().
			Default(""),
		field.Bool("is_active").
			Default(true),
		field.Int("order").
			Default(0),
	}
}

// Edges of the Tag.
func (Tag) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("threads", Thread.Type),
	}
}

func (Tag) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("slug").
			Unique(),
		index.Fields("is_active"),
		index.Fields("order"),
	}
}
