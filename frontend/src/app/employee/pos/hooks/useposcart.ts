// usePosCart.ts
import { useState, useEffect, useMemo, useRef } from "react";
import { posApiService, getDefaultProductDiscount } from "../../../../service/http/pos/pos_service";
import { useDiscountCalculation } from "./useDiscountCalculation";
import type { UsePosCartProps, CartItem, UsePosCartReturn } from "../../../../interface/pos/usePosCart.interface";

export function usePosCart({ customer, activeTypeId }: UsePosCartProps): UsePosCartReturn {
  
  const [cart, setCart] = useState<CartItem[]>(() => {
    // cart = เก็บข้อมูลสินค้าที่อยู่ในตะกร้า (POS Cart) ของบิลขายปัจจุบัน (ตัวแปรฝั่งข้อมูล)
    // setCart = ฟังก์ชันสำหรับอัปเดตข้อมูลสินค้าที่อยู่ในตะกร้า (POS Cart) ของบิลขายปัจจุบัน
    if (typeof window !== "undefined") { // ตรวจสอบว่ากำลังรันในฝั่ง Client (Browser) หรือไม่
      const savedCart = localStorage.getItem("pos_cart"); // ดึงข้อมูลตะกร้าสินค้าจาก Local Storage ของ Browser (ถ้ามี) เพื่อให้บิลขายปัจจุบันยังคงอยู่แม้ Refresh หน้า
      return savedCart ? JSON.parse(savedCart) : []; // ถ้าไม่มีข้อมูลใน Local Storage ให้เริ่มต้นด้วยตะกร้าว่าง
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>(""); // searchQuery = เก็บข้อมูลรหัสบาร์โค้ดหรือ SKU ที่พนักงานกรอกเพื่อค้นหาสินค้า (ตัวแปรฝั่งข้อมูล) setSearchQuery = ฟังก์ชันสำหรับอัปเดตข้อมูลรหัสบาร์โค้ดหรือ SKU ที่พนักงานกรอกเพื่อค้นหาสินค้า (ตัวแปรฝั่งข้อมูล)
  const { calculateLineDiscountAmount, validateLineDiscountPolicy } = useDiscountCalculation();

  // เก็บ ID ลูกค้าล่าสุดไว้เช็คความเปลี่ยนแปลง ป้องกัน Loop
  const prevCustomerIdRef = useRef<number | undefined>(customer?.id);
  const prevActiveTypeIdRef = useRef<number | undefined>(activeTypeId);

  // บันทึกลง localStorage เฉพาะเมื่อ cart เปลี่ยนแปลงจริง
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  // ตัวดักจับเมื่อพนักงานสั่งสลับกลุ่มสิทธิ์ลูกค้า (เช่น จากทั่วไป -> อู่ซ่อมรถ)จะทำการ Map อัปเดตประเภทส่วนลดและมูลค่าลดราคาอัตโนมัติยกตะกร้าทันที 
  useEffect(() => {
    // ทำงานเฉพาะเมื่อ ID ลูกค้า หรือ ประเภทลูกค้าเปลี่ยนจริงๆ เท่านั้น
    if (
      prevCustomerIdRef.current === customer?.id &&
      prevActiveTypeIdRef.current === activeTypeId
    ) {
      return;
    }

    if (cart.length === 0) {
      prevCustomerIdRef.current = customer?.id;
      prevActiveTypeIdRef.current = activeTypeId;
      return;
    }

    const updatedCart = cart.map((item) => {
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

      const discountConfig = getDefaultProductDiscount(
        mockProduct as any,
        customer,
        activeTypeId
      );

      return {
        ...item,
        discount_type: discountConfig.type,     
        discount_value: discountConfig.value,   
      };
    });

    setCart(updatedCart);
    
    // อัปเดต ref ล่าสุด
    prevCustomerIdRef.current = customer?.id;
    prevActiveTypeIdRef.current = activeTypeId;
  }, [activeTypeId, customer, cart.length]); // ไม่ผูกกับวัตถุ cart ตรงๆ

  // ─── COMPUTED VALUES ───

  // คำนวณราคารวมดิบของสินค้าทั้งหมดในตะกร้า (ราคาก่อนหักส่วนลดใดๆ ทั้งสิ้น)
  // ยอดสะสมของ (หน่วยราคาต่อชิ้น * จำนวนชิ้น)
  const totalItemPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  }, [cart]);

  // คำนวณยอดรวมของส่วนลดรายชิ้นสะสมทั้งหมดในตะกร้า (Line Discount Total)
  // รองรับการคำนวณแยกทั้งแบบลดเป็นบาท (amount) และแบบลดเป็นเปอร์เซ็นต์ (%)
  const totalLineDiscount = useMemo(() => {
    return cart.reduce((sum, item) => {
      return sum + calculateLineDiscountAmount(item.unit_price, item.qty, item.discount_type, item.discount_value);
    }, 0);
  }, [cart, calculateLineDiscountAmount]);

  // ─── CORE FUNCTIONS ───

  //ฟังก์ชันแอดสินค้าเข้าตะกร้าผ่านการแสกนบาร์โค้ด หรือพิมพ์เลข SKU
  //หากสินค้าชิ้นนั้นเคยอยู่ในตะกร้าแล้วจะทำการบวกจำนวนเพิ่ม 1 ชิ้น (qty + 1) อัตโนมัติ
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault(); //ป้องกันไม่ให้หน้าเว็บรีเฟรชตอนกด Enter
    // โซนที่ 2: ดึงข้อมูลดิบ (ยิงไปเอาของจากหลังบ้านมา)
    const cleanedQuery = searchQuery.trim();
    if (!cleanedQuery) return;

    try {
      const products = await posApiService.searchProducts(cleanedQuery);
      if (!products || products.length === 0) {
        alert("ไม่พบรหัสบาร์โค้ดสินค้าชิ้นนี้ในสต๊อกระบบ");
        return;
      }
      //.find() ค้นหาในอาร์เรย์ตัวที่ตรงที่สุด
      const product = products.find((p) => p.barcode === cleanedQuery || p.product_code === cleanedQuery) || products[0];
      // โซนที่ 3 & 4: คำนวณและเช็คความปลอดภัย (มีของซ้ำไหม/สิทธิ์ส่วนลดได้เท่าไหร่)
      const discountConfig = getDefaultProductDiscount(product, customer, activeTypeId);
      const existingIndex = cart.findIndex((item) => item.product_id === product.id);
      
      // โซนที่ 5: สั่งเซ็ตค่ากลับลง State (ปิดงาน)
      if (existingIndex > -1) {
        // เคส 1: สินค้าเดิมมีอยู่แล้ว ทำการบวกจำนวนชิ้นเพิ่มขึ้น 1
        const newCart = [...cart];
        newCart[existingIndex].qty += 1;
        setCart(newCart);
      } else {
        // สินค้าใหม่เอี่ยม ยัด Object ลงอาร์เรย์ตะกร้า พร้อมแนบค่าพาร์ท เกรด และสิทธิ์ส่วนลดเริ่มต้น
        setCart([
          ...cart,
          {
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            part_number: product.part_number,
            qty: 1,
            quantity: product.quantity,
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
      setSearchQuery("");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าหลังบ้าน");
    }
  };

  //ฟังก์ชันปุ่มกดบวกลบจำนวนสินค้า (QTY) ในตารางบิล POS
  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const maxStock = (item as any).quantity ?? 999; 

    let newQty = item.qty + delta;
    if (newQty < 1) newQty = 1;

    if (newQty > maxStock) {
      alert(`ไม่สามารถระบุจำนวนได้ สินค้าในระบบมีเพียง ${maxStock} ชิ้น`);
      newQty = maxStock;
    }

    item.qty = newQty;
    setCart(newCart);
  };

  const handleSetQuantity = (index: number, inputValue: string | number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const maxStock = (item as any).quantity ?? 999; 

    if (inputValue === "") {
      item.qty = 0; 
      setCart(newCart);
      return;
    }

    let validQty = typeof inputValue === "string" ? parseInt(inputValue, 10) : inputValue;
    if (isNaN(validQty) || validQty < 0) validQty = 0;

    if (validQty > maxStock) {
      alert(`ไม่สามารถระบุจำนวนได้ สินค้าในระบบมีเพียง ${maxStock} ชิ้น`);
      validQty = maxStock;
    }

    item.qty = validQty;
    setCart(newCart);
  };

  //ฟังก์ชันกดปุ่มถังขยะท้ายแถว เพื่อดีดสินค้ารายการนั้นๆ ออกจากบิลขายปัจจุบัน
  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  //ฟังก์ชันปุ่ม "ล้างทั้งหมด" เพื่อล้างตารางสินค้าในบิลร่างปัจจุบันให้เกลี้ยงตะกร้า
  const handleClearAllCart = (onClearSuccess?: () => void) => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด?")) {
      setCart([]);
      localStorage.removeItem("pos_cart");
      if (onClearSuccess) onClearSuccess();
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

    const item = cart[index];

    const policy = validateLineDiscountPolicy({
      rawValue,
      discountType: item.discount_type,
      unitPrice: item.unit_price,
      qty: item.qty,
      maxDiscountRate: item.max_discount_rate,
      customer,
      activeTypeId,
    });

    if (!policy.isValid) {
      if (policy.errorMsg) alert(policy.errorMsg);
      setCart((prev) =>
        prev.map((cartItem, i) =>
          i === index ? { ...cartItem, discount_value: 0, discount_type: "none" } : cartItem
        )
      );
      return; 
    }

    setCart((prev) =>
      prev.map((cartItem, i) => (i === index ? { ...cartItem, discount_value: rawValue } : cartItem))
    );
  };

  return {
    cart,
    setCart,
    searchQuery,
    setSearchQuery,
    totalItemPrice,
    totalLineDiscount,
    handleAddProduct,
    updateQty,
    handleSetQuantity,
    handleRemoveItem,
    handleClearAllCart,
    handleDiscountToggle,
    handleDiscountTypeChange,
    handleDiscountValueChange,
  };
}