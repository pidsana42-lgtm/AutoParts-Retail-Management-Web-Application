package enum

type POStatus string

const (
	StatusDraft    POStatus = "DRAFT"
	StatusPending  POStatus = "PENDING"
	StatusApproved POStatus = "APPROVED"
	StatusRejected POStatus = "REJECTED"
	StatusExpired  POStatus = "EXPIRED"
	StatusDeleted  POStatus = "DELETED"
)