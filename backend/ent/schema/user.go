package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"entgo.io/ent/schema/mixin"
)

// TimeMixin adds created_at and updated_at fields
type TimeMixin struct {
	mixin.Schema
}

func (TimeMixin) Fields() []ent.Field {
	return []ent.Field{
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
		field.Time("deleted_at").
			Optional().
			Nillable(),
	}
}

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

func (User) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "users"},
	}
}

func (User) Mixin() []ent.Mixin {
	return []ent.Mixin{
		TimeMixin{},
	}
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.String("email").
			Unique().
			NotEmpty(),
		field.String("username").
			Optional().
			Nillable().
			Unique().
			StorageKey("name"),
		field.String("password_hash").
			NotEmpty().
			Sensitive(),
		field.Bool("email_verified").
			Default(false),
		field.String("avatar_url").
			Optional().
			Default(""),
		field.String("full_name").
			Optional().
			Nillable(),
		field.Text("bio").
			Optional().
			Default(""),
		field.String("pronouns").
			Optional().
			Default(""),
		field.String("company").
			Optional().
			Default(""),
		field.String("telegram").
			Optional().
			Default(""),
		field.JSON("social_accounts", map[string]interface{}{}).
			Optional(),
		field.Int("primary_badge_id").
			Optional().
			Nillable(),
		// TOTP / 2FA fields
		field.String("totp_secret").
			Optional().
			Nillable().
			Sensitive(),
		field.Bool("totp_enabled").
			Default(false),
		field.Bool("totp_verified").
			Default(false),
		field.Time("totp_verified_at").
			Optional().
			Nillable(),
		// Security tracking fields
		field.Int("failed_login_attempts").
			Default(0),
		field.Time("last_failed_at").
			Optional().
			Nillable(),
		field.Time("last_login_at").
			Optional().
			Nillable(),
		field.String("last_login_ip").
			Optional().
			MaxLen(45),
		field.Time("locked_until").
			Optional().
			Nillable(),
		field.String("lock_reason").
			Optional().
			MaxLen(255),
		// Cached from Feature-Service (MongoDB) for fast thread/profile reads
		field.Int64("guarantee_amount").
			Default(0),
	}
}

// Edges of the User.
func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("passkeys", Passkey.Type),
		edge.To("sessions", Session.Type),
		edge.To("backup_codes", BackupCode.Type),
		edge.To("threads", Thread.Type),
		edge.To("user_badges", UserBadge.Type),
		edge.To("session_locks", SessionLock.Type),
		edge.To("email_verification_tokens", EmailVerificationToken.Type),
		edge.To("password_reset_tokens", PasswordResetToken.Type),
		edge.To("credentials", Credential.Type),
		edge.To("totp_pending_tokens", TOTPPendingToken.Type),
		edge.To("security_events", SecurityEvent.Type),
		edge.To("device_fingerprints", DeviceFingerprint.Type),
		edge.To("device_user_mappings", DeviceUserMapping.Type),
		edge.To("sudo_sessions", SudoSession.Type),
		edge.To("given_credentials", ThreadCredential.Type),
		edge.To("primary_badge", Badge.Type).
			Field("primary_badge_id").
			Unique(),
	}
}

func (User) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("email").Unique(),
		index.Fields("username").Unique(),
	}
}
