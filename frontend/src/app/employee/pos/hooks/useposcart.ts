import { useState, useEffect, useMemo } from "react";
import { posApiService } from "../../../../service/http/pos/pos_service";
import type { SaleOrderItemRequest } from "../../../../interface/pos/pos_interface";
import type { CustomerDiscountResponse } from "../../../../interface/pos/customer_interface";

interface UsePosCartProps {
  customer: CustomerDiscountResponse | null;
  activeTypeId: number;
}

// Custom Hook สำหรับระบบจัดการสินค้าในตะกร้า (Cart), การสแกนเพิ่ม/ลบสินค้า, 
// และการคำนวณราคา/สิทธิ์ส่วนลดรายชิ้นตามกลุ่มลูกค้าหน้าร้าน POS
export function usePosCart({ customer, activeTypeId }: UsePosCartProps) {
  // LOCAL STATES 
  const [cart, setCart] = useState<SaleOrderItemRequest[]>(() => {
    // โหลดข้อมูลตะกร้าสินค้าเดิมที่เคยขายค้างไว้จาก localStorage (ถ้ามี) ป้องกันรีเฟรชหน้าแล้วหาย
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("pos_cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>(""); // ข้อความรหัสบาร์โค้ด หรือ รหัส SKU สินค้าที่กำลังสแกนค้นหา

  // LOCAL STORAGE PERSIST EFFECT
  // ทุกครั้งที่มีการเปลี่ยนแปลงสินค้าในตะกร้า (ชิ้นส่วนเพิ่ม/ลด/เปลี่ยนจำนวน) ให้บันทึกลง localStorage ทันที
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  // CUSTOMER SWITCH EFFECT (โจทย์อู่อัตโนมัติ) 
  //[useEffect]: ตัวดักจับเมื่อพนักงานสั่งสลับกลุ่มสิทธิ์ลูกค้า (เช่น จากทั่วไป -> อู่ซ่อมรถ)
  //ระบบจะทำการ Map อัปเดตประเภทส่วนลดและมูลค่าลดราคาอัตโนมัติยกตะกร้าทันที โดยไม่ทำให้จำนวน (QTY) หรือฟิลด์สินค้าอื่นพัง
  useEffect(() => {
    const updateCartDiscounts = async () => {
      if (cart.length === 0) return;
      try {
        const { getDefaultProductDiscount } = await import(
          "../../../../service/http/pos/pos_service"
        );

        const updatedCart = cart.map((item) => {
          // จำลองโครงสร้าง product object เพื่อส่งไปให้ฟังก์ชันสิทธิประโยชน์คำนวณค่า
          const mockProduct = {
            id: item.product_id,
            product_code: item.product_code,
            product_name: item.product_name,
            part_number: item.part_number,
            sale_price: item.unit_price,
            max_discount_rate: item.max_discount_rate,
            grade_name: item.grade_name,
            brand_name: item.brand_name,
            model_name: item.model_name,
            note: item.note,
          };

          // คำนวณหาโครงสร้างส่วนลดมาตรฐานใหม่ตามกลุ่มลูกค้า
          const discountConfig = getDefaultProductDiscount(
            mockProduct as any,
            customer,
            activeTypeId
          );

          // 📍 [จุดแก้ไขสำคัญ]: บังคับกระจายสเปรดและคืนค่าฟิลด์เดิมครบถ้วน รายละเอียดบนหน้า UI ถึงไม่หาย
          return {
            ...item,
            product_id: item.product_id,
            product_code: item.product_code,
            product_name: item.product_name,
            part_number: item.part_number,
            grade_name: item.grade_name,
            brand_name: item.brand_name,
            model_name: item.model_name,
            note: item.note,
            max_discount_rate: item.max_discount_rate,
            discount_type: discountConfig.type,     // เปลี่ยนประเภทลดตามสิทธิ์ใหม่ (เช่น percentage)
            discount_value: discountConfig.value,   // เปลี่ยนมูลค่าลดตามสิทธิ์ใหม่ (เช่น อู่ลดเพิ่ม 3%)
          };
        });

        setCart(updatedCart);
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการคำนวณส่วนลดกลุ่มลูกค้าใหม่:", error);
      }
    };

    updateCartDiscounts();
  }, [activeTypeId, customer]); // ทำงานใหม่ทุกครั้งที่มีการเปลี่ยนกลุ่มสิทธิ์/ข้อมูลลูกค้าสมาชิก

  // COMPUTED VALUES (useMemo)

  //[useMemo]: คำนวณราคารวมดิบของสินค้าทั้งหมดในตะกร้า (ราคาก่อนหักส่วนลดใดๆ ทั้งสิ้น)
  //คิดจาก: ยอดสะสมของ (หน่วยราคาต่อชิ้น * จำนวนชิ้น)
  const totalItemPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  }, [cart]);

  //useMemo]: คำนวณยอดรวมของส่วนลดรายชิ้นสะสมทั้งหมดในตะกร้า (Line Discount Total)
  //รองรับการคำนวณแยกทั้งแบบลดเป็นบาท (amount) และแบบลดเป็นเปอร์เซ็นต์ (%)
  const totalLineDiscount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const lineTotal = item.unit_price * item.qty;
      if (item.discount_type === "percentage") {
        return sum + (lineTotal * item.discount_value) / 100;
      } else if (item.discount_type === "amount") {
        return sum + item.discount_value;
      }
      return sum;
    }, 0);
  }, [cart]);


  // CORE FUNCTIONS (ตะกร้าสินค้า & คุมเพดานส่วนลด)

  //ฟังก์ชันแอดสินค้าเข้าตะกร้าผ่านการแสกนบาร์โค้ด หรือพิมพ์เลข SKU
  //หากสินค้าชิ้นนั้นเคยอยู่ในตะกร้าแล้วจะทำการบวกจำนวนเพิ่ม 1 ชิ้น (qty + 1) อัตโนมัติ
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuery = searchQuery.trim();
    if (!cleanedQuery) return;

    try {
      const products = await posApiService.searchProducts(cleanedQuery);
      if (!products || products.length === 0) {
        alert("ไม่พบรหัสบาร์โค้ดสินค้าชิ้นนี้ในสต๊อกระบบ");
        return;
      }

      // เสิร์ชเทียบหาข้อมูลที่บาร์โค้ดตรงที่สุด หากไม่เจอให้เลือกดึงชิ้นแรกสุดขึ้นมาทำงาน
      const product =
        products.find((p) => p.barcode === cleanedQuery || p.product_code === cleanedQuery) || products[0];

      // ดึงสิทธิ์ลดราคาเริ่มต้นประจำตัวสินค้าตามกลุ่มลูกค้าหน้าร้านทันทีที่แอดเข้าบิล
      const { getDefaultProductDiscount } = await import(
        "../../../../service/http/pos/pos_service"
      );
      const discountConfig = getDefaultProductDiscount(product, customer, activeTypeId);

      const existingIndex = cart.findIndex((item) => item.product_id === product.id);
      
      if (existingIndex > -1) {
        // เคส 1: สินค้าเดิมมีอยู่แล้ว ทำการบวกจำนวนชิ้นเพิ่มขึ้น 1
        const newCart = [...cart];
        newCart[existingIndex].qty += 1;
        setCart(newCart);
      } else {
        // เคส 2: สินค้าใหม่เอี่ยม ยัด Object ลงอาร์เรย์ตะกร้า พร้อมแนบค่าพาร์ท เกรด และสิทธิ์ส่วนลดเริ่มต้น
        setCart([
          ...cart,
          {
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            part_number: product.part_number,
            qty: 1,
            unit_price: product.sale_price,
            grade_name: product.grade_name,
            brand_name: product.brand_name,
            model_name: product.model_name,
            note: product.note,
            max_discount_rate: product.max_discount_rate,
            discount_type: discountConfig.type,
            discount_value: discountConfig.value,
          },
        ]);
      }
      setSearchQuery(""); // ล้างช่องเสิร์ชให้พร้อมแสกนชิ้นถัดไป
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าหลังบ้าน");
    }
  };

  //ฟังก์ชันปุ่มกดบวกลบจำนวนสินค้า (QTY) ในตารางบิล POS
  //การันตีจำนวนชิ้นขั้นต่ำสุดไว้ที่ 1 ชิ้นเสมอ ไม่ปล่อยให้พนักงานลดเหลือ 0 หรือติดลบ
  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].qty = Math.max(1, newCart[index].qty + delta);
    setCart(newCart);
  };

  //ฟังก์ชันกดปุ่มถังขยะท้ายแถว เพื่อดีดสินค้ารายการนั้นๆ ออกจากบิลขายปัจจุบัน
  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  //ฟังก์ชันปุ่ม "ล้างทั้งหมด" เพื่อล้างตารางสินค้าในบิลร่างปัจจุบันให้เกลี้ยงตะกร้า
  const handleClearAllCart = (onClearSuccess?: () => void) => {
    if (cart.length === 0) return;
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างตะกร้าสินค้าทั้งหมด?")) {
      setCart([]);
      localStorage.removeItem("pos_cart");
    }
    if (onClearSuccess) {
      onClearSuccess();
    }
  };

  //ฟังก์ชันดักจับปุ่มติ๊กถูก (Checkbox DISC?) ประจำแถวสินค้า 
  //เพื่อสลับเปิดให้ลดราคา/ปิดราคาเต็ม โดยดึงยอดลดมาตรฐานมาใส่ หรือปรับค่าให้คืนเป็น 0 เสมอ
  const handleDiscountToggle = (index: number, isChecked: boolean) => {
    setCart((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              discount_type: isChecked ? "percentage" : "none",
              discount_value: isChecked ? customer?.standard_discount_rate || 0 : 0,
            }
          : item
      )
    );
  };

  //ฟังก์ชันสลับหน่วยของช่องลดราคาประจำแถว (บาท ฿ <-> เปอร์เซ็นต์ %) และล้างค่าเงินเป็น 0 ป้องกันเศษตัวเลขบั๊ก
  const handleDiscountTypeChange = (index: number, type: "amount" | "percentage") => {
    setCart((prev) =>
      prev.map((item, i) => (i === index ? { ...item, discount_type: type, discount_value: 0 } : item))
    );
  };

  //ฟังก์ชันคุมนโยบายเพดานส่วนลดรายชิ้น (Line Discount Validation)
  //ทำหน้าที่บล็อกไม่ให้กลุ่มบริษัทกรอกลดราคา และคำนวณเพดานราคาสูงสุดของสินค้า + โควตาพิเศษของกลุ่มอู่ซ่อมรถซ้อนกันอย่างรัดกุม
  const handleDiscountValueChange = (index: number, valueStr: string) => {
    const rawValue = valueStr === "" ? 0 : parseFloat(valueStr) || 0;
    if (rawValue < 0) return;

    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";

    // 🔒 กฎเหล็ก: ลูกค้ากลุ่มบริษัทขายส่ง (WHOLESALE) ห้ามพนักงานกรอกลดราคารายชิ้นเด็ดขาด
    if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
      alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
      setCart((prev) =>
        prev.map((cartItem, i) =>
          i === index ? { ...cartItem, discount_value: 0, discount_type: "none" } : cartItem
        )
      );
      return;
    }

    const item = cart[index];
    const lineTotal = item.unit_price * item.qty;

    // ตั้งค่าเพดานส่วนลดสูงสุดเริ่มต้นของสินค้าชิ้นนั้นๆ (Default ส่วนใหญ่คือ 2.0%)
    let allowedMaxRate = item.max_discount_rate ?? 2.0;
    
    // ตรวจสอบโหมดอู่ซ่อมรถ: หากเป็นอู่ซ่อมรถจะได้สิทธิ์บวกออนท็อปพิเศษเพิ่มเข้าไปอีก (เช่น +3.0% สิทธิ์รวมจึงเป็น 5.0%)
    const isGarageMode =
      currentCustomerTypeId === 2 ||
      currentCustomerTypeName === "GARAGE" ||
      customer?.customer_name?.includes("อู่");

    if (isGarageMode) {
      const ontopRate = customer ? ((customer as any).ontop_discount_rate ?? 3.0) : 3.0;
      allowedMaxRate += ontopRate;
    }

    // แปลงจำนวนตัวเลขที่กำลังคีย์หน้างานให้กลายเป็นหน่วย % เพื่อเทียบความปลอดภัยกับAllowedMaxRate
    let inputLineDiscountPercent = 0;
    if (item.discount_type === "percentage") {
      inputLineDiscountPercent = rawValue;
    } else if (item.discount_type === "amount" && lineTotal > 0) {
      inputLineDiscountPercent = (rawValue / lineTotal) * 100;
    }

    // แจ้งเตือนสิทธิ์ทันทีหากพนักงานพยายามแอบให้ส่วนลดเกินข้อตกลงของทางร้านค้า
    if (inputLineDiscountPercent > allowedMaxRate + 0.01) {
      if (item.discount_type === "percentage") {
        alert(`ไม่สามารถให้ส่วนลดเกินข้อกำหนดสิทธิ์ลูกค้าได้ \n(สูงสุดไม่เกิน ${allowedMaxRate.toFixed(2)}%)`);
      } else {
        const maxDiscountBaht = (lineTotal * allowedMaxRate) / 100;
        alert(`ไม่สามารถให้ส่วนลดเกินข้อกำหนดสิทธิ์ลูกค้าได้ \n(สูงสุดไม่เกิน ฿${maxDiscountBaht.toFixed(2)})`);
      }
      return; // ดีดออก ไม่ยอมให้อัปเดตค่าลงตะกร้า
    }

    // อัปเดตมูลค่าลดราคาใหม่ลงในแถวสินค้าตามปกติเมื่อผ่านเกณฑ์ความปลอดภัย
    setCart((prev) => prev.map((cartItem, i) => (i === index ? { ...cartItem, discount_value: rawValue } : cartItem)));
  };

  // ส่งข้อมูลทั้งหมดในตะกร้าออกไปประกอบร่างที่หน้าจอใหญ่ pos.tsx
  return {
    cart,
    setCart,
    searchQuery,
    setSearchQuery,
    totalItemPrice,
    totalLineDiscount,
    handleAddProduct,
    updateQty,
    handleRemoveItem,
    handleClearAllCart,
    handleDiscountToggle,
    handleDiscountTypeChange,
    handleDiscountValueChange,
  };
}