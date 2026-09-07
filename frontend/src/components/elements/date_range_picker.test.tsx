import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DateRangePicker from './date_range_picker';

describe('DateRangePicker', () => {
  it('applies a valid date range', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    render(
      <DateRangePicker
        startDate=''
        endDate=''
        onStartDateChange={onStart}
        onEndDateChange={onEnd}
      />,
    );

    await user.click(screen.getByRole('button', { name: /เลือกช่วงวันที่/ }));
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: '2026-09-01' } });
    fireEvent.change(inputs[1], { target: { value: '2026-09-07' } });
    await user.click(screen.getByRole('button', { name: 'ตกลง' }));

    expect(onStart).toHaveBeenCalledWith('2026-09-01');
    expect(onEnd).toHaveBeenCalledWith('2026-09-07');
  });

  it('blocks a reversed date range', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    render(
      <DateRangePicker
        startDate=''
        endDate=''
        onStartDateChange={onStart}
        onEndDateChange={onEnd}
      />,
    );

    await user.click(screen.getByRole('button', { name: /เลือกช่วงวันที่/ }));
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: '2026-09-08' } });
    fireEvent.change(inputs[1], { target: { value: '2026-09-07' } });

    expect(screen.getByRole('alert')).toHaveTextContent('วันเริ่มต้น');
    expect(screen.getByRole('button', { name: 'ตกลง' })).toBeDisabled();
    expect(onStart).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });
});
