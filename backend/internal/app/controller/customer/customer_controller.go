package customer

import (
	"net/http"
	customerDto "backend/internal/app/dto/customer" 
	customerSvc "backend/internal/app/service/customer"
	"github.com/gin-gonic/gin"
	"strconv"
)

type CustomerController struct {
	svc customerSvc.CustomerService
}

func NewCustomerController(svc customerSvc.CustomerService) *CustomerController {
	return &CustomerController{svc: svc}
}

func (ctrl *CustomerController) RegisterCustomer(c *gin.Context) {
	var req customerDto.RegisterCustomerRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูล JSON ไม่ถูกต้อง: " + err.Error()})
		return
	}
	
	idCardImagePath := ""

	if err := ctrl.svc.RegisterNewCustomer(req, idCardImagePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "ลงทะเบียนสมาชิกใหม่สำเร็จเรียบร้อยแล้ว"})
}

func (ctrl *CustomerController) GetAllCustomers(c *gin.Context) {
	customers, err := ctrl.svc.GetAllCustomers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, customers)
}

func (ctrl *CustomerController) GetCustomerByID(c *gin.Context) {
    idStr := c.Param("id")
    
    id, err := strconv.ParseUint(idStr, 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ ID ลูกค้าไม่ถูกต้อง"})
        return
    }

    customer, err := ctrl.svc.GetCustomerByID(uint(id))
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลสมาชิกคนนี้ในระบบ: " + err.Error()})
        return
    }

    c.JSON(http.StatusOK, customer)
}
