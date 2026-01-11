package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Thread holds the schema definition for the Thread entity.
type Thread struct {
	ent.Schema
}

func (Thread) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "threads"},
	}
}

func (Thread) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Thread.
func (Thread) Fields() []ent.Field {
	return []ent.Field{
		field.Int("category_id").
			Positive(),
		field.Int("user_id").
			Positive(),
		field.String("title").
			NotEmpty(),
		field.String("summary").
			Optional().
			Default(""),
		field.String("content_type").
			MaxLen(32).
			Default("table"),
		field.JSON("content_json", map[string]interface{}{}).
			Optional(),
		field.JSON("meta", map[string]interface{}{}).
			Optional(),
	}
}

// Edges of the Thread.
func (Thread) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("threads").
			Field("user_id").
			Required().
			Unique(),
		edge.From("category", Category.Type).
			Ref("threads").
			Field("category_id").
			Required().
			Unique(),
		edge.From("tags", Tag.Type).
			Ref("threads"),
	}
}

func (Thread) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("category_id"),
		index.Fields("user_id"),
	}
}
