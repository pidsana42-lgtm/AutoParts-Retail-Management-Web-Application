import React, { useState } from "react";
import { Trash2, Percent, QrCode, CreditCard, Coins, Plus, Minus, Search } from "lucide-react";

interface CartItem {
  sku: string;
  name: string;
  desc: string;
  price: number;
  qty: number;
  discount: number;
  discountType: "percentage" | "baht";
}

export default function PosPage(): React.JSX.Element {
  // 1. จำลองข้อมูลสินค้าในตะกร้าตามรูปภาพ
  const [cart, setCart] = useState<CartItem[]>([
    {
      sku: "BR-900X",
      name: "Turbocharger",
      desc: "เกรด: สมรรถนะ | รุ่นรถที่รองรับ: TOYOTA HILUX REVO 2.8, FORD RANGER RAPTOR 2.0Bi",
      price: 870.0,
      qty: 1,
      discount: 2,
      discountType: "percentage",
    },
    {
      sku: "GSK-882",
      name: "Gasket Set",
      desc: "เกรด: ซิลิโคนทนความร้อนสูง | รุ่นรถที่รองรับ: ISUZU D-MAX 1.9/3.0 (BLUE POWER), MITSUBISHI TRITON",
      price: 240.0,
      qty: 2,
      discount: 2,
      discountType: "percentage",
    },
    {
      sku: "OIL-SYN-5W40-X",
      name: "Synthetic Motor Oil 5L",
      desc: "เกรด: สังเคราะห์ | รุ่นรถที่รองรับ: TOYOTA CAMRY 2.5, HONDA CIVIC 1.5T, MAZDA 3 (SKYACTIV)",
      price: 110.0,
      qty: 3,
      discount: 0,
      discountType: "percentage",
    },
  ]);

  const [billDiscount, setBillDiscount] = useState<string>("27.00");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr" | "credit">("cash");

  // 2. ฟังก์ชันเพิ่ม/ลด จำนวนสินค้า
  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].qty = Math.max(1, newCart[index].qty + delta);
    setCart(newCart);
  };

  // 3. ฟังก์ชันคำนวณราคารวมทั้งหมด
  const totalItemPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  
  const totalLineDiscount = cart.reduce((sum, item) => {
    if (item.discount > 0) {
      return sum + (item.price * item.qty * item.discount) / 100;
    }
    return sum;
  }, 0);

  const finalTotal = totalItemPrice - totalLineDiscount - parseFloat(billDiscount || "0");

  return (
    <div className="flex bg-[#F3F4F6] min-h-[calc(100vh-4rem)] font-sans text-gray-800 antialiased">
      
      {/* ─── ฝั่งซ้าย: ตารางสินค้า และ การจัดการส่วนลด (75% Width) ─── */}
      <div className="w-[73%] p-6 flex flex-col justify-between">
        <div>
          {/* ส่วนหัว POS */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-red-600 font-bold uppercase tracking-wider">รายการที่กำลังขาย</p>
              <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">POS</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 font-medium">หมายเลขคำสั่งซื้อ</p>
              <h2 className="text-2xl font-bold text-zinc-800">INV2-2026001</h2>
              <button className="mt-2 bg-[#E51C23] hover:bg-[#B70011] text-white text-xs font-bold px-4 py-2 rounded transition-colors shadow-sm">
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          {/* กล่องการจัดการส่วนลดกลางจอ */}
          <div className="bg-[#1C1B1B] text-gray-300 rounded p-4 mb-6 flex justify-between items-center border border-zinc-800">
            <div className="flex items-center gap-6 w-2/3">
              <div className="flex items-center gap-2 text-[#E51C23] font-bold text-sm shrink-0">
                <Percent size={16} />
                <span>การจัดการส่วนลด</span>
              </div>
              <div className="flex items-center gap-2 w-full max-w-xs">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-500">บาท</span>
                  <input
                    type="text"
                    value={billDiscount}
                    onChange={(e) => setBillDiscount(e.target.value)}
                    className="w-full bg-[#2A2929] border border-zinc-700 rounded px-3 py-2 pl-10 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <button className="bg-[#E51C23] hover:bg-[#B70011] text-white text-xs font-bold px-4 py-2.5 rounded shrink-0 transition-colors">
                  อัปเดตบิล
                </button>
              </div>
            </div>

            {/* แถบสถานะขวาของกล่องส่วนลด */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex bg-[#2A2929] rounded p-0.5 border border-zinc-700">
                <button className="px-3 py-1 rounded text-zinc-400">ต่อรายการ</button>
                <button className="bg-[#E51C23] text-white px-3 py-1 rounded font-bold">บิลทั้งหมด (฿)</button>
                <button className="px-3 py-1 rounded text-zinc-400">บิลทั้งหมด (%)</button>
              </div>
              <div className="bg-[#2A2929] border border-zinc-700 rounded p-2 text-[11px] leading-tight text-zinc-400 max-w-[220px]">
                <span className="text-red-500 font-bold">ⓘ</span> ส่วนลดกำลังดำเนินการ: (ราคาสินค้า / ยอดรวม) * 100.40 บาท จะถูกหักตามสัดส่วน ดำเนินการต่อในรายการ
              </div>
            </div>
          </div>

          {/* 📋 ตารางรายการสินค้า (Table) */}
          <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-4 w-[12%]">SKU</th>
                  <th className="py-3 px-4 w-[35%]">คำอธิบายสินค้า</th>
                  <th className="py-3 px-4 w-[10%] text-zinc-600">หน่วยราคา</th>
                  <th className="py-3 px-4 w-[15%] text-center">QTY</th>
                  <th className="py-3 px-4 w-[8%] text-center">DISC?</th>
                  <th className="py-3 px-4 w-[10%] text-center text-zinc-600">ประเภทส่วนลด</th>
                  <th className="py-3 px-4 w-[12%] text-center text-zinc-600">ลดราคา</th>
                  <th className="py-3 px-4 w-[15%] text-right pr-6">LINE TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {cart.map((item, index) => {
                  const lineTotal = item.price * item.qty;
                  const discountAmount = (lineTotal * item.discount) / 100;
                  const finalLineTotal = lineTotal - discountAmount;

                  return (
                    <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-zinc-700 align-top">{item.sku}</td>
                      <td className="py-4 px-4 align-top">
                        <p className="font-bold text-zinc-900 text-base">{item.name}</p>
                        <p className="text-[11px] text-gray-400 leading-relaxed mt-1 max-w-sm">{item.desc}</p>
                      </td>
                      <td className="py-4 px-4 font-medium text-zinc-900 align-top text-base">{item.price.toFixed(2)}</td>
                      <td className="py-4 px-4 text-center align-top">
                        <div className="inline-flex items-center border border-gray-300 rounded bg-[#F3F4F6] overflow-hidden">
                          <button onClick={() => updateQty(index, -1)} className="p-1 px-2 hover:bg-gray-200 transition-colors">
                            <Minus size={12} />
                          </button>
                          <span className="px-3 font-bold text-zinc-800 text-sm">{String(item.qty).padStart(2, "0")}</span>
                          <button onClick={() => updateQty(index, 1)} className="p-1 px-2 hover:bg-gray-200 transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center align-top">
                        <input type="checkbox" checked={item.discount > 0} readOnly className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 mt-1" />
                      </td>
                      <td className="py-4 px-4 text-center align-top">
                        <span className="inline-block bg-gray-100 text-gray-400 border border-gray-200 rounded px-2 py-0.5 text-xs font-bold mt-0.5">
                          {item.discount} %
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center align-top">
                        {item.discount > 0 ? (
                          <span className="inline-block bg-[#E51C23] text-white text-xs font-bold px-2 py-0.5 rounded mt-0.5">
                            -{discountAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right pr-6 align-top">
                        <div className="flex justify-end items-start gap-4">
                          <div>
                            <p className="font-bold text-zinc-900 text-base">{finalLineTotal.toFixed(2)}</p>
                            {item.discount > 0 && <p className="text-[10px] text-gray-400">ลดเพิ่มท้ายบิล: {item.discount}%</p>}
                          </div>
                          <button className="text-gray-300 hover:text-red-500 mt-1 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🔍 แถบค้นหา/ป้อนข้อมูลด้านล่างสุด */}
        <div className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="การป้อนข้อมูลด้วยตนเอง / เครื่องสแกนบาร์โค้ด..."
              className="w-full bg-white border border-gray-300 rounded pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-red-500 shadow-sm"
            />
          </div>
          <button className="bg-[#1C1B1B] hover:bg-zinc-800 text-white font-bold px-8 py-3 rounded text-sm transition-colors shadow-sm">
            เพิ่มรายการ
          </button>
        </div>
      </div>

      {/* ─── ฝั่งขวา: ข้อมูลลูกค้า สรุปยอดเงิน และ ยืนยันการขาย (27% Width) ─── */}
      <div className="w-[27%] bg-white border-l border-gray-200 p-6 flex flex-col justify-between shadow-xl">
        <div>
          {/* ข้อมูลลูกค้าหมวดหมู่บน */}
          <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">ข้อมูลลูกค้า</p>
          <div className="grid grid-cols-3 gap-1 mb-2">
            <button className="border border-gray-200 text-[11px] font-bold py-2 rounded bg-white text-gray-600">ทั่วไป</button>
            <button className="border border-gray-200 text-[11px] font-bold py-2 rounded bg-white text-gray-400 uppercase">Credit</button>
            <button className="border border-zinc-900 text-[11px] font-bold py-2 rounded bg-zinc-900 text-white uppercase">Special</button>
          </div>
          <div className="grid grid-cols-2 gap-1 mb-4">
            <button className="border border-gray-300 text-xs font-bold py-1.5 rounded bg-white text-zinc-800 shadow-sm">เงินสด</button>
            <button className="border border-gray-100 text-xs font-bold py-1.5 rounded bg-[#F9FAFB] text-gray-400">เงินเชื่อ</button>
          </div>

          {/* การ์ดโปรไฟล์ลูกค้าสีดำ */}
          <div className="bg-[#1C1B1B] text-white rounded p-4 mb-6 border border-zinc-800 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-extrabold tracking-tight">สมชาย ใจดี</h3>
                <p className="text-xs text-zinc-400 mt-0.5">โทร: 0967985115</p>
              </div>
              <div className="bg-[#14532D] text-[#22C55E] text-[10px] font-bold px-2 py-1 rounded text-center leading-tight">
                ระดับราคา<br />ราคามาตรฐาน
              </div>
            </div>
            
            {/* แถบสถานะส่วนลดลูกค้าอู่ */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                <span>ไม่มีการใช้เครดิตในระดับราคานี้</span>
                <span className="font-bold text-white">0%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-zinc-600 h-full w-[0%]"></div>
              </div>
            </div>

            {/* บล็อกยอดคงเหลือ / เครดิต */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-[#2A2929] rounded p-2 border border-zinc-700">
                <p className="text-[10px] text-zinc-400 font-medium">ยอดดวงเหลือปัจจุบัน</p>
                <p className="text-base font-bold mt-1">฿0.00</p>
              </div>
              <div className="bg-[#2A2929] rounded p-2 border border-zinc-700">
                <p className="text-[10px] text-zinc-400 font-medium">เครดิตคงเหลือ</p>
                <p className="text-base font-bold mt-1">฿0.00</p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3 flex items-center gap-1">
              <span>🕒</span> วงเงินเครดิต: ฿0.00
            </p>
          </div>

          {/* 🧾 ส่วนสรุปบิล (Calculation Area) */}
          <div className="space-y-3 border-t border-gray-100 pt-4 text-sm font-medium">
            <div className="flex justify-between text-gray-500">
              <span>ราคารวมสินค้า</span>
              <span className="font-bold text-zinc-900 text-base">{totalItemPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>ส่วนลดท้ายบิล</span>
              <span className="font-bold text-zinc-900 text-base">0.00</span>
            </div>
            <div className="flex justify-between text-red-600 font-bold border-b border-gray-100 pb-4">
              <span>ส่วนลดรวมทั้งสิ้น</span>
              <span className="text-lg">{(totalLineDiscount + parseFloat(billDiscount || "0")).toFixed(2)}</span>
            </div>
          </div>

          {/* กล่องยอดชำระสุทธิสีดำขนาดใหญ่ */}
          <div className="bg-[#1C1B1B] text-white rounded p-5 my-6 flex justify-between items-center shadow-md border border-zinc-800">
            <div className="text-zinc-400 text-xs font-medium">
              ยอดชำระสุทธิ
            </div>
            <div className="text-right">
              <span className="text-3xl font-black tracking-tight">{finalTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              <p className="text-[10px] text-red-500 font-bold mt-0.5">สกุลเงิน: บาท</p>
            </div>
          </div>

          {/* วิธีการชำระเงินด้านล่างสุด */}
          <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">เลือกวิธีการชำระเงิน</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethod("cash")}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all ${
                paymentMethod === "cash" ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"
              }`}
            >
              <Coins size={18} className="mb-1" />
              <span>เงินสด</span>
            </button>
            <button
              onClick={() => setPaymentMethod("qr")}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all ${
                paymentMethod === "qr" ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"
              }`}
            >
              <QrCode size={18} className="mb-1" />
              <span>QR CODE</span>
            </button>
            <button
              onClick={() => setPaymentMethod("credit")}
              className={`flex flex-col items-center justify-center py-3 rounded border text-xs font-bold transition-all ${
                paymentMethod === "credit" ? "border-red-600 bg-white text-red-600 border-b-4" : "border-gray-200 bg-[#F9FAFB] text-gray-400"
              }`}
            >
              <CreditCard size={18} className="mb-1" />
              <span>CREDIT</span>
            </button>
          </div>
        </div>

        {/* ปุ่มใหญ่ยักษ์ยืนยันการขายสีแดงล่างสุด */}
        <button className="w-full bg-[#E51C23] hover:bg-[#B70011] text-white font-black text-lg py-4 rounded shadow-lg transition-all duration-300 transform active:scale-[0.99] mt-6 tracking-wide">
          ยืนยันการขาย
        </button>
      </div>

    </div>
  );
}