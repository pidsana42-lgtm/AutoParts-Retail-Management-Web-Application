import { describe, expect, it } from 'vitest';
import { assertPositiveInteger, DashboardValidationError, validateDebtAgingQuery, validateSummaryQuery } from './dashboardValidation';

describe('dashboard query validation', () => {
  it.each([
    {},
    { summary_date: '2026-09-07' },
    { start_date: '2026-09-01', end_date: '2026-09-07' },
    { weekly_summary: '1', ref_date: '2026-08-31' },
  ])('accepts a valid summary query: %o', (query) => {
    expect(() => validateSummaryQuery(query)).not.toThrow();
  });

  it.each([
    [{ summary_date: '07-09-2026' }, 'YYYY-MM-DD'],
    [{ summary_date: '2026-02-30' }, 'ไม่ถูกต้อง'],
    [{ start_date: '2026-09-08', end_date: '2026-09-07' }, 'start_date'],
    [{ end_date: '2026-09-07' }, 'start_date'],
    [{ weekly_summary: 'yes' }, 'weekly_summary'],
    [{ summary_date: '2026-09-07', monthly_summary: '1' }, 'เพียงหนึ่ง'],
  ])('rejects an invalid summary query: %o', (query, message) => {
    expect(() => validateSummaryQuery(query)).toThrow(message);
  });

  it('validates debt-aging filters and pagination', () => {
    expect(() => validateDebtAgingQuery({
      status: 'เกินกำหนด',
      min_age_days: 31,
      max_age_days: 60,
      page: 1,
      page_size: 100,
    })).not.toThrow();

    expect(() => validateDebtAgingQuery({ status: 'unknown' })).toThrow('status');
    expect(() => validateDebtAgingQuery({ min_age_days: -1 })).toThrow('min_age_days');
    expect(() => validateDebtAgingQuery({ min_age_days: 61, max_age_days: 60 })).toThrow('min_age_days');
    expect(() => validateDebtAgingQuery({ page_size: 101 })).toThrow('100');
  });

  it('requires positive integer scalar filters', () => {
    expect(() => assertPositiveInteger('days', 30)).not.toThrow();
    expect(() => assertPositiveInteger('days', 0)).toThrow(DashboardValidationError);
    expect(() => assertPositiveInteger('limit', 10.5)).toThrow('จำนวนเต็ม');
  });
});
