package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ChainCursor holds the schema definition for the ChainCursor entity.
type ChainCursor struct {
	ent.Schema
}

func (ChainCursor) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "chain_cursors"},
	}
}

// Fields of the ChainCursor.
func (ChainCursor) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			MaxLen(64).
			NotEmpty(),
		field.Uint64("chain_id"),
		field.Uint64("last_processed").
			Default(0),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

// Edges of the ChainCursor.
func (ChainCursor) Edges() []ent.Edge {
	return nil
}

func (ChainCursor) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("name", "chain_id").Unique(),
	}
}
