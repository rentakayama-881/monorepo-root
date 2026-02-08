package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// ThreadCredential stores a peer-validated credential (upvote) given by a user to a thread.
// Table: "thread_credentials"
type ThreadCredential struct {
	ent.Schema
}

func (ThreadCredential) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "thread_credentials"},
	}
}

func (ThreadCredential) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

func (ThreadCredential) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.Int("thread_id").
			Positive(),
	}
}

func (ThreadCredential) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("given_credentials").
			Field("user_id").
			Required().
			Unique(),
		edge.From("thread", Thread.Type).
			Ref("received_credentials").
			Field("thread_id").
			Required().
			Unique(),
	}
}

func (ThreadCredential) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "thread_id").Unique(),
		index.Fields("thread_id"),
		index.Fields("user_id"),
	}
}
