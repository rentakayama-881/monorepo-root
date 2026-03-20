package schema

import (
	"regexp"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// FeatureFlag holds the schema definition for the FeatureFlag entity.
type FeatureFlag struct {
	ent.Schema
}

func (FeatureFlag) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "feature_flags"},
	}
}

func (FeatureFlag) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (FeatureFlag) Fields() []ent.Field {
	return []ent.Field{
		field.String("key").
			Unique().
			NotEmpty().
			Match(regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)).
			Comment("Unique feature flag key, kebab-case"),
		field.Bool("enabled").
			Default(false).
			Comment("Whether the feature is globally enabled"),
		field.String("description").
			Optional().
			MaxLen(500),
		field.Int("rollout_percentage").
			Default(100).
			Min(0).
			Max(100).
			Comment("Percentage of users who see this feature (0-100)"),
	}
}

func (FeatureFlag) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("key").Unique(),
		index.Fields("enabled"),
	}
}
