package pos

import (
    customerdiscountDto "backend/internal/app/dto/pos"
    customerdiscountRepo "backend/internal/app/repository/pos"
)

type CustomerDiscountService interface {
    GetCustomerDiscount() ([]*customerdiscountDto.GetCustomerDiscountResponse, error)
    BulkUpdateCustomerDiscounts(req *customerdiscountDto.BulkUpdateCustomerDiscountRequest) error
}

type customerDiscountService struct {
    repo customerdiscountRepo.CustomerDiscountRepository
}

func NewCustomerDiscountService(repo customerdiscountRepo.CustomerDiscountRepository) CustomerDiscountService {
    return &customerDiscountService{repo: repo}
}

func (s *customerDiscountService) GetCustomerDiscount() ([]*customerdiscountDto.GetCustomerDiscountResponse, error) {
    var customerDiscounts []*customerdiscountDto.GetCustomerDiscountResponse

    customers, err := s.repo.GetCreditCustomers()
    if err != nil {
        return nil, err
    }

    for _, customer := range customers {
        customerDiscount := customerdiscountDto.ToCustomerDiscountResponse(&customer)
        customerDiscounts = append(customerDiscounts, customerDiscount)
    }

    return customerDiscounts, nil
}

func (s *customerDiscountService) BulkUpdateCustomerDiscounts(req *customerdiscountDto.BulkUpdateCustomerDiscountRequest) error {
    for _, item := range req.DiscountItems {
        
        customer, err := s.repo.GetCreditCustomerByID(item.ID)
        if err != nil {
            return err 
        }

        customer.StandardDiscountRate = item.StandardDiscountRate
        customer.IsDiscountEnabled = item.IsDiscountEnabled

        if err := s.repo.UpdateCustomer(customer); err != nil {
            return err
        }
    }
    return nil
}