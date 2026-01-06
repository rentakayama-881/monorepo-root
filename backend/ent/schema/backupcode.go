package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// BackupCode holds the schema definition for the BackupCode entity.
type BackupCode struct {
	ent.Schema
}

func (BackupCode) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "backup_codes"},
	}
}

func (BackupCode) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the BackupCode.
func (BackupCode) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.String("code_hash").
			NotEmpty().
			Sensitive(),
		field.Time("used_at").
			Optional().
			Nillable(),
	}
}

// Edges of the BackupCode.
func (BackupCode) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("backup_codes").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (BackupCode) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
	}
}
