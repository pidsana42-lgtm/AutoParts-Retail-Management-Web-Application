import { describe, expect, it } from 'vitest';
import { formatDateThai, getDashboardPeriodDateRange } from './formatdate';

describe('dashboard date formatting', () => {
  const today = new Date(2026, 8, 18, 12, 0, 0);

  it('formats an ISO date as a Buddhist Era date with the requested separator', () => {
    expect(formatDateThai('2026-09-18', '-')).toBe('18-09-2569');
  });

  it('resolves dashboard presets to concrete inclusive date ranges', () => {
    expect(getDashboardPeriodDateRange('daily', today)).toEqual({
      startDate: '2026-09-18',
      endDate: '2026-09-18',
    });
    expect(getDashboardPeriodDateRange('weekly', today)).toEqual({
      startDate: '2026-09-13',
      endDate: '2026-09-19',
    });
    expect(getDashboardPeriodDateRange('monthly', today)).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(getDashboardPeriodDateRange('quarterly', today)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-09-30',
    });
    expect(getDashboardPeriodDateRange('yearly', today)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
  });
});
