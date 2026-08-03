package enum

type OrderStatus string

const (
	OrderPending       OrderStatus = "pending"
	OrderPendingCancel OrderStatus = "pending_cancel"
	OrderCompleted     OrderStatus = "completed"
	OrderCancelled     OrderStatus = "cancelled"
	OrderReturned      OrderStatus = "returned"
	OrderRefunded      OrderStatus = "refunded"
	OrderClaimed       OrderStatus = "claimed"
)
