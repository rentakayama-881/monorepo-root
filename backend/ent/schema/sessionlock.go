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

// SessionLock holds the schema definition for the SessionLock entity.
type SessionLock struct {
	ent.Schema
}

func (SessionLock) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "session_locks"},
	}
}

func (SessionLock) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the SessionLock.
func (SessionLock) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.Time("locked_at").
			Default(time.Now),
		field.Time("unlocked_at").
			Optional().
			Nillable(),
		field.Time("expires_at").
			Default(time.Now),
		field.String("reason").
			NotEmpty().
			MaxLen(255),
		field.String("locked_by").
			Optional().
			MaxLen(50),
	}
}

// Edges of the SessionLock.
func (SessionLock) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("session_locks").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (SessionLock) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id").Unique(),
	}
}
