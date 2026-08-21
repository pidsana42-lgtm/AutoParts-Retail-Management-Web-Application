package pos

import (
	"net/http"
	"github.com/gin-gonic/gin"
	posSvc "backend/internal/app/service/pos"
)

type POSProductController struct {
	svc posSvc.POSProductService
}

func NewPOSProductController(svc posSvc.POSProductService) *POSProductController {
	return &POSProductController{svc: svc}
}

func (ctrl *POSProductController) SearchProducts(c *gin.Context) {
	search := c.Query("q")
	if search == "" {
		search = c.Query("search")
	}

	products, err := ctrl.svc.SearchPOSProducts(search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, products)
}