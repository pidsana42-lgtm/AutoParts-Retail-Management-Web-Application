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

    // 2. ดึง StoreConfig ID 1 ที่โบว์ทำ Seed ไว้แล้วขึ้นมาใช้ (ไม่สร้างซ้ำ)
    var storeConfig entity.StoreConfig
    if err := db.Where("id = ?", 1).First(&storeConfig).Error; err != nil {
        // เผื่อกรณียังไม่ได้รัน seed ของ StoreConfig ให้ไปเรียกมาก่อนเลย
        if errSeed := StoreConfig(db); errSeed != nil {
            return fmt.Errorf("failed to seed store config from user seed: %w", errSeed)
        }
        _ = db.Where("id = ?", 1).First(&storeConfig)
    }

    // 3. ตรวจสอบและดึงข้อมูลบทบาท (Role) ทั้งหมดมารอไว้สำหรับสร้าง User
    var roleOwner, roleEmployee, roleAdmin entity.Role
    if err := db.Where("role_name = ?", enum.RoleOwner).First(&roleOwner).Error; err != nil {
        if errSeed := Role(db); errSeed != nil {
            return fmt.Errorf("failed to seed roles from user seed: %w", errSeed)
        }
        _ = db.Where("role_name = ?", enum.RoleOwner).First(&roleOwner)
    }
    _ = db.Where("role_name = ?", enum.RoleEmployee).First(&roleEmployee)
    _ = db.Where("role_name = ?", enum.RoleAdmin).First(&roleAdmin)

    // 4. เข้ารหัส Passwords เตรียมไว้ล่วงหน้า
    ownerHashBytes, _ := bcrypt.GenerateFromPassword([]byte("owner123"), 14)
    employeeHashBytes, _ := bcrypt.GenerateFromPassword([]byte("employee123"), 14)
    adminHashBytes, _ := bcrypt.GenerateFromPassword([]byte("admin123"), 14)

    
    ownerPasswordHashed := string(ownerHashBytes)
    employeePasswordHashed := string(employeeHashBytes)
    adminPasswordHashed := string(adminHashBytes)

    // 5. ลิสต์ข้อมูลจำลองผู้ใช้ (ผูก StoreConfigID เป็น 1 ตามที่ดึงมาตะกี้)
    usersToSeed := []entity.User{
        {
            Model:             gorm.Model{ID: 1}, // แอดมินหลัก ID 1
            FirstName:         "Owner",
            LastName:          "System",
            IdCardNumberUser:  "1100000000001",
            Username:          "owner",
            Password:          ownerPasswordHashed,
            StoreConfigID:     storeConfig.ID, // จะได้ค่าเป็น 1 เสมอ
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-0",
            RoleID:            roleOwner.ID,
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
            RoleID:            roleEmployee.ID,
        },
        {
            FirstName:         "Manager",
            LastName:          "IT",
            IdCardNumberUser:  "1100000000003",
            Username:          "manager",
            Password:          adminPasswordHashed,
            StoreConfigID:     storeConfig.ID,
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-2",
            RoleID:            roleAdmin.ID,
        },
        {
            FirstName:         "เนตรนภัทร",
            LastName:          "ชำนินอก",
            IdCardNumberUser:  "1100000000004",
            Username:          "manager2",
            Password:          adminPasswordHashed,
            StoreConfigID:     storeConfig.ID,
            BankID:            bank.ID,
            BankAccountNumber: "123-4-56789-3",
            RoleID:            roleAdmin.ID,
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