import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProductSearchSelect from './product_search_select';
import type { Product } from '../../../../interface/import';

// เคสจริงที่เจอจากบิลนำเข้า: OCR อ่านชื่อ "หม้อน้ำฟอร์ด..." ถูกต้อง แต่คลังสินค้ายังไม่มีหม้อน้ำ
// ตัวนี้อยู่จริง เดิมช่องนี้ยังขึ้นสปริงคันเกียร์ (คะแนนต่ำ) มาเป็นฟอลแบ็คให้เลือกเดา ทำให้พนักงาน
// เข้าใจผิดว่าเป็นคำแนะนำ — ตามที่ผู้ใช้ยืนยัน: "เอาฟอลแบ็คออก ถ้าไม่สำเร็จก็ขึ้นไม่สำเร็จ"
const products: Product[] = [
  {
    id: 1,
    product_code: 'ELELED-00001',
    product_name: 'สปริงคันเกียร์ DTแท้ 58x3 mm. FORD/NEWHOLLAND, 50006600, 81818220, C7NN7227A',
  } as Product,
];

// ชื่อสินค้าตัวจริงที่ตรงกันเป๊ะ (คะแนนควรถึงเกณฑ์มั่นใจ)
const exactMatchProduct: Product = {
  id: 2,
  product_code: 'ENG-00063',
  product_name: 'หม้อน้ำฟอร์ด DTแท้ ทองเหลืองแท้ หนา FORD/NEWHOLLAND, 50006600, 8187280, C7NN8005L',
} as Product;

const companyProductName = 'หม้อน้ำฟอร์ด DTแท้ ทองเหลืองแท้-หนา FORD/NEWHOLLAND, 50006600, 8187280,C7NN8005L';

describe('ProductSearchSelect — เกณฑ์ความมั่นใจของคำแนะนำ (ไม่มีฟอลแบ็ครายการเดา)', () => {
  it('ไม่มีสินค้าคะแนนถึงเกณฑ์มั่นใจ: ขึ้นข้อความว่าไม่พบ ไม่โชว์รายการเดาคะแนนต่ำ', async () => {
    render(
      <ProductSearchSelect
        value={null}
        onChange={vi.fn()}
        products={products}
        companyProductCode=""
        companyProductName={companyProductName}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button'));

    // สินค้าคะแนนต่ำต้องไม่ถูกโชว์เป็นรายการให้เลือกเดาอีกต่อไป (ไม่มีฟอลแบ็ค)
    expect(screen.queryByText(/สปริงคันเกียร์/)).not.toBeInTheDocument();
    expect(screen.queryByText('รายการที่ระบบวิเคราะห์ว่าตรงกันมากที่สุด')).not.toBeInTheDocument();
    expect(await screen.findByText(/ระบบไม่พบสินค้าที่ตรงกับรายการนี้/)).toBeInTheDocument();
  });

  it('ขึ้นหัวข้อ "ตรงกันมากที่สุด" เมื่อมีสินค้าคะแนนถึงเกณฑ์มั่นใจจริงๆ', async () => {
    render(
      <ProductSearchSelect
        value={null}
        onChange={vi.fn()}
        products={[...products, exactMatchProduct]}
        companyProductCode=""
        companyProductName={companyProductName}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button'));

    expect(await screen.findByText('รายการที่ระบบวิเคราะห์ว่าตรงกันมากที่สุด')).toBeInTheDocument();
    expect(screen.getByText(/หม้อน้ำฟอร์ด/)).toBeInTheDocument();
    // สินค้าคะแนนต่ำที่ไม่ถึงเกณฑ์ยังไม่ควรถูกโชว์เป็นรายการเดา
    expect(screen.queryByText(/สปริงคันเกียร์/)).not.toBeInTheDocument();
  });

  it('พิมพ์ค้นหาเองยังใช้ได้ตามปกติ ไม่ติดเกณฑ์ความมั่นใจ', async () => {
    render(
      <ProductSearchSelect
        value={null}
        onChange={vi.fn()}
        products={products}
        companyProductCode=""
        companyProductName={companyProductName}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    await user.type(screen.getByPlaceholderText('พิมพ์ชื่อ, รหัสสินค้า หรือหมวดหมู่'), 'สปริง');

    expect(await screen.findByText(/สปริงคันเกียร์/)).toBeInTheDocument();
  });
});
