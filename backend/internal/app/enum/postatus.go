package enum

type POStatus string

const (
	StatusDraft    POStatus = "DRAFT"
	StatusPending  POStatus = "PENDING"
	StatusApproved POStatus = "APPROVED"
	StatusRejected POStatus = "REJECTED"
)