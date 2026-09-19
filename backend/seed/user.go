package seed

import (
    "backend/internal/app/entity"
    "backend/internal/app/enum"
    "fmt"
    "golang.org/x/crypto/bcrypt" 
    "gorm.io/gorm"
)

func User(db *gorm.DB) error {
    // 1. Seed Bank 
    bank := entity.Bank{BankName: "Kasikorn Bank"}
    if err := db.Where("bank_name = ?", bank.BankName).FirstOrCreate(&bank).Error; err != nil {
        return fmt.Errorf("failed to seed bank: %w", err)
    }

    // 2. ดึงหรือสร้าง StoreConfig ID 1 เพื่อให้ User อ้างอิง Foreign Key ได้
    var storeConfig entity.StoreConfig
    if err := db.Where("id = ?", 1).FirstOrCreate(&storeConfig, entity.StoreConfig{
        MaxCredit:            0,
        MaxOverdueDays:       0,
        MaxExtraDiscountRate: 0,
        SupervisedPin:        "1234",
    }).Error; err != nil {
        return fmt.Errorf("failed to init store config: %w", err)
    }

    // 3. ดึงข้อมูลบทบาท (Role) มารอไว้สำหรับสร้าง User (เอาอันที่สั่งรัน Seed ซ้ำออก)
    var roleOwner, roleEmployee, roleManager entity.Role
    
    if err := db.Where("role_name = ?", enum.RoleOwner).First(&roleOwner).Error; err != nil {
        return fmt.Errorf("failed to fetch role owner: %w", err)
    }
    if err := db.Where("role_name = ?", enum.RoleEmployee).First(&roleEmployee).Error; err != nil {
        return fmt.Errorf("failed to fetch role employee: %w", err)
    }
    if err := db.Where("role_name = ?", enum.RoleManager).First(&roleManager).Error; err != nil {
        return fmt.Errorf("failed to fetch role manager: %w", err)
    }

    // 4. เข้ารหัส Passwords เตรียมไว้ล่วงหน้า
    ownerHashBytes, _ := bcrypt.GenerateFromPassword([]byte("123456"), 10)
    employeeHashBytes, _ := bcrypt.GenerateFromPassword([]byte("employee123"), 10)
    managerHashBytes, _ := bcrypt.GenerateFromPassword([]byte("123456"), 10)

    ownerPasswordHashed := string(ownerHashBytes)
    employeePasswordHashed := string(employeeHashBytes)
    managerPasswordHashed := string(managerHashBytes)

    // 5. ลิสต์ข้อมูลจำลองผู้ใช้ (ผูก StoreConfigID เป็น 1 ตามที่ดึงมาตะกี้)
    usersToSeed := []entity.User{
        {
            FirstName:         "Owner",
            LastName:          "System",
            IdCardNumberUser:  "1100000000001",
            Username:          "boss",
            Password:          ownerPasswordHashed,
            StoreConfigID:     storeConfig.ID, // จะได้ค่าเป็น 1 เสมอ
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-0",
            RoleID:            1, // roleOwner.ID
            LineUserID:        "LINE_BOSS",
        },
        {
            FirstName:         "Somchai",
            LastName:          "หน้าร้าน",
            IdCardNumberUser:  "1100000000002",
            Username:          "employee",
            Password:          employeePasswordHashed,
            StoreConfigID:     storeConfig.ID,
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-1",
            RoleID:            2, // roleEmployee.ID
            LineUserID:        "LINE_EMPLOYEE",
        },
        {
            FirstName:         "Somying2",
            LastName:          "หน้าร้าน",
            IdCardNumberUser:  "1100000000005",
            Username:          "employee2",
            Password:          employeePasswordHashed,
            StoreConfigID:     storeConfig.ID,
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-2",
            RoleID:            2, // roleEmployee.ID
            LineUserID:        "LINE_EMPLOYEE2",
        },
        {
            FirstName:         "Manager",
            LastName:          "IT",
            IdCardNumberUser:  "1100000000003",
            Username:          "manager",
            Password:          managerPasswordHashed,
            StoreConfigID:     storeConfig.ID,
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-2",
            RoleID:            roleManager.ID,
            LineUserID:        "LINE_MANAGER",
        },
        {
            FirstName:         "เนตรนภัทร",
            LastName:          "ชำนินอก",
            IdCardNumberUser:  "1100000000004",
            Username:          "manager2",
            Password:          managerPasswordHashed,
            StoreConfigID:     storeConfig.ID,
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-3",
            RoleID:            roleManager.ID,
            LineUserID:        "LINE_MANAGER2",
        },
    }

    // 6. วนลูปบันทึกข้อมูลแบบปลอดภัย
    for _, user := range usersToSeed {
        var existingUser entity.User
        err := db.Where("username = ?", user.Username).First(&existingUser).Error
        if err == gorm.ErrRecordNotFound {
            if err := db.Create(&user).Error; err != nil {
                return fmt.Errorf("failed to seed user %s: %w", user.Username, err)
            }
        } else if err != nil {
            return fmt.Errorf("failed to check existing user %s: %w", user.Username, err)
        }
    }

    return nil
}