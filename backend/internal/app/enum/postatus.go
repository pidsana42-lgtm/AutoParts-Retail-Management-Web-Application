package enum

type POStatus string

const (
	StatusDraft       POStatus = "DRAFT"
	StatusPending     POStatus = "PENDING"
	StatusApproved    POStatus = "APPROVED"
	StatusDeleted     POStatus = "DELETED"
	StatusCancelled   POStatus = "CANCELLED"
	StatusResubmitted POStatus = "RESUBMITTED"
	// StatusReceived: set automatically once every line item on the PO has been fully
	// received via bill import — never assignable through UpdatePOStatus.
	StatusReceived POStatus = "RECEIVED"
)