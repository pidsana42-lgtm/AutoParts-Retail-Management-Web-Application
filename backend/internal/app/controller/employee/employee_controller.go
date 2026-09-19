package employee

import (
	employeeDTO "backend/internal/app/dto/employee"
	employeeService "backend/internal/app/service/employee"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/gin-gonic/gin"
)

type Controller struct {
	service employeeService.Service
}

func NewController(service employeeService.Service) *Controller {
	return &Controller{service: service}
}

func (ctrl *Controller) GetRegistrationMetadata(c *gin.Context) {
	metadata, err := ctrl.service.GetRegistrationMetadata()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลสำหรับลงทะเบียนได้"})
		return
	}
	c.JSON(http.StatusOK, metadata)
}

func (ctrl *Controller) List(c *gin.Context) {
	ownerID, ok := userIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานจากโทเคน"})
		return
	}

	result, err := ctrl.service.ListEmployees(ownerID)
	if err != nil {
		if errors.Is(err, employeeService.ErrOwnerNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดรายชื่อพนักงานได้"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (ctrl *Controller) GetDetails(c *gin.Context) {
	employeeID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || employeeID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสพนักงานไม่ถูกต้อง"})
		return
	}

	var req employeeDTO.VerifyEmployeeDetailsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน"})
		return
	}

	ownerID, ok := userIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานจากโทเคน"})
		return
	}

	details, err := ctrl.service.GetEmployeeDetails(ownerID, uint(employeeID), req.Password)
	if err != nil {
		switch {
		case errors.Is(err, employeeService.ErrInvalidCredentials):
			// Do not return 401 here: the session token is still valid and only the
			// re-authentication password failed.
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case errors.Is(err, employeeService.ErrEmployeeNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, employeeService.ErrOwnerNotFound):
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลพนักงานได้"})
		}
		return
	}

	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(http.StatusOK, details)
}

func (ctrl *Controller) Create(c *gin.Context) {
	var req employeeDTO.CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาตรวจสอบข้อมูลที่กรอกให้ครบถ้วนและถูกต้อง"})
		return
	}

	ownerID, ok := userIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานจากโทเคน"})
		return
	}

	created, err := ctrl.service.CreateEmployee(ownerID, req)
	if err != nil {
		switch {
		case errors.Is(err, employeeService.ErrUsernameExists),
			errors.Is(err, employeeService.ErrIDCardExists),
			errors.Is(err, employeeService.ErrLineUserIDExists):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case errors.Is(err, employeeService.ErrBankNotFound),
			errors.Is(err, employeeService.ErrNameRequired),
			errors.Is(err, employeeService.ErrInvalidUsername),
			errors.Is(err, employeeService.ErrInvalidIDCard),
			errors.Is(err, employeeService.ErrInvalidPassword),
			errors.Is(err, employeeService.ErrInvalidBankAccount):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, employeeService.ErrOwnerNotFound):
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถสร้างบัญชีพนักงานได้ กรุณาลองใหม่อีกครั้ง"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "ลงทะเบียนพนักงานสำเร็จ",
		"data":    created,
	})
}

func (ctrl *Controller) Update(c *gin.Context) {
	employeeID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || employeeID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสพนักงานไม่ถูกต้อง"})
		return
	}
	var req employeeDTO.UpdateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาตรวจสอบข้อมูลที่แก้ไขให้ครบถ้วนและถูกต้อง"})
		return
	}
	ownerID, ok := userIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานจากโทเคน"})
		return
	}
	updated, err := ctrl.service.UpdateEmployee(ownerID, uint(employeeID), req)
	if err != nil {
		switch {
		case errors.Is(err, employeeService.ErrInvalidCredentials):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		case errors.Is(err, employeeService.ErrEmployeeNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, employeeService.ErrBankNotFound), errors.Is(err, employeeService.ErrInvalidRole), errors.Is(err, employeeService.ErrInvalidIDCard), errors.Is(err, employeeService.ErrInvalidBankAccount):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกข้อมูลพนักงานได้"})
		}
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, updated)
}

func (ctrl *Controller) UploadAvatar(c *gin.Context) {
	employeeID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || employeeID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสพนักงานไม่ถูกต้อง"})
		return
	}
	ownerID, ok := userIDFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานจากโทเคน"})
		return
	}
	file, err := c.FormFile("avatar")
	if err != nil || file.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาเลือกไฟล์รูปภาพไม่เกิน 5MB"})
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF"})
		return
	}
	dir := filepath.Join("uploads", "employees")
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเตรียมพื้นที่เก็บรูปภาพได้"})
		return
	}
	filename := uuid.NewString() + ext
	if err := c.SaveUploadedFile(file, filepath.Join(dir, filename)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกรูปภาพได้"})
		return
	}
	path := "/uploads/employees/" + filename
	if err := ctrl.service.SaveEmployeeProfileImage(ownerID, uint(employeeID), path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถผูกรูปภาพกับพนักงานได้"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"profile_image_path": path})
}

func userIDFromContext(c *gin.Context) (uint, bool) {
	value, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	switch id := value.(type) {
	case float64:
		return uint(id), id > 0
	case uint:
		return id, id > 0
	case int:
		return uint(id), id > 0
	default:
		return 0, false
	}
}
