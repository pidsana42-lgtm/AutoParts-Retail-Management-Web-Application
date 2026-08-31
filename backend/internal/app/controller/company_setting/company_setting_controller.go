package company_setting

import (
	dto "backend/internal/app/dto/company_setting"
	service "backend/internal/app/service/company_setting"
	"backend/internal/pkg/storage"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type CompanySettingController struct {
	svc service.CompanySettingService
}

func NewCompanySettingController(svc service.CompanySettingService) *CompanySettingController {
	return &CompanySettingController{svc: svc}
}

var allowedLogoMIME = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

func (ctrl *CompanySettingController) GetCompanySetting(c *gin.Context) {
	res, err := ctrl.svc.GetCompanySetting(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *CompanySettingController) UpdateCompanySetting(c *gin.Context) {
	var req dto.CompanySettingReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	res, err := ctrl.svc.UpdateCompanySetting(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "บันทึกข้อมูลร้านค้าสำเร็จ",
		"data":    res,
	})
}

func (ctrl *CompanySettingController) UploadLogo(c *gin.Context) {
	file, header, err := c.Request.FormFile("logo")
	if err != nil {
		file, header, err = c.Request.FormFile("file")
	}
	if err != nil {
		file, header, err = c.Request.FormFile("image")
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบไฟล์รูปภาพในฟิลด์ 'logo', 'file' หรือ 'image'"})
		return
	}
	defer file.Close()

	if header.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไฟล์ขนาดเกิน 5MB"})
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "อ่านไฟล์ไม่ได้"})
		return
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}

	if !allowedLogoMIME[mimeType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รองรับเฉพาะไฟล์ภาพ (JPEG, PNG, WEBP, GIF)"})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".png"
	}
	filename := fmt.Sprintf("logo_%d%s", time.Now().UnixNano(), ext)

	publicURL, err := storage.UploadCompanyLogo(filename, mimeType, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "อัปโหลดโลโก้สำเร็จ",
		"url":      publicURL,
		"logo_url": publicURL,
		"filename": filename,
	})
}
