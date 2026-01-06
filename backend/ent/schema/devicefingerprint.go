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

// DeviceFingerprint holds the schema definition for the DeviceFingerprint entity.
type DeviceFingerprint struct {
	ent.Schema
}

func (DeviceFingerprint) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "device_fingerprints"},
	}
}

func (DeviceFingerprint) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the DeviceFingerprint.
func (DeviceFingerprint) Fields() []ent.Field {
	return []ent.Field{
		field.String("fingerprint_hash").
			Unique().
			MaxLen(64).
			NotEmpty(),
		field.Int("user_id").
			Optional(),
		field.String("ip_address").
			Optional().
			MaxLen(45),
		field.String("user_agent").
			Optional().
			MaxLen(512),
		field.Int("account_count").
			Default(1),
		field.Time("last_seen_at").
			Default(time.Now),
		field.Bool("blocked").
			Default(false),
		field.String("block_reason").
			Optional().
			MaxLen(255),
	}
}

// Edges of the DeviceFingerprint.
func (DeviceFingerprint) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("device_fingerprints").
			Field("user_id").
			Unique(),
	}
}

func (DeviceFingerprint) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("fingerprint_hash").Unique(),
		index.Fields("user_id"),
	}
}
