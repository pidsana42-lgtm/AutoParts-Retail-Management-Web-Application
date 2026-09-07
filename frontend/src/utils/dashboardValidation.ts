import type {
  DebtAgingQuery,
  SummaryQuery,
} from '../interface/dashboard/dashboard_interface';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_KEYS: (keyof SummaryQuery)[] = [
  'weekly_summary',
  'monthly_summary',
  'quarterly_summary',
  'yearly_summary',
];
const DEBT_STATUSES = new Set(['เกินกำหนด', 'ทยอยชำระ', 'ชำระหมดแล้ว']);

export class DashboardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardValidationError';
  }
}

function assertIsoDate(field: string, value?: string): void {
  if (!value) return;
  if (!DATE_PATTERN.test(value)) {
    throw new DashboardValidationError(`${field} ต้องอยู่ในรูปแบบ YYYY-MM-DD`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new DashboardValidationError(`${field} เป็นวันที่ที่ไม่ถูกต้อง`);
  }
}

function assertDateRange(startDate?: string, endDate?: string): void {
  assertIsoDate('start_date', startDate);
  assertIsoDate('end_date', endDate);
  if (startDate && endDate && startDate > endDate) {
    throw new DashboardValidationError('start_date ต้องไม่อยู่หลัง end_date');
  }
}

export function assertPositiveInteger(
  field: string,
  value: number,
  maximum?: number,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DashboardValidationError(`${field} ต้องเป็นจำนวนเต็มมากกว่า 0`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new DashboardValidationError(`${field} ต้องไม่เกิน ${maximum}`);
  }
}

export function validateSummaryQuery(query: SummaryQuery): void {
  assertIsoDate('summary_date', query.summary_date);
  assertIsoDate('ref_date', query.ref_date);
  assertDateRange(query.start_date, query.end_date);
  if (query.end_date && !query.start_date) {
    throw new DashboardValidationError('end_date ต้องระบุคู่กับ start_date');
  }

  for (const key of PERIOD_KEYS) {
    const value = query[key];
    if (value !== undefined && value !== '1') {
      throw new DashboardValidationError(`${key} ต้องมีค่าเป็น 1`);
    }
  }

  const activeFilters = [
    Boolean(query.summary_date),
    Boolean(query.start_date || query.end_date),
    ...PERIOD_KEYS.map((key) => Boolean(query[key])),
  ].filter(Boolean).length;

  if (activeFilters > 1) {
    throw new DashboardValidationError('เลือกตัวกรองช่วงเวลาได้เพียงหนึ่งรูปแบบ');
  }
}

export function validateDebtAgingQuery(query: DebtAgingQuery): void {
  assertDateRange(query.start_date, query.end_date);

  if (query.status && !DEBT_STATUSES.has(query.status)) {
    throw new DashboardValidationError('status ของอายุหนี้ไม่ถูกต้อง');
  }

  for (const [field, value] of [
    ['min_age_days', query.min_age_days],
    ['max_age_days', query.max_age_days],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new DashboardValidationError(`${field} ต้องเป็นจำนวนเต็มที่ไม่ติดลบ`);
    }
  }

  if (
    query.min_age_days !== undefined &&
    query.max_age_days !== undefined &&
    query.min_age_days > query.max_age_days
  ) {
    throw new DashboardValidationError('min_age_days ต้องไม่เกิน max_age_days');
  }

  if (query.page !== undefined) assertPositiveInteger('page', query.page);
  if (query.page_size !== undefined) {
    assertPositiveInteger('page_size', query.page_size, 100);
  }
}
