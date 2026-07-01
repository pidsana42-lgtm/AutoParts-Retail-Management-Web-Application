import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChartNoAxesCombined, Info, ScanBarcode, ShoppingBag } from 'lucide-react';
import Heading from '../../../components/elements/heading';
import Button from '../../../components/elements/button';
import Input from '../../../components/elements/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/elements/card';
import Select from '../../../components/elements/select';

//  TODO: เขียนต่อให้เสร็จ
// function listsAllSupplier({name}:{supplier_name: string}) {
//     const defaultSupplier = name;
//     if 
// }

const CreatePurchaseOrders: React.FC = () => {
    const navigate = useNavigate();

    // States ของ API
    const [item, setItem] = useState<POItemResponse[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [listsSupplier, setlistsSupplier] = useState("others")
    const [date, setDate] = useState("");
    const [searchId, setSearchId] = useState("")
    
    return (
        <div className='p-8 space-y-6 bg-gray-50 min-h-screen'>
            { /* Header */ }
            <div className="flex items-center justify-between">
                <div className='flex-col'>
                    <Heading level='h2' weight='semibold' className='m-0 text-gray-800'>
                        สร้างใบสั่งซื้อสินค้าใหม่
                    </Heading>
                    { /* TODO: เติมฟังก์ชันเจนเลขใบสั่งซื้อใหม่ */ }
                    <Heading level='h7' weight='light' className='m-0 text-gray-800'>
                        ใบสั่งซื้อสินค้าใหม่เลขที่
                    </Heading>
                </div>
                <div className='flex items-end gap-4 justify-end'>
                    <Button size='md' variant='tertiary' onClick={() => saveDraft() }>บันทึกฉบับร่าง</Button>
                    <Button size='md' onClick={() => sendApprove() }>ส่งอนุมัติ</Button>
                </div>
            </div>

            { /* Contents */ }
            { /* Left Side */ }
            <div className="flex gap-6 items-stretch">
                <div className='w-1/4 flex flex-col gap-6'>
                    <Card className='border-l-[5px] border-l-red-800'>
                        <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                            <CardTitle className='text-base text-red-800'><Building2 className="h-6 w-6" /></CardTitle>
                            <CardTitle className='text-lg'>รายละเอียดบริษัท</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='grid grid-rows-2 gap-6 items-end mb-2'>
                                <Select label='ชื่อบริษัท/ผู้จัดจำหน่าย'
                                    value={listsSupplier}
                                    onChange={(e) => setlistsSupplier(e.target.value)}
                                    options={[
                                        { label: "ทั้งหมด",     value: "all" },
                                        { label: "ฉบับร่าง", value: "DRAFT" },
                                        { label: "รออนุมัติ", value: "PENDING"  },
                                        { label: "อนุมัติแล้ว", value: "APPROVED" },
                                        { label: "ไม่อนุมัติ",  value: "REJECTED" },
                                    ]}
                                />
                                <Input
                                    type='date'
                                    label='วันที่สั่งซื้อ'
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className='border-l-[5px] border-l-black'>
                        <CardHeader className='items-center justify-start gap-4 mt-2 mb-2'>
                            <CardTitle className='text-base text-black'><ShoppingBag className="h-6 w-6" /></CardTitle>
                            <CardTitle className='text-lg'>รายการพรีออเดอร์</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className='flex items-center justify-between h-fit'>
                                <Heading level='h8' weight='light'>มีรายการพรีออเดอร์ค้างอยู่ {totalItems} รายการ</Heading>
                                <Button variant='tertiary' size='sm'>เลือกรายการ</Button>
                            </div>
                        </CardContent>
                    </Card>
                    <div className='bg-[#22252a] text-white rounded-md p-6 h-fit shadow-sm relative overflow-hidden'>
                        <div className='absolute right-4 top-4 opacity-5 pointer-events-none'>
                            <ChartNoAxesCombined className='w-12 h-12' />
                        </div>
                        <div>
                            <Heading level='h6' weight='semibold' className='text-white'>ข้อมูลวิเคราะห์จากระบบ</Heading>
                            <Heading level='h8' weight='light' className='text-white mt-3'>โดยปกติบริษัทรายนี้จะใช้เวลาจัดส่ง  ทำการ เราขอแนะนำให้คุณวางแผนการขนส่งสำหรับ </Heading>
                            <div className='flex items-center justify-start gap-3 mt-3'>
                                <Heading className='text-base text-white w-auto m-0'>{<Info className="h-4 w-4" />}</Heading>
                                <Heading level='h8' weight='light' className='text-white w-auto m-0'>ระยะเวลาการจัดส่ง: แม่นยำร้อยละ </Heading>
                            </div>
                        </div>
                    </div>
                </div>

                { /* Right Side */ }
                <div className='flex items-start w-3/4'>
                    <Card className="flex items-center w-full h-fit bg-gray-50 p-4 gap-4">
                        <Input
                            containerClassName="flex-1"
                            className="bg-transparent border-none shadow-none focus:outline-none" // ลบสีพื้นหลังให้เนียนไปกับกล่องหลัก
                            leftIcon={<ScanBarcode className="w-6 h-6 text-gray-500" />}
                            placeholder="สแกนหรือพิมพ์ รหัส / ชื่อสินค้า..."
                        />
                        <div className="w-px h-8 bg-gray-300/60 mx-1"></div>
                        <Input
                            type="number"
                            containerClassName="w-32 shrink-0"
                            className="bg-transparent border-none shadow-none text-center px-1 focus:outline-none" // พื้นหลังใส และจัดตัวอักษรให้อยู่กึ่งกลาง
                            placeholder="จำนวน"
                        />
                        <Button size='md' variant='secondary'>
                            เพิ่มลงใบสั่งซื้อ
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default CreatePurchaseOrders;