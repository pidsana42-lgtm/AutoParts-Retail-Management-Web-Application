package pos

import (
    customerdiscountDto "backend/internal/app/dto/pos"
    customerdiscountRepo "backend/internal/app/repository/pos"
)

type CustomerDiscountService interface { 
    GetCustomerDiscount(searchQuery string) ([]*customerdiscountDto.GetCustomerDiscountResponse, error)
    BulkUpdateCustomerDiscounts(req *customerdiscountDto.BulkUpdateCustomerDiscountRequest) error
}

type customerDiscountService struct {
    repo customerdiscountRepo.CustomerDiscountRepository
}

func NewCustomerDiscountService(repo customerdiscountRepo.CustomerDiscountRepository) CustomerDiscountService {
    return &customerDiscountService{repo: repo}
}

func (s *customerDiscountService) GetCustomerDiscount(searchQuery string) ([]*customerdiscountDto.GetCustomerDiscountResponse, error) {
    var customerDiscounts []*customerdiscountDto.GetCustomerDiscountResponse

    customers, err := s.repo.SearchCustomers(searchQuery)
    if err != nil {
        return nil, err
    }

    for i := range customers {
        customerDiscount := customerdiscountDto.ToCustomerDiscountResponse(&customers[i])
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