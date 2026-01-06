package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Passkey holds the schema definition for the Passkey entity.
type Passkey struct {
	ent.Schema
}

func (Passkey) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "passkeys"},
	}
}

func (Passkey) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the Passkey.
func (Passkey) Fields() []ent.Field {
	return []ent.Field{
		field.Int("user_id").
			Positive(),
		field.Bytes("credential_id").
			Unique().
			NotEmpty(),
		field.Bytes("public_key").
			NotEmpty(),
		field.String("attestation_type").
			NotEmpty(),
		field.Bytes("aaguid").
			Optional(),
		field.Uint32("sign_count").
			Default(0),
		field.Bool("backup_eligible").
			Default(false),
		field.Bool("backup_state").
			Default(false),
		field.String("name").
			Default("Passkey"),
		field.Time("last_used_at").
			Optional().
			Nillable(),
		field.JSON("transports", []string{}).
			Optional(),
	}
}

// Edges of the Passkey.
func (Passkey) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).
			Ref("passkeys").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (Passkey) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id"),
		index.Fields("credential_id").Unique(),
	}
}
