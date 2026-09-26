import * as XLSX from 'xlsx';
import type { BillItemDTO, ColumnMapping } from '../interface/import';

// อ่านวัน/เดือน/ปีตามเขตเวลาของเครื่อง ไม่ใช้ toISOString() เพราะมันแปลงเป็น UTC ก่อน
// วันที่ที่ถูกตีความเป็นเที่ยงคืนตามเวลาไทย (UTC+7) จะถอยไปเป็นวันก่อนหน้าทันที
// เช่น "Aug 1 2025" เคยได้ผลเป็น 2025-07-31 ทำให้วันที่บิลและวันครบกำหนดชำระเพี้ยนไป 1 วัน
function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeDateValue(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatLocalDate(val);
  }

  if (typeof val === 'number') {
    // Excel date serial number
    if (val > 20000 && val < 60000) {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }
    return '';
  }

  const text = String(val).trim();
  // dd/mm/yyyy (รองรับปี พ.ศ. > 2400 → แปลงเป็น ค.ศ.)
  const dmMatch = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmMatch) {
    let year = Number(dmMatch[3]);
    if (year < 100) year += 2500;
    if (year > 2400) year -= 543;
    const month = Number(dmMatch[2]);
    const day = Number(dmMatch[1]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2200) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, '0')}-${String(Number(isoMatch[3])).padStart(2, '0')}`;
  }

  const parsedDate = new Date(text);
  if (!isNaN(parsedDate.getTime())) {
    return formatLocalDate(parsedDate);
  }

  return '';
}

const cleanKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');

export function getSimilarity(s1: string, s2: string): number {
  const w1 = cleanKey(s1);
  const w2 = cleanKey(s2);

  if (!w1 || !w2) return 0;
  if (w1 === w2) return 1.0;
  if (w1.includes(w2) || w2.includes(w1)) return 0.8;

  const track = Array(w2.length + 1).fill(null).map(() => Array(w1.length + 1).fill(null));
  for (let i = 0; i <= w1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= w2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= w2.length; j += 1) {
    for (let i = 1; i <= w1.length; i += 1) {
      const indicator = w1[i - 1] === w2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
    }
  }
  const distance = track[w2.length][w1.length];
  const maxLength = Math.max(w1.length, w2.length);
  return maxLength === 0 ? 0 : 1 - distance / maxLength;
}

const FIELD_KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  code: ['code', 'product_code', 'รหัส', 'รหัสสินค้า', 'part_number', 'part_no', 'sku', 'รหัสอะไหล่'],
  name: ['name', 'product_name', 'ชื่อ', 'ชื่อสินค้า', 'description', 'detail', 'รายการ', 'ชื่ออะไหล่', 'คำอธิบาย'],
  quantity: ['quantity', 'qty', 'จำนวน', 'ordered', 'vol', 'ยอดสั่งซื้อ'],
  unit: ['unit', 'หน่วย', 'uom', 'pack', 'ขนาดบรรจุ'],
  price: ['price', 'rate', 'ราคา', 'ราคาต่อหน่วย', 'cost', 'unit_cost', 'unit price', 'unitcost'],
};

export const REQUIRED_MAPPING_FIELDS: (keyof ColumnMapping)[] = ['code', 'name', 'quantity', 'price'];

interface ColumnStats {
  filled: number;
  numRate: number;
  intRate: number;
  avgTextLen: number;
  codeRate: number;
  avgNumValue: number;
}

// วิเคราะห์ "เนื้อหา" ของแต่ละคอลัมน์ เพื่อเดา field กรณีหัวคอลัมน์ไม่บอกอะไรชัดเจน
function analyzeColumn(rows: any[][], colIdx: number): ColumnStats {
  const sampleLimit = 200;
  let filled = 0;
  let numeric = 0;
  let integerish = 0;
  let textLenSum = 0;
  let codeLike = 0;
  let numValueSum = 0;

  for (let r = 0; r < Math.min(rows.length, sampleLimit); r++) {
    const v = rows[r]?.[colIdx];
    if (v === null || v === undefined || String(v).trim() === '') continue;
    filled += 1;

    const s = String(v).trim();
    const n = Number(String(v).replace(/[^0-9.-]/g, ''));
    const isNum = typeof v === 'number' || (!isNaN(n) && /^[\d\s.,\u0e3f$%()-]+$/.test(s));
    if (isNum) {
      numeric += 1;
      if (!isNaN(n)) {
        numValueSum += Math.abs(n);
        if (Number.isInteger(n)) integerish += 1;
      }
    }
    textLenSum += s.length;
    // รูปแบบรหัสสินค้า: ตัวอักษร/ตัวเลขสั้นๆ ผสมกัน เช่น ABC-123, 04452-BZ010
    if (s.length <= 24 && /^[A-Za-z0-9._/-]+$/.test(s) && /\d/.test(s)) {
      codeLike += 1;
    }
  }

  return {
    filled,
    numRate: filled > 0 ? numeric / filled : 0,
    intRate: numeric > 0 ? integerish / numeric : 0,
    avgTextLen: filled > 0 ? textLenSum / filled : 0,
    codeRate: filled > 0 ? codeLike / filled : 0,
    avgNumValue: numeric > 0 ? numValueSum / numeric : 0,
  };
}

// เดาการจับคู่คอลัมน์อัตโนมัติ: ใช้ชื่อหัวคอลัมน์ (keyword + fuzzy) ร่วมกับลักษณะข้อมูลจริงใน cell
export function guessColumnMapping(
  headers: string[],
  rows: any[][]
): { mapping: ColumnMapping; confidence: number } {
  const stats = headers.map((_, idx) => analyzeColumn(rows, idx));
  const genericHeader = (h: string) => /^\(คอลัมน์\s*\d+\)$/.test(h.trim());

  const headerScoreOf = (header: string, kw: string): number => {
    if (genericHeader(header)) return 0;
    const h = cleanKey(header);
    const k = cleanKey(kw);
    if (!h || !k) return 0;
    if (h === k) return 1;
    if (h.includes(k) || k.includes(h)) return 0.85;
    return getSimilarity(header, kw);
  };

  // คะแนนจากเนื้อหา cell ของแต่ละ field (0..1)
  const contentScoreOf = (field: keyof ColumnMapping, st: ColumnStats): number => {
    if (st.filled === 0) return 0;
    switch (field) {
      case 'code':
        return st.codeRate * 0.8 + (st.numRate < 0.5 ? 0.2 : 0);
      case 'name':
        return (1 - st.numRate) * Math.min(st.avgTextLen / 12, 1);
      case 'quantity':
        return st.numRate * st.intRate;
      case 'price':
        return st.numRate * (st.intRate < 0.95 ? 1 : st.avgNumValue >= 40 ? 0.75 : 0.45);
      case 'unit':
        return st.avgTextLen > 0 && st.numRate < 0.3 ? Math.min((6 - Math.abs(st.avgTextLen - 4)) / 6, 0.6) : 0;
      default:
        return 0;
    }
  };

  const weights = { header: 0.65, content: 0.35 };
  const mapping: ColumnMapping = { code: '', name: '', quantity: '', unit: '', price: '' };
  const used = new Set<number>();
  const scores: Record<string, number> = {};

  // จับคู่ทีละ field: เลือกคอลัมน์ที่ได้คะแนนรวมสูงสุด (ไม่ซ้ำคอลัมน์เดียวกัน)
  (Object.keys(FIELD_KEYWORDS) as (keyof ColumnMapping)[]).forEach((field) => {
    let bestCol = -1;
    let bestScore = 0;

    headers.forEach((header, idx) => {
      if (used.has(idx) || stats[idx].filled === 0) return;

      let hs = 0;
      FIELD_KEYWORDS[field].forEach((kw) => {
        const s = headerScoreOf(header, kw);
        if (s > hs) hs = s;
      });
      const cs = contentScoreOf(field, stats[idx]);
      const total = hs * weights.header + cs * weights.content;

      if (total > bestScore) {
        bestScore = total;
        bestCol = idx;
      }
    });

    if (bestCol >= 0 && bestScore >= 0.4) {
      mapping[field] = headers[bestCol];
      used.add(bestCol);
      scores[field] = bestScore;
    }
  });

  // Fallback: ถ้าจำนวน/ราคายังไม่เจอ แต่มีคอลัมน์ตัวเลขเหลืออยู่ — ให้จำนวน = คอลัมน์ที่เป็นจำนวนเต็มล้วนที่สุด, ราคา = อีกคอลัมน์ (ค่าเฉลี่ยสูงกว่า)
  const remainingNumeric = headers
    .map((_, idx) => idx)
    .filter((idx) => !used.has(idx) && stats[idx].numRate >= 0.8)
    .sort((a, b) => stats[b].intRate - stats[a].intRate);

  if (!mapping.quantity && !mapping.price && remainingNumeric.length >= 2) {
    mapping.quantity = headers[remainingNumeric[0]];
    used.add(remainingNumeric[0]);
    const priceCandidate = remainingNumeric
      .slice(1)
      .sort((a, b) => stats[b].avgNumValue - stats[a].avgNumValue)[0];
    if (priceCandidate !== undefined) {
      mapping.price = headers[priceCandidate];
      used.add(priceCandidate);
      scores.quantity = scores.quantity ?? 0.5;
      scores.price = scores.price ?? 0.5;
    }
  }

  const requiredScores = REQUIRED_MAPPING_FIELDS.map((f) => scores[f] ?? 0);
  const foundCount = REQUIRED_MAPPING_FIELDS.filter((f) => !!mapping[f]).length;
  const confidence =
    foundCount === REQUIRED_MAPPING_FIELDS.length
      ? requiredScores.reduce((a, b) => a + b, 0) / requiredScores.length
      : 0;

  return { mapping, confidence };
}

export interface ItemIssue {
  fields: string[];
  messages: string[];
}

// ตรวจสอบรายการสินค้ารายแถว — ใช้แสดง error inline ในตาราง
export function validateBillItems(items: BillItemDTO[]): Record<number, ItemIssue> {
  const issues: Record<number, ItemIssue> = {};
  const codeCount: Record<string, number[]> = {};

  items.forEach((item, idx) => {
    const code = String(item.company_product_code || '').trim();
    const name = String(item.company_product_name || '').trim();
    const qty = Number(item.order_quantity);
    const price = Number(item.price_per_unit);
    const fields: string[] = [];
    const messages: string[] = [];

    // แถวที่พึ่งกด "เพิ่มรายการสินค้า" มาใหม่ (ยังไม่มีรหัส/ชื่อ/ราคาเลย) ยังไม่นับเป็นข้อผิดพลาด
    // รอให้ผู้ใช้เริ่มกรอกอย่างน้อย 1 ช่องก่อนถึงจะเตือน ไม่งั้นเตือนทันทีที่กดเพิ่มแถวจะดูเหมือนระบบพัง
    const isUntouchedBlankRow = !code && !name && price === 0;

    if (!code && !name) {
      if (!isUntouchedBlankRow) {
        fields.push('code', 'name');
        messages.push('กรอกรหัสหรือชื่อสินค้า');
      }
    } else if (!name) {
      fields.push('name');
      messages.push('กรอกชื่อสินค้า');
    }

    if (isNaN(qty) || qty < 0) {
      fields.push('quantity');
      messages.push('จำนวนไม่ถูกต้อง');
    } else if (qty === 0) {
      fields.push('quantity');
      messages.push('จำนวนเป็น 0 — ระบุจำนวนที่รับจริง');
    }

    if (isNaN(price) || price < 0) {
      fields.push('price');
      messages.push('ราคาไม่ถูกต้อง');
    }

    if (code) {
      if (!codeCount[code]) codeCount[code] = [];
      codeCount[code].push(idx);
    }

    if (messages.length > 0) {
      issues[idx] = { fields, messages };
    }
  });

  Object.entries(codeCount).forEach(([, idxs]) => {
    if (idxs.length > 1) {
      idxs.forEach((idx) => {
        const existing = issues[idx] || { fields: [], messages: [] };
        existing.fields.push('code');
        existing.messages.push(`รหัสสินค้าซ้ำกับแถว ${idxs.map((i) => i + 1).join(', ')}`);
        issues[idx] = existing;
      });
    }
  });

  return issues;
}
