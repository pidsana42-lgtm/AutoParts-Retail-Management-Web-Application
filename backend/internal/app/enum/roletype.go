package enum

type RoleType string

const (
	RoleOwner    RoleType = "Owner"
	RoleEmployee RoleType = "Employee"
	RoleManager  RoleType = "Manager"
	RoleAdmin    RoleType = RoleManager
)
