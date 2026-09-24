import { describe, expect, it } from 'vitest';
import {
  formatDateThai,
  getDashboardPeriodDateRange,
  getDashboardPreviousPeriodDateRange,
} from './formatdate';

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

  it('uses an equally long elapsed window for the previous dashboard period', () => {
    expect(getDashboardPreviousPeriodDateRange('daily', today)).toEqual({
      startDate: '2026-09-17',
      endDate: '2026-09-17',
    });
    expect(getDashboardPreviousPeriodDateRange('weekly', today)).toEqual({
      startDate: '2026-09-06',
      endDate: '2026-09-11',
    });
    expect(getDashboardPreviousPeriodDateRange('monthly', today)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-18',
    });
    expect(getDashboardPreviousPeriodDateRange('quarterly', today)).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-06-19',
    });
    expect(getDashboardPreviousPeriodDateRange('yearly', today)).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-09-18',
    });
  });

  it('keeps the duration equal when the previous calendar period is shorter', () => {
    const marchEnd = new Date(2025, 2, 31, 12, 0, 0);
    expect(getDashboardPreviousPeriodDateRange('monthly', marchEnd)).toEqual({
      startDate: '2025-01-29',
      endDate: '2025-02-28',
    });
  });
});
