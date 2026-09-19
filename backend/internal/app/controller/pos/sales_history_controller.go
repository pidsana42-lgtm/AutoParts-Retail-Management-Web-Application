package pos

import (
	"backend/internal/app/dto/pos"
	salesHistorySvc "backend/internal/app/service/pos"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type SalesHistoryController struct {
	salesHistoryService salesHistorySvc.SalesHistoryService
}

func NewSalesHistoryController(salesHistoryService salesHistorySvc.SalesHistoryService) *SalesHistoryController {
	return &SalesHistoryController{salesHistoryService: salesHistoryService}
}

func (c *SalesHistoryController) GetSalesHistory(ctx *gin.Context) {
	var req pos.SalesHistoryFilterRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "รูปแบบ Query Parameter ไม่ถูกต้อง",
			"error":   err.Error(),
		})
		return
	}

	// เช็คบทบาท (Role) ของผู้ใช้งานจาก Context
	roleVal, exists := ctx.Get("role")
	var isOwnerOrManager bool
	if exists {
		roleStr, ok := roleVal.(string)
		if ok && (roleStr == "Owner" || roleStr == "Manager" || roleStr == "Admin") {
			isOwnerOrManager = true
		}
	}

	// ถ้าเป็นพนักงาน/แคชเชียร์ธรรมดา ให้เห็นเฉพาะออเดอร์ที่ตนเองขาย (ล็อกค่า EmployeeID)
	if !isOwnerOrManager {
		userIDVal, exists := ctx.Get("user_id")
		if exists {
			var userID uint
			switch v := userIDVal.(type) {
			case float64:
				userID = uint(v)
			case uint:
				userID = v
			case int:
				userID = uint(v)
			case int64:
				userID = uint(v)
			}
			if userID > 0 {
				req.EmployeeID = userID
			}
		} else {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"message": "ไม่พบข้อมูลสิทธิ์ของผู้ใช้งานในระบบ",
			})
			return
		}
	}

	result, err := c.salesHistoryService.GetSalesHistory(req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ไม่สามารถดึงประวัติการขายได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงประวัติการขายสำเร็จ",
		"data":    result,
	})
}

func (c *SalesHistoryController) GetSaleHistoryByID(ctx *gin.Context) {
	identifier := ctx.Param("id")
	if identifier == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "กรุณาระบุรหัสรายการขายหรือเลขที่ใบเสร็จ",
			"error":   "Identifier parameter is required",
		})
		return
	}

	reqCtx := ctx.Request.Context()
	result, err := c.salesHistoryService.GetSaleHistoryByID(reqCtx, identifier)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ไม่สามารถดึงข้อมูลรายละเอียดรายการขายได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงข้อมูลรายละเอียดรายการขายสำเร็จ",
		"data":    result,
	})
}

// พนักงานส่งคำขอยกเลิก
func (c *SalesHistoryController) RequestCancelSale(ctx *gin.Context) {
	identifier := ctx.Param("id")

	// ดึง userID ของผู้ใช้งานที่ทำรายการ
	userIDFloat, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"message": "ไม่พบข้อมูลพนักงานในระบบ",
		})
		return
	}
	userID := uint(userIDFloat.(float64))

	var req pos.RequestCancelOrderRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "กรุณาระบุเหตุผลในการขอยกเลิก",
			"error":   err.Error(),
		})
		return
	}

	// ส่ง userID ต่อให้ Service
	if err := c.salesHistoryService.RequestCancelSale(ctx.Request.Context(), identifier, userID, req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "ไม่สามารถส่งคำขอยกเลิกรายการได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ส่งคำขอยกเลิกรายการสำเร็จ รอการอนุมัติจากเจ้าของร้าน",
	})
}

// เจ้าของร้านอนุมัติ
func (c *SalesHistoryController) ApproveCancelSale(ctx *gin.Context) {
	identifier := ctx.Param("id")
	var req pos.ProcessCancelOrderRequest
	_ = ctx.ShouldBindJSON(&req)

	userIDVal, exists := ctx.Get("user_id")
	var userID uint
	if exists {
		switch v := userIDVal.(type) {
		case float64:
			userID = uint(v)
		case uint:
			userID = v
		case int:
			userID = uint(v)
		case int64:
			userID = uint(v)
		}
	}

	if err := c.salesHistoryService.ApproveCancelSale(ctx.Request.Context(), identifier, userID, req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "ไม่สามารถอนุมัติการยกเลิกได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "อนุมัติการยกเลิกรายการและคืนสต็อกสินค้าเรียบร้อยแล้ว",
	})
}

// เจ้าของร้านปฏิเสธ
func (c *SalesHistoryController) RejectCancelSale(ctx *gin.Context) {
	identifier := ctx.Param("id")
	var req pos.ProcessCancelOrderRequest
	_ = ctx.ShouldBindJSON(&req)

	if err := c.salesHistoryService.RejectCancelSale(ctx.Request.Context(), identifier, req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "ไม่สามารถปฏิเสธการยกเลิกได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ปฏิเสธคำขอยกเลิกรายการเรียบร้อยแล้ว",
	})
}

