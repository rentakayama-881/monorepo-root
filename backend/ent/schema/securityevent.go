package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// SecurityEvent holds the schema definition for the SecurityEvent entity.
type SecurityEvent struct {
	ent.Schema
}

func (SecurityEvent) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "security_events"},
	}
}

func (SecurityEvent) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the SecurityEvent.
func (SecurityEvent) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Optional().
			Nillable(),
		field.String("email").
			MaxLen(255).
			Optional().
			Default(""),
		field.String("event_type").
			MaxLen(50).
			NotEmpty(),
		field.String("ip_address").
			Optional().
			MaxLen(45),
		field.String("user_agent").
			Optional().
			MaxLen(512),
		field.Bool("success").
			Default(false),
		field.Text("details").
			Optional().
			Default(""),
		field.String("severity").
			Optional().
			MaxLen(20).
			Default("info"),
	}
}

// Edges of the SecurityEvent.
func (SecurityEvent) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("security_events").
			Field("user_id").
			Unique(),
	}
}

func (SecurityEvent) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
		index.Fields("email"),
		index.Fields("event_type"),
	}
}
