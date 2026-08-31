// usePosCart.ts
import { useState, useEffect, useMemo, useRef } from "react";
import { posApiService, getDefaultProductDiscount } from "../../../../service/http/pos/pos_service";
import { useDiscountCalculation } from "./useDiscountCalculation";
import type { UsePosCartProps, CartItem, UsePosCartReturn } from "../../../../interface/pos/usePosCart.interface";

export function usePosCart({ customer, activeTypeId, isRecoverMode, onRecoverCancelledOrder }: UsePosCartProps): UsePosCartReturn {
  
  const [cart, setCart] = useState<CartItem[]>(() => {
    // cart = เก็บข้อมูลสินค้าที่อยู่ในตะกร้า (POS Cart) ของบิลขายปัจจุบัน (ตัวแปรฝั่งข้อมูล)
    // setCart = ฟังก์ชันสำหรับอัปเดตข้อมูลสินค้าที่อยู่ในตะกร้า (POS Cart) ของบิลขายปัจจุบัน
    if (typeof window !== "undefined") { // ตรวจสอบว่ากำลังรันในฝั่ง Client (Browser) หรือไม่
      const savedCart = localStorage.getItem("pos_cart"); // ดึงข้อมูลตะกร้าสินค้าจาก Local Storage ของ Browser (ถ้ามี) เพื่อให้บิลขายปัจจุบันยังคงอยู่แม้ Refresh หน้า
      return savedCart ? JSON.parse(savedCart) : []; // ถ้าไม่มีข้อมูลใน Local Storage ให้เริ่มต้นด้วยตะกร้าว่าง
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState<string>(""); 
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [cancelledOrderSuggestions, setCancelledOrderSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const { calculateLineDiscountAmount, validateLineDiscountPolicy } = useDiscountCalculation();

  // เก็บ ID ลูกค้า และค่าสิทธิ์ส่วนลดล่าสุดไว้เช็คความเปลี่ยนแปลง ป้องกัน Loop
  const prevCustomerIdRef = useRef<number | undefined>(customer?.id);
  const prevActiveTypeIdRef = useRef<number | undefined>(activeTypeId);
  const prevIsDiscountEnabledRef = useRef<boolean | undefined>(customer?.is_discount_enabled);
  const prevOntopDiscountRateRef = useRef<number | undefined>(customer?.ontop_discount_rate);
  const prevStandardDiscountRateRef = useRef<number | undefined>(customer?.standard_discount_rate);

  // บันทึกลง localStorage เฉพาะเมื่อ cart เปลี่ยนแปลงจริง
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  // Auto-Sync ข้อมูลสินค้าในตะกร้ากับระบบคลังหลังบ้านเมื่อโหลดหน้า POS ขึ้นมา
  useEffect(() => {
    const syncCartWithLatestData = async () => {
      const savedCartStr = localStorage.getItem("pos_cart");
      if (!savedCartStr) return;

      try {
        const savedCart: CartItem[] = JSON.parse(savedCartStr);
        if (savedCart.length === 0) return;

        const updatedCart = await Promise.all(
          savedCart.map(async (item) => {
            const products = await posApiService.searchProducts(item.product_code);
            const latestProduct = products?.find((p) => p.id === item.product_id) || products?.[0];

            if (!latestProduct) return item;

            return {
              ...item,
              model_name: latestProduct.model_name,
              brand_name: latestProduct.brand_name,
              grade_name: latestProduct.grade_name,
              unit_price: latestProduct.sale_price,
              quantity: latestProduct.quantity,
              note: latestProduct.note,
            };
          })
        );

        setCart(updatedCart);
      } catch (error) {
        console.error("Failed to sync cart data with database:", error);
      }
    };

    syncCartWithLatestData();
  }, []);

  // ตัวดักจับเมื่อพนักงานสั่งสลับกลุ่มสิทธิ์ลูกค้า หรือข้อมูลสิทธิ์ส่วนลดลูกค้าเปลี่ยนแปลง
  useEffect(() => {
    const isCustomerUnchanged =
      prevCustomerIdRef.current === customer?.id &&
      prevActiveTypeIdRef.current === activeTypeId &&
      prevIsDiscountEnabledRef.current === customer?.is_discount_enabled &&
      prevOntopDiscountRateRef.current === customer?.ontop_discount_rate &&
      prevStandardDiscountRateRef.current === customer?.standard_discount_rate;

    if (isCustomerUnchanged) {
      return;
    }

    if (cart.length === 0) {
      prevCustomerIdRef.current = customer?.id;
      prevActiveTypeIdRef.current = activeTypeId;
      prevIsDiscountEnabledRef.current = customer?.is_discount_enabled;
      prevOntopDiscountRateRef.current = customer?.ontop_discount_rate;
      prevStandardDiscountRateRef.current = customer?.standard_discount_rate;
      return;
    }

    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";
    const isCompany = currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE";

    const updatedCart = cart.map((item) => {
      // ลูกค้ากลุ่มบริษัท ไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น
      if (isCompany) {
        return {
          ...item,
          discount_type: "none" as const,
          discount_value: 0,
        };
      }

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
    prevIsDiscountEnabledRef.current = customer?.is_discount_enabled;
    prevOntopDiscountRateRef.current = customer?.ontop_discount_rate;
    prevStandardDiscountRateRef.current = customer?.standard_discount_rate;
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

  //ฟังก์ชันแอดสินค้าเข้าตะกร้าผ่านการแสกนบาร์โค้ด หรือพิมพ์เลข SKU (หรือพิมพ์/สแกนเลขบิลยกเลิกเมื่อเปิดโหมดกู้คืน)
  //หากสินค้าชิ้นนั้นเคยอยู่ในตะกร้าแล้วจะทำการบวกจำนวนเพิ่ม 1 ชิ้น (qty + 1) อัตโนมัติ
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault(); //ป้องกันไม่ให้หน้าเว็บรีเฟรชตอนกด Enter
    const cleanedQuery = searchQuery.trim();
    if (!cleanedQuery) return;

    // 1. ถ้าอยู่ในโหมดกู้คืนบิลยกเลิก ตรวจสอบก่อนว่าเป็นเลขบิลยกเลิกหรือไม่
    if (isRecoverMode) {
      try {
        const cancelledMatches = await posApiService.getCancelledOrders(cleanedQuery);
        const exactOrder = cancelledMatches.find(
          (o) => o.order_number?.toLowerCase() === cleanedQuery.toLowerCase()
        ) || (cleanedQuery.toUpperCase().startsWith("INV-") || cleanedQuery.toUpperCase().startsWith("ORD-") ? cancelledMatches[0] : null);

        if (exactOrder && onRecoverCancelledOrder) {
          await onRecoverCancelledOrder(exactOrder.id);
          setSearchQuery("");
          setSuggestions([]);
          setCancelledOrderSuggestions([]);
          setShowSuggestions(false);
          return;
        }
      } catch (err) {
        console.warn("Cancelled order lookup error:", err);
      }
    }

    try {
      const products = await posApiService.searchProducts(cleanedQuery);
      if (!products || products.length === 0) {
        // ถ้าอยู่ในโหมดกู้คืนบิลและยังหาของไม่เจอ ให้ลองหาว่าเป็นบิลยกเลิกหรือไม่
        if (isRecoverMode) {
          const cancelledMatches = await posApiService.getCancelledOrders(cleanedQuery);
          if (cancelledMatches && cancelledMatches.length > 0 && onRecoverCancelledOrder) {
            await onRecoverCancelledOrder(cancelledMatches[0].id);
            setSearchQuery("");
            setSuggestions([]);
            setCancelledOrderSuggestions([]);
            setShowSuggestions(false);
            return;
          }
        }

        alert(
          isRecoverMode
            ? "ไม่พบข้อมูลสินค้าหรือบิลยกเลิกที่ตรงกันในระบบ"
            : "ไม่พบข้อมูลสินค้าชิ้นนี้ในระบบ (รองรับการค้นหาจาก บาร์โค้ด, รหัสสินค้า, Part Number และชื่อสินค้า)"
        );
        return;
      }
      // ค้นหาตัวเลือกที่ตรงกับเงื่อนไขที่สุด (ไม่ว่าจะเป็น barcode, product_code, part_number, หรือ product_name)
      const product = products.find(
        (p) =>
          p.barcode?.toLowerCase() === cleanedQuery.toLowerCase() ||
          p.product_code?.toLowerCase() === cleanedQuery.toLowerCase() ||
          p.part_number?.toLowerCase() === cleanedQuery.toLowerCase() ||
          p.product_name?.toLowerCase() === cleanedQuery.toLowerCase()
      ) || products[0];
      // โซนที่ 3 & 4: คำนวณและเช็คความปลอดภัย (มีของซ้ำไหม/สิทธิ์ส่วนลดได้เท่าไหร่/สต็อกเหลือไหม)
      const maxStock = product.quantity ?? 0;
      if (maxStock <= 0) {
        alert(`สินค้า ${product.product_name || product.product_code} หมดสต็อก (คงเหลือ 0 ชิ้น) ไม่สามารถเพิ่มลงในบิลได้`);
        return;
      }

      const discountConfig = getDefaultProductDiscount(product, customer, activeTypeId);
      const existingIndex = cart.findIndex((item) => item.product_id === product.id);
      
      // โซนที่ 5: สั่งเซ็ตค่ากลับลง State (ปิดงาน)
      if (existingIndex > -1) {
        // เคส 1: สินค้าเดิมมีอยู่แล้ว ทำการบวกจำนวนชิ้นเพิ่มขึ้น 1
        const newCart = [...cart];
        const item = newCart[existingIndex];

        if (item.qty + 1 > maxStock) {
          alert(`ไม่สามารถเพิ่มจำนวนได้ สินค้าในระบบมีเพียง ${maxStock} ชิ้น`);
          return;
        }

        newCart[existingIndex] = {
          ...item,
          qty: item.qty + 1,
          model_name: product.model_name, 
          brand_name: product.brand_name, 
          grade_name: product.grade_name, 
          unit_price: product.sale_price, 
          quantity: product.quantity,     
          note: product.note,
        };

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
            model_name: product.model_name,
            brand_name: product.brand_name,
            grade_name: product.grade_name,
            unit_price: product.sale_price,
            quantity: product.quantity,
            note: product.note,
            max_discount_rate: product.max_discount_rate,
            discount_type: discountConfig.type,
            discount_value: discountConfig.value,
          },
        ]);
      }
      setSearchQuery("");
      setSuggestions([]);
      setCancelledOrderSuggestions([]);
      setShowSuggestions(false);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการดึงข้อมูลสินค้าหลังบ้าน");
    }
  };

  //ฟังก์ชันปุ่มกดบวกลบจำนวนสินค้า (QTY) ในตารางบิล POS
  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    const item = newCart[index];
    const maxStock = (item as any).quantity ?? 999; 

    if (delta > 0 && item.qty + delta > maxStock) {
      alert(`ไม่สามารถเพิ่มจำนวนได้ สินค้าในระบบมีเพียง ${maxStock} ชิ้น`);
      return;
    }

    if (item.qty + delta > 0) {
      item.qty += delta;
      setCart(newCart);
    } else {
      handleRemoveItem(index);
    }
  };

  //ฟังก์ชันพิมพ์แก้ไขจำนวนสินค้า (QTY) ใน Input Box แบบอิสระ
  const handleSetQuantity = (index: number, inputValue: string | number) => {
    const value = typeof inputValue === "string" ? parseInt(inputValue, 10) : inputValue;
    const newCart = [...cart];
    const item = newCart[index];
    const maxStock = (item as any).quantity ?? 999;

    if (isNaN(value) || value <= 0) {
      item.qty = 1;
    } else if (value > maxStock) {
      alert(`ไม่สามารถเพิ่มจำนวนได้ สินค้าในระบบมีเพียง ${maxStock} ชิ้น`);
      item.qty = maxStock;
    } else {
      item.qty = value;
    }
    setCart(newCart);
  };

  //ฟังก์ชันลบรายการสินค้าแถวนั้นออกจากตารางบิล POS
  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  //ฟังก์ชันล้างข้อมูลในตะกร้าสินค้าทั้งหมด (Clear Cart)
  const handleClearAllCart = (onClearSuccess?: () => void) => {
    setCart([]);
    localStorage.removeItem("pos_cart");
    if (onClearSuccess) onClearSuccess();
  };

  // ─── DISCOUNT HANDLERS ───

  //ฟังก์ชันเปิด/ปิด สิทธิ์การให้ส่วนลดรายชิ้น
  const handleDiscountToggle = (index: number, isChecked: boolean) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (isChecked) {
          // ถ้าเปิด ให้ใช้เงื่อนไขตั้งต้นตามสิทธิ์ลูกค้า
          const cfg = getDefaultProductDiscount(item as any, customer, activeTypeId);
          return { ...item, discount_type: cfg.type, discount_value: cfg.value };
        }
        // ถ้าปิด ให้เซ็ตส่วนลดเป็น 0
        return { ...item, discount_type: "none", discount_value: 0 };
      })
    );
  };

  //ฟังก์ชันสลับประเภทส่วนลดรายชิ้น (ลดเป็นบาท vs ลดเป็นเปอร์เซ็นต์)
  const handleDiscountTypeChange = (index: number, type: "amount" | "percentage") => {
    setCart((prev) =>
      prev.map((item, i) => (i === index ? { ...item, discount_type: type, discount_value: 0 } : item))
    );
  };

  //ฟังก์ชันเปลี่ยนตัวเลขมูลค่าส่วนลดรายชิ้น พร้อมระบบ Validate ความปลอดภัย
  const handleDiscountValueChange = (index: number, valueStr: string) => {
    const rawValue = parseFloat(valueStr) || 0;
    const item = cart[index];
    if (!item) return;

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

  // ดึงข้อมูลคำแนะนำสินค้าและบิลยกเลิกแบบเรียลไทม์ (Autocomplete)
  useEffect(() => {
    const cleaned = searchQuery.trim();
    if (!cleaned) {
      setSuggestions([]);
      setCancelledOrderSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const cleanedLower = cleaned.toLowerCase();
        if (isRecoverMode) {
          const [products, cancelledOrders] = await Promise.all([
            posApiService.searchProducts(cleaned).catch(() => []),
            posApiService.getCancelledOrders(cleaned).catch(() => []),
          ]);
          const filteredProducts = (products || []).filter((item: any) =>
            item.product_name?.toLowerCase().includes(cleanedLower) ||
            item.product_code?.toLowerCase().includes(cleanedLower) ||
            item.part_number?.toLowerCase().includes(cleanedLower) ||
            item.barcode?.toLowerCase().includes(cleanedLower)
          );
          setSuggestions(filteredProducts);
          setCancelledOrderSuggestions(cancelledOrders || []);
        } else {
          const res = await posApiService.searchProducts(cleaned);
          const filteredResults = (res || []).filter((item: any) =>
            item.product_name?.toLowerCase().includes(cleanedLower) ||
            item.product_code?.toLowerCase().includes(cleanedLower) ||
            item.part_number?.toLowerCase().includes(cleanedLower) ||
            item.barcode?.toLowerCase().includes(cleanedLower)
          );
          setSuggestions(filteredResults);
          setCancelledOrderSuggestions([]);
        }
        setShowSuggestions(true);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, isRecoverMode]);

  const handleSelectProduct = (product: any) => {
    const maxStock = product.quantity ?? 0;
    if (maxStock <= 0) {
      alert(`สินค้า ${product.product_name || product.product_code} หมดสต็อก (คงเหลือ 0 ชิ้น) ไม่สามารถเพิ่มลงในบิลได้`);
      return;
    }

    const discountConfig = getDefaultProductDiscount(product, customer, activeTypeId);
    const existingIndex = cart.findIndex((item) => item.product_id === product.id);

    if (existingIndex > -1) {
      const newCart = [...cart];
      const item = newCart[existingIndex];

      if (item.qty + 1 > maxStock) {
        alert(`ไม่สามารถเพิ่มจำนวนได้ สินค้าในระบบมีเพียง ${maxStock} ชิ้น`);
        return;
      }

      newCart[existingIndex] = {
        ...item,
        qty: item.qty + 1,
        model_name: product.model_name,
        brand_name: product.brand_name,
        grade_name: product.grade_name,
        unit_price: product.sale_price,
        quantity: product.quantity,
        note: product.note,
      };

      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_code: product.product_code,
          product_name: product.product_name,
          part_number: product.part_number,
          qty: 1,
          model_name: product.model_name,
          brand_name: product.brand_name,
          grade_name: product.grade_name,
          unit_price: product.sale_price,
          quantity: product.quantity,
          note: product.note || "",
          max_discount_rate: product.max_discount_rate,
          discount_type: discountConfig.type,
          discount_value: discountConfig.value,
        },
      ]);
    }

    setSearchQuery("");
    setSuggestions([]);
    setCancelledOrderSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSelectCancelledOrder = async (order: any) => {
    if (onRecoverCancelledOrder) {
      await onRecoverCancelledOrder(order.id);
    }
    setSearchQuery("");
    setSuggestions([]);
    setCancelledOrderSuggestions([]);
    setShowSuggestions(false);
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
    suggestions,
    setSuggestions,
    cancelledOrderSuggestions,
    setCancelledOrderSuggestions,
    showSuggestions,
    setShowSuggestions,
    handleSelectProduct,
    handleSelectCancelledOrder,
  };
}