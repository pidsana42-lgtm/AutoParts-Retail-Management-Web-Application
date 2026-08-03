package claim

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"backend/internal/pkg/storage"

	"github.com/gin-gonic/gin"
)

type EvidenceUploadController struct{}

func NewEvidenceUploadController() *EvidenceUploadController {
	return &EvidenceUploadController{}
}

var allowedMIME = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

func (ctrl *EvidenceUploadController) UploadEvidence(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่พบไฟล์ในฟิลด์ 'file'"})
		return
	}
	defer file.Close()

	if header.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไฟล์ขนาดเกิน 5MB"})
		return
	}

	mimeType := header.Header.Get("Content-Type")
	if !allowedMIME[mimeType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รองรับเฉพาะไฟล์ภาพ (JPEG, PNG, WEBP, GIF)"})
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "อ่านไฟล์ไม่ได้"})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	filename := fmt.Sprintf("claim_%d%s", time.Now().UnixNano(), ext)

	publicURL, err := storage.UploadClaimEvidence(filename, mimeType, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": publicURL, "filename": filename})
}
