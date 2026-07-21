import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, CheckCircle, Clock, XCircle, 
  Calendar, Phone, User, Package, Camera, Lock
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContexts';
import Heading from '../../../components/elements/heading';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Button from '../../../components/elements/button';

interface ClaimItem {
  id: number;
  claim_no: string;
  claim_date: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const DEFAULT_CLAIMS: ClaimItem[] = [
  {
    id: 1,
    claim_no: 'CLM-2026-0001',
    claim_date: '2026-07-02T10:30:00Z',
    customer_name: 'คุณสมชาย สายช่าง',
    customer_phone: '081-234-5678',
    product_name: 'กรองอากาศ เบอร์ 24',
    quantity: 2,
    amount: 1000,
    status: 'PENDING',
  },
  {
    id: 2,
    claim_no: 'CLM-2026-0002',
    claim_date: '2026-07-04T14:15:00Z',
    customer_name: 'อู่สงวนอะไหล่ยนต์',
    customer_phone: '089-876-5432',
    product_name: 'โช้คอัพหลัง ยี่ห้อ TOKI',
    quantity: 1,
    amount: 2500,
    status: 'APPROVED',
  },
];

export default function ClaimDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth() as any;
  const isManager = role === 'OWNER' || role === 'ADMIN';

  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [claim, setClaim] = useState<ClaimItem | null>(null);

