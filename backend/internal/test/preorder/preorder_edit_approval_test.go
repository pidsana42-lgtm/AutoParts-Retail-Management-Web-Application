package preorder

import (
	"context"
	"errors"
	"testing"

	dto "backend/internal/app/dto/pre_oder"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"github.com/stretchr/testify/require"
)

func TestBookingEditRequiresUnapprovedStatus(t *testing.T) {
	for _, status := range []string{"PENDING", "PO_PENDING", "PO_DRAFT", "ORDERED", "READY", "PARTIALLY_RECEIVED", "COMPLETED", "CANCELLED"} {
		t.Run(status, func(t *testing.T) {
			repo := newMockRepo()
			existing := samplePreOrderEntity(5, status, entity.PreOrderItem{Quantity: 1})
			repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) { return &existing, nil }
			channel := "LINE"
			_, err := newService(repo).UpdatePreOrder(5, dto.UpdatePreOrderDTO{PreOrderType: &channel})
			if status == "PENDING" || status == "PO_PENDING" || status == "PO_DRAFT" {
				require.NoError(t, err)
				require.Equal(t, 1, repo.called["UpdatePreOrder"])
			} else {
				require.Error(t, err)
				require.Zero(t, repo.called["UpdatePreOrder"])
			}
		})
	}
}

func TestApprovedBookingCannotCreateCustomerDuringEdit(t *testing.T) {
	repo := newMockRepo()
	existing := samplePreOrderEntity(5, "PENDING", entity.PreOrderItem{Quantity: 1})
	repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) { return &existing, nil }
	repo.getLinkedPOsFn = func(context.Context, []uint) (map[uint]entity.PO, error) {
		return map[uint]entity.PO{1: {Status: enum.POStatus("APPROVED")}}, nil
	}
	customerID := uint(0)
	name := "ลูกค้าใหม่"
	_, err := newService(repo).UpdatePreOrder(5, dto.UpdatePreOrderDTO{CustomerID: &customerID, CustomerName: &name})
	require.ErrorContains(t, err, "อนุมัติแล้ว")
	require.Zero(t, repo.called["FindOrCreateCustomerByName"])
	require.Zero(t, repo.called["UpdatePreOrder"])
}

func TestBookingEditFailsClosedIfApprovalLookupFails(t *testing.T) {
	repo := newMockRepo()
	existing := samplePreOrderEntity(5, "PENDING", entity.PreOrderItem{Quantity: 1})
	repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) { return &existing, nil }
	repo.getLinkedPOsFn = func(context.Context, []uint) (map[uint]entity.PO, error) { return nil, errors.New("lookup failed") }
	channel := "LINE"
	_, err := newService(repo).UpdatePreOrder(5, dto.UpdatePreOrderDTO{PreOrderType: &channel})
	require.ErrorContains(t, err, "lookup failed")
	require.Zero(t, repo.called["UpdatePreOrder"])
}
