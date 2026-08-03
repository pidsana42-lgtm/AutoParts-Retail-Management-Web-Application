package claim

import (
	"net/http"

	claimDto "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"

	"github.com/gin-gonic/gin"
)

type SaleOrderLookupController struct {
	repo claimRepo.SaleOrderLookupRepository
}

func NewSaleOrderLookupController(repo claimRepo.SaleOrderLookupRepository) *SaleOrderLookupController {
	return &SaleOrderLookupController{repo: repo}
}

func (ctrl *SaleOrderLookupController) GetByOrderNumber(c *gin.Context) {
	orderNumber := c.Param("number")
	if orderNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order number is required"})
		return
	}

	order, err := ctrl.repo.GetSaleOrderByNumber(orderNumber)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "sale order not found"})
		return
	}

	customerName := ""
	customerPhone := ""
	if order.Customer.ID != 0 {
		customerName = order.Customer.CustomerName
		customerPhone = order.Customer.PhoneNumber
	}
	if order.CustomerNameTemp != nil && *order.CustomerNameTemp != "" {
		customerName = *order.CustomerNameTemp
	}
	if order.CustomerPhoneTemp != nil && *order.CustomerPhoneTemp != "" {
		customerPhone = *order.CustomerPhoneTemp
	}

	items := make([]claimDto.SaleOrderItemLookupDTO, 0, len(order.Items))
	for _, item := range order.Items {
		items = append(items, claimDto.SaleOrderItemLookupDTO{
			ProductID:   item.ProductID,
			ProductName: item.ProductName,
			PartNumber:  item.PartNumber,
			Qty:         item.Qty,
			Unit:        item.Unit,
			UnitPrice:   item.UnitPrice,
			Subtotal:    item.Subtotal,
		})
	}

	res := claimDto.SaleOrderLookupDTO{
		ID:            order.ID,
		OrderNumber:   order.OrderNumber,
		OrderDate:     order.OrderDate,
		CustomerID:    order.CustomerID,
		CustomerName:  customerName,
		CustomerPhone: customerPhone,
		TotalAmount:   order.TotalAmount,
		Status:        string(order.Status),
		Items:         items,
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *SaleOrderLookupController) SearchSaleOrders(c *gin.Context) {
	q := c.Query("q")
	if len([]rune(q)) < 2 {
		c.JSON(http.StatusOK, gin.H{"data": []claimDto.SaleOrderLookupDTO{}})
		return
	}

	orders, err := ctrl.repo.SearchSaleOrders(q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	results := make([]claimDto.SaleOrderLookupDTO, 0, len(orders))
	for _, order := range orders {
		customerName := ""
		customerPhone := ""
		if order.Customer.ID != 0 {
			customerName = order.Customer.CustomerName
			customerPhone = order.Customer.PhoneNumber
		}
		if order.CustomerNameTemp != nil && *order.CustomerNameTemp != "" {
			customerName = *order.CustomerNameTemp
		}
		if order.CustomerPhoneTemp != nil && *order.CustomerPhoneTemp != "" {
			customerPhone = *order.CustomerPhoneTemp
		}

		items := make([]claimDto.SaleOrderItemLookupDTO, 0, len(order.Items))
		for _, item := range order.Items {
			items = append(items, claimDto.SaleOrderItemLookupDTO{
				ProductID:   item.ProductID,
				ProductName: item.ProductName,
				PartNumber:  item.PartNumber,
				Qty:         item.Qty,
				Unit:        item.Unit,
				UnitPrice:   item.UnitPrice,
				Subtotal:    item.Subtotal,
			})
		}

		results = append(results, claimDto.SaleOrderLookupDTO{
			ID:            order.ID,
			OrderNumber:   order.OrderNumber,
			OrderDate:     order.OrderDate,
			CustomerID:    order.CustomerID,
			CustomerName:  customerName,
			CustomerPhone: customerPhone,
			TotalAmount:   order.TotalAmount,
			Status:        string(order.Status),
			Items:         items,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}