func (c *SalesHistoryController) GetCancellationRequests(ctx *gin.Context) {
	var req pos.SalesHistoryFilterRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "รูปแบบ Query Parameter ไม่ถูกต้อง",
			"error":   err.Error(),
		})
		return
	}

	result, err := c.salesHistoryService.GetCancellationRequests(ctx.Request.Context(), req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ไม่สามารถดึงข้อมูลรายการคำขอยกเลิกได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงข้อมูลรายการคำขอยกเลิกสำเร็จ",
		"data":    result,
	})
}

func (c *SalesHistoryController) GetMyCancellationRequests(ctx *gin.Context) {
	log.Printf("DEBUG context keys: user_id=%v", ctx.Value("user_id"))
	userIDVal, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"message": "ไม่พบข้อมูลพนักงานในระบบ",
		})
		return
	}

	//  ป้องกันเรื่อง Type Mismatch จาก JWT Claim ต่างๆ
	var userID uint
	switch v := userIDVal.(type) {
	case float64:
		userID = uint(v)
	case uint:
		userID = v
	case int:
		userID = uint(v)
	case int64:
		userID = uint(v)
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ชนิดข้อมูล user_id ไม่ถูกต้อง",
		})
		return
	}

	var req pos.SalesHistoryFilterRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "รูปแบบ Query Parameter ไม่ถูกต้อง",
			"error":   err.Error(),
		})
		return
	}

	result, err := c.salesHistoryService.GetMyCancellationRequests(ctx.Request.Context(), userID, req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ไม่สามารถดึงข้อมูลรายการคำขอยกเลิกของฉันได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงข้อมูลรายการคำขอยกเลิกของฉันสำเร็จ",
		"data":    result,
	})
}

func (c *SalesHistoryController) RevertCancellationRequest(ctx *gin.Context) {
	identifier := ctx.Param("id") // อ่าน identifier จาก URL Parameter
	if identifier == "" {         // ตรวจสอบว่ามีการส่ง identifier มาหรือไม่
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "กรุณาระบุรหัสรายการขายหรือเลขที่ใบเสร็จ",
			"error":   "Identifier parameter is required",
		})
		return
	}

	// ดึง userID ของผู้ใช้งานที่ทำรายการ
	userIDVal, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"message": "ไม่พบข้อมูลพนักงานในระบบ",
		})
		return
	}

	var userID uint
	switch v := userIDVal.(type) {
	case float64:
		userID = uint(v)
	case uint:
		userID = v
	case int:
		userID = uint(v)
	case int64:
		userID = uint(v)
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ชนิดข้อมูล user_id ไม่ถูกต้อง",
		})
		return
	}

	// เรียกใช้ Service เพื่อให้ไปประมวลผลการดึงคำขอยกเลิกบิลกลับ
	res, err := c.salesHistoryService.RevertCancellationRequest(ctx.Request.Context(), identifier, userID)
	// ถ้ามี error เกิดขึ้น ให้ส่ง response กลับไปยัง client ว่าเกิดข้อผิดพลาด
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงคำขอยกเลิกบิลกลับสำเร็จ",
		"data":    res,
	})
}

func (c *SalesHistoryController) GetEmployees(ctx *gin.Context) {
	res, err := c.salesHistoryService.GetEmployees(ctx.Request.Context())
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var out []map[string]interface{}
	for _, u := range res {
		out = append(out, map[string]interface{}{
			"id":         u.ID,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"full_name":  u.FirstName + " " + u.LastName,
		})
	}
	ctx.JSON(http.StatusOK, out)
}

func (c *SalesHistoryController) PrintSaleOrder(ctx *gin.Context) {
	identifier := ctx.Param("id")
	if identifier == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Missing order ID"})
		return
	}

	docTitle := ctx.DefaultQuery("title", "")

	pdfBytes, err := c.salesHistoryService.GenerateSaleOrderPDF(ctx.Request.Context(), identifier, docTitle)
	if err != nil {
		log.Printf("PDF Generation Error: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate receipt PDF: " + err.Error()})
		return
	}

	fileName := identifier
	if !strings.HasPrefix(fileName, "INV") && !strings.HasPrefix(fileName, "Receipt-") {
		fileName = fmt.Sprintf("INV%s", fileName)
	}
	if !strings.HasSuffix(fileName, ".pdf") {
		fileName = fmt.Sprintf("%s.pdf", fileName)
	}

	ctx.Header("Content-Type", "application/pdf")
	ctx.Header("Content-Disposition", fmt.Sprintf("inline; filename=%s", fileName))
	ctx.Data(http.StatusOK, "application/pdf", pdfBytes)
}
