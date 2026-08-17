package enum

type POStatus string

const (
	StatusDraft       POStatus = "DRAFT"
	StatusPending     POStatus = "PENDING"
	StatusApproved    POStatus = "APPROVED"
	StatusDeleted     POStatus = "DELETED"
	StatusCancelled   POStatus = "CANCELLED"
	StatusResubmitted POStatus = "RESUBMITTED"
)