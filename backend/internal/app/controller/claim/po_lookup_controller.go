package claim

import (
	"net/http"

	claimDto "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"

	"github.com/gin-gonic/gin"
)

type POLookupController struct {
	repo claimRepo.POLookupRepository
}

func NewPOLookupController(repo claimRepo.POLookupRepository) *POLookupController {
	return &POLookupController{repo: repo}
}

func (ctrl *POLookupController) GetByPONumber(c *gin.Context) {
	poNumber := c.Param("number")
	if poNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PO number is required"})
		return
	}

	po, err := ctrl.repo.GetPOByNumber(poNumber)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "purchase order not found"})
		return
	}

	items := make([]claimDto.POItemLookupDTO, 0, len(po.PO_Items))
	for _, item := range po.PO_Items {
		items = append(items, claimDto.POItemLookupDTO{
			ProductID:         item.ProductID,
			ProductName:       item.Product_name_snapshot,
			SupplyProductCode: item.Supply_product_code_snapshot,
			Quantity:          item.Quantity,
			Unit:              item.Unit,
			UnitPrice:         item.UnitPrice,
			SubTotal:          item.SubTotal,
		})
	}

	res := claimDto.POLookupDTO{
		ID:           po.ID,
		PONumber:     po.PO_number,
		Status:       string(po.Status),
		TotalAmount:  po.Total_amount,
		SupplierID:   po.SupplierID,
		SupplierName: po.Supplier.SupplierName,
		Items:        items,
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}
