package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// MarketPurchaseOrder stores user-facing marketplace order state persistently.
type MarketPurchaseOrder struct {
	ent.Schema
}

func (MarketPurchaseOrder) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "market_purchase_orders"},
	}
}

func (MarketPurchaseOrder) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeMixin{}}
}

func (MarketPurchaseOrder) Fields() []ent.Field {
	return []ent.Field{
		field.String("order_id").
			NotEmpty().
			Unique(),
		field.Int("user_id").
			Positive(),
		field.String("item_id").
			MaxLen(128).
			NotEmpty(),
		field.String("title").
			MaxLen(512).
			Optional().
			Default(""),
		field.String("price").
			MaxLen(64).
			Optional().
			Default(""),
		field.String("status").
			MaxLen(32).
			Default("processing"),
		field.String("seller").
			MaxLen(255).
			Optional().
			Default(""),
		field.String("failure_reason").
			MaxLen(1024).
			Optional().
			Default(""),
		field.String("failure_code").
			MaxLen(128).
			Optional().
			Default(""),
		field.JSON("delivery_json", map[string]interface{}{}).
			Optional(),
		field.Float("source_price").
			Optional().
			Default(0),
		field.String("source_currency").
			MaxLen(16).
			Optional().
			Default(""),
		field.String("source_symbol").
			MaxLen(8).
			Optional().
			Default(""),
		field.Int64("price_idr").
			Optional().
			Default(0),
		field.Float("fx_rate_to_idr").
			Optional().
			Default(0),
		field.String("price_display").
			MaxLen(64).
			Optional().
			Default(""),
		field.String("source_display").
			MaxLen(128).
			Optional().
			Default(""),
		field.String("pricing_note").
			MaxLen(255).
			Optional().
			Default(""),
		field.String("last_step_code").
			MaxLen(64).
			Optional().
			Default(""),
		field.String("supplier_currency").
			MaxLen(16).
			Optional().
			Default(""),
	}
}

func (MarketPurchaseOrder) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("order_id").Unique(),
		index.Fields("user_id", "created_at"),
		index.Fields("user_id", "status", "created_at"),
	}
}