  // Load claims from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mock_claims');
    let loadedClaims = DEFAULT_CLAIMS;
    if (saved) {
      try {
        loadedClaims = JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    } else {
      localStorage.setItem('mock_claims', JSON.stringify(DEFAULT_CLAIMS));
    }
    setClaims(loadedClaims);

    const found = loadedClaims.find(c => c.id === Number(id));
    if (found) {
      setClaim(found);
    }
  }, [id]);

  // Handle status update
  const handleStatusUpdate = (newStatus: 'APPROVED' | 'REJECTED') => {
    if (!claim) return;
    const updatedClaims = claims.map(c => 
      c.id === claim.id ? { ...c, status: newStatus } : c
    );
    setClaims(updatedClaims);
    localStorage.setItem('mock_claims', JSON.stringify(updatedClaims));
    setClaim({ ...claim, status: newStatus });
    
    alert(`ดำเนินการ ${newStatus === 'APPROVED' ? 'อนุมัติผ่านเคลม' : 'ปฏิเสธคำขอ'} เรียบร้อยแล้ว`);
    navigate('/owner/claims');
  };

  if (!claim) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500 font-bold">ไม่พบข้อมูลใบเคลมสินค้าที่คุณระบุ</p>
        <Button onClick={() => navigate('/owner/claims')} variant="outline">กลับหน้าหลัก</Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 bg-gray-50 min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/owner/claims')} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
          >
            <ChevronLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <Heading level="h2" weight="semibold" className="mb-0 text-gray-800">
              รายละเอียดใบเคลมสินค้า
            </Heading>
            <Heading level="h6" weight="light" className="m-0 text-slate-500 mt-1">
              เลขที่ใบเคลม: {claim.claim_no}
            </Heading>
          </div>
        </div>
        
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
          claim.status === 'APPROVED' 
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
            : claim.status === 'REJECTED' 
              ? 'bg-red-50 text-red-600 border border-red-100' 
              : 'bg-amber-50 text-amber-600 border border-amber-100'
        }`}>
          {claim.status === 'APPROVED' ? (
            <CheckCircle size={14} />
          ) : claim.status === 'REJECTED' ? (
            <XCircle size={14} />
          ) : (
            <Clock size={14} />
          )}
          {claim.status === 'APPROVED' ? 'อนุมัติแล้ว' : claim.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
        </span>
      </div>

      {/* Grid Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Left Side: Main Info (2/3) */}
        <div className="w-full lg:w-3/4 flex flex-col gap-6">
          
          {/* Card: Customer Details */}
          <Card className="border-l-[5px] border-l-red-800">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">ข้อมูลผู้ยื่นคำขอเคลม</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <User className="text-slate-400" size={18} />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">ชื่อลูกค้า</p>
                    <p className="font-bold text-slate-800">{claim.customer_name}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="text-slate-400" size={18} />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">เบอร์โทรศัพท์</p>
                    <p className="font-bold text-slate-800">{claim.customer_phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:col-span-2 border-t border-slate-100 pt-3">
                  <Calendar className="text-slate-400" size={18} />
                  <div>
                    <p className="text-xs text-slate-400 font-bold">วันที่ยื่นขอเคลม</p>
                    <p className="font-semibold text-slate-600 text-xs">
                      {new Date(claim.claim_date).toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Claimed Items */}
          <Card className="border-l-[5px] border-l-black overflow-hidden">
            <CardHeader className="items-center justify-start gap-4 bg-slate-50/50">
              <CardTitle className="text-lg">สินค้าที่ต้องการเคลม</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto px-5 py-4">
                <table className="w-full text-sm text-left">
                  <thead className="text-slate-500 text-xs border-b border-slate-150">
                    <tr>
                      <th className="py-2.5 px-2 font-bold text-slate-500">ชื่อสินค้า</th>
                      <th className="py-2.5 px-2 text-center font-bold text-slate-500">จำนวนเคลม</th>
                      <th className="py-2.5 px-2 text-right font-bold text-slate-500">มูลค่ารวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold">
                    <tr>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <Package className="text-[#e51c23] shrink-0" size={18} />
                          <span className="text-slate-800 text-sm font-bold">{claim.product_name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center text-slate-600">{claim.quantity} ชิ้น</td>
                      <td className="py-4 px-2 text-right text-slate-900 font-extrabold">฿{claim.amount.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Card: Damaged Details & Notes */}
          <Card className="border-l-[5px] border-l-slate-400">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">รายละเอียดสาเหตุการชำรุดเสียหาย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 py-2 text-sm">
                <div className="text-slate-700 bg-slate-100 p-4 rounded border border-slate-200 font-semibold italic">
                  "{claim.id === 1 ? 'ซีลยางกรองอากาศฉีกขาดหลังจากติดตั้งใช้งานได้ 1 วัน' : claim.id === 2 ? 'แกนโช้คอัพคดงอและมีคราบน้ำมันซึมออกมาด้านข้าง' : 'กรองอากาศบิดเบี้ยวผิดรูป'}"
                </div>
                
                <div>
                  <p className="text-xs text-slate-400 font-bold mb-2">รูปภาพหลักฐานที่ส่งประกอบคำขอ</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-28 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold relative overflow-hidden group">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Camera size={14} /> รูปถ่ายรอยฉีกขาด.jpg
                      </span>
                    </div>
                    <div className="h-28 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-semibold relative overflow-hidden group">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Camera size={14} /> รูปซีลยางอะไหล่.png
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Side: Approval Panel (1/3) */}
        <div className="w-full lg:w-1/4 flex flex-col gap-6">
          <Card className="border-t-[5px] border-t-red-800">
            <CardHeader className="items-center justify-start gap-4">
              <CardTitle className="text-lg">ดำเนินการโดยระบบ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-xs">
                <div className="text-slate-500 font-bold">
                  * ใบเคลมนี้อยู่ในขั้นตอนการตรวจสอบสิทธิ์และสภาพอะไหล่
                </div>

                {claim.status === 'PENDING' ? (
                  <div className="space-y-3 pt-2">
                    {isManager ? (
                      <>
                        <Button
                          type="button"
                          onClick={() => handleStatusUpdate('APPROVED')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 justify-center shadow-sm flex items-center gap-2"
                        >
                          <CheckCircle size={18} /> อนุมัติผ่านเคลม
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleStatusUpdate('REJECTED')}
                          className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 justify-center shadow-sm flex items-center gap-2"
                        >
                          <XCircle size={18} /> ปฏิเสธคำขอเคลม
                        </Button>
                      </>
                    ) : (
                      <div className="bg-slate-100 p-3 rounded text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
                        <Lock size={14} /> สิทธิ์การอนุมัติเฉพาะผู้จัดการหรือเจ้าของร้าน
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded border border-slate-150 text-center space-y-2">
                    <p className="text-xs text-slate-400 font-bold">ดำเนินการตรวจสอบเสร็จสิ้น</p>
                    <p className={`font-extrabold text-sm ${
                      claim.status === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {claim.status === 'APPROVED' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธคำขอเรียบร้อย'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
