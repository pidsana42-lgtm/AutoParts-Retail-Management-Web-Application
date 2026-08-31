package enum

type ReturnStatus string

const (
	ReturnPending  ReturnStatus = "PENDING"
	ReturnApproved ReturnStatus = "APPROVED"
	ReturnRejected ReturnStatus = "REJECTED"
	ReturnRefunded ReturnStatus = "REFUNDED"
)
