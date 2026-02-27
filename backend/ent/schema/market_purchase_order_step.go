package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// MarketPurchaseOrderStep stores execution timeline entries for market orders.
type MarketPurchaseOrderStep struct {
	ent.Schema
}

func (MarketPurchaseOrderStep) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "market_purchase_order_steps"},
	}
}

func (MarketPurchaseOrderStep) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeMixin{}}
}

func (MarketPurchaseOrderStep) Fields() []ent.Field {
	return []ent.Field{
		field.String("order_id").
			MaxLen(128).
			NotEmpty(),
		field.String("code").
			MaxLen(64).
			NotEmpty(),
		field.String("label").
			MaxLen(255).
			NotEmpty(),
		field.String("status").
			MaxLen(32).
			NotEmpty(),
		field.String("message").
			MaxLen(1024).
			Optional().
			Default(""),
		field.Time("at"),
	}
}

func (MarketPurchaseOrderStep) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("order_id", "at"),
		index.Fields("order_id", "created_at"),
	}
}
