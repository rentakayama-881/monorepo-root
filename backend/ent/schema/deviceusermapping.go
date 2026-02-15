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

// DeviceUserMapping holds the schema definition for the DeviceUserMapping entity.
type DeviceUserMapping struct {
	ent.Schema
}

func (DeviceUserMapping) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "device_user_mappings"},
	}
}

func (DeviceUserMapping) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the DeviceUserMapping.
func (DeviceUserMapping) Fields() []ent.Field {
	return []ent.Field{
		field.String("fingerprint_hash").
			MaxLen(64).
			NotEmpty(),
		field.Int("user_id").
			Positive(),
		field.Time("first_seen_at").
			Default(time.Now),
		field.Time("last_seen_at").
			Default(time.Now),
	}
}

// Edges of the DeviceUserMapping.
func (DeviceUserMapping) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("device_user_mappings").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (DeviceUserMapping) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("fingerprint_hash"),
		// user_id index is auto-created by the edge.From("user") definition
		index.Fields("fingerprint_hash", "user_id").Unique(),
	}
}
