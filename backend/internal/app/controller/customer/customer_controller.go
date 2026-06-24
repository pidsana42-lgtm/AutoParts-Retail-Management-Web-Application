package customer

import (
	"net/http"
	"path/filepath" // import ตัวนี้เพื่อใช้สกัดชื่อไฟล์
	customerDto "backend/internal/app/dto/customer" 
	customerSvc "backend/internal/app/service/customer"
	"github.com/gin-gonic/gin"
)

type CustomerController struct {
	svc customerSvc.CustomerService
}

func NewCustomerController(svc customerSvc.CustomerService) *CustomerController {
	return &CustomerController{svc: svc}
}

func (ctrl *CustomerController) RegisterCustomer(c *gin.Context) {
	var req customerDto.RegisterCustomerRequest

	req.CustomerName = c.PostForm("customer_name")
	req.CustomerType = c.PostForm("customer_type")
	req.PhoneNumber = c.PostForm("phone_number")
	req.IdCardNumberCustomer = c.PostForm("id_card_number")
	req.RegisteredAddress = c.PostForm("registered_address")
	req.ShippingAddress = c.PostForm("shipping_address")

	file, err := c.FormFile("id_card_image")
	idCardImagePath := ""

	if err == nil {
		// เปลี่ยนแปลงไฟล์ดิบให้กลายเป็น Path String นิ่งๆ ในโฟลเดอร์เครื่อง
		idCardImagePath = "uploads/id_cards/" + filepath.Base(file.Filename)
		if err := c.SaveUploadedFile(file, "./"+idCardImagePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "บันทึกไฟล์รูปภาพลงเซิร์ฟเวอร์ไม่สำเร็จ"})
			return
		}
	}

	// 3. ส่งต่อข้อความ Path รูปและ DTO ให้ชั้น Service สั่งงานต่อ
	if err := ctrl.svc.RegisterNewCustomer(req, idCardImagePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "ลงทะเบียนสมาชิกใหม่สำเร็จเรียบร้อยแล้วค่ะ"})
}
