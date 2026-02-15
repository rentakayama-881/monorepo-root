package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// IPGeoCache holds the schema definition for the IPGeoCache entity.
type IPGeoCache struct {
	ent.Schema
}

func (IPGeoCache) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "ip_geo_cache"},
	}
}

func (IPGeoCache) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the IPGeoCache.
func (IPGeoCache) Fields() []ent.Field {
	return []ent.Field{
		field.String("ip_address").
			MaxLen(45).
			NotEmpty().
			Unique(),
		field.String("country_code").
			MaxLen(2).
			Optional(),
		field.String("country_name").
			MaxLen(100).
			Optional(),
		field.String("city").
			MaxLen(100).
			Optional(),
		field.Float("latitude").
			Optional(),
		field.Float("longitude").
			Optional(),
		field.Time("cached_at").
			Default(time.Now),
	}
}

// Edges of the IPGeoCache.
func (IPGeoCache) Edges() []ent.Edge {
	return []ent.Edge{}
}

func (IPGeoCache) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("ip_address"),
		index.Fields("country_code"),
		index.Fields("cached_at"),
	}
}
