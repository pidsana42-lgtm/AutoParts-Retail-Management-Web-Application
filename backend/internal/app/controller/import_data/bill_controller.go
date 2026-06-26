package import_data

import (
	"net/http"
	"strconv"

	importDataDTO "backend/internal/app/dto/import_data"
	importDataSvc "backend/internal/app/service/import_data"
	"github.com/gin-gonic/gin"
)

type BillController struct {
	svc importDataSvc.ImportBillService
}

func NewBillController(svc importDataSvc.ImportBillService) *BillController {
	return &BillController{svc: svc}
}

func (ctrl *BillController) CreateBill(c *gin.Context) {
	var input importDataDTO.CreateBillDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBill(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *BillController) ListBills(c *gin.Context) {
	res, err := ctrl.svc.ListBills()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *BillController) CreateBillImage(c *gin.Context) {
	var input importDataDTO.CreateBillImageDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBillImage(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill image: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *BillController) CreateBillImportJob(c *gin.Context) {
	var input importDataDTO.CreateBillImportJobDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBillImportJob(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill import job: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully, OCR processing started",
		"data":    res,
	})
}

func (ctrl *BillController) GetBillImportJob(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.GetBillImportJob(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill import job not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *BillController) ConfirmBillImport(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input importDataDTO.ConfirmBillImportDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.ConfirmBillImport(uint(id), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm bill import: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Confirmed successfully",
		"data":    res,
	})
}

func (ctrl *BillController) CreateBillItem(c *gin.Context) {
	var input importDataDTO.CreateBillItemDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBillItem(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}
