import type { TrackingStage } from '../../../interface/claim/claim';

// เคลมประเภท INSTANT (เปลี่ยนทันที) และ CREDIT_ACCOUNT (ลงบัญชีเชื่อ) ลูกค้าได้ของ/ได้เครดิตไปแล้วตั้งแต่วันที่
// อนุมัติ จึงไม่มีขั้น "ส่งมอบลูกค้าแล้ว" ให้กด แต่ยังต้องอยู่ในแท็บติดตาม เพราะของเสียยังต้องรวบรวมส่งบริษัท และ
// การกด "ได้รับของเปลี่ยน" เป็นจุดเดียวที่ระบบรับสินค้าทดแทนกลับเข้าคลัง ชดเชยสต็อกที่ตัดออกไปตอนอนุมัติ
const HANDOVER_DONE_AT_APPROVAL = new Set(['INSTANT', 'CREDIT_ACCOUNT']);

export const needsCustomerHandover = (claimType?: string): boolean =>
  !HANDOVER_DONE_AT_APPROVAL.has((claimType || 'INSTANT').trim().toUpperCase());

// ขั้นสุดท้ายของแต่ละประเภท — ถึงขั้นนี้แล้วถือว่าปิดงาน แก้สถานะต่อไม่ได้อีก
export const finalTrackingStage = (claimType?: string): TrackingStage =>
  needsCustomerHandover(claimType) ? 'COMPLETED' : 'REPLACEMENT_RECEIVED';

// รวม COMPLETED ไว้เสมอ เผื่อข้อมูลเดิมที่เคยกด "ส่งมอบลูกค้าแล้ว" ไว้ตอนที่ทุกประเภทยังมีขั้นนี้
export const isTrackingFinished = (stage: TrackingStage, claimType?: string): boolean =>
  stage === 'COMPLETED' || stage === finalTrackingStage(claimType);

export const resolveTrackingStage = (resolution?: string): TrackingStage => {
  const value = (resolution || '').trim();
  if (value === 'COMPLETED' || value.includes('ส่งมอบ') || value.includes('สำเร็จ')) return 'COMPLETED';
  if (value === 'REPLACEMENT_RECEIVED' || value.includes('ได้รับของ') || value.includes('รับสินค้าทดแทน')) return 'REPLACEMENT_RECEIVED';
  if (value === 'SENT_TO_SUPPLIER' || value.includes('ส่งบริษัท') || value.includes('ส่งโรงงาน')) return 'SENT_TO_SUPPLIER';
  return 'WAITING_SEND';
};
