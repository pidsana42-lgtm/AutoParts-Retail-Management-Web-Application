import { useEffect, useMemo, useState } from 'react';
import type { ChartDatum } from '../../../../interface/dashboard/dashboard_interface';
import { dashboardService } from '../../../../service/http/dashboard/dashboard_service';
import type { SummaryQuery } from '../../../../interface/dashboard/dashboard_interface';

export function useRevenueBreakdown(query: SummaryQuery) {
  const [customerData, setCustomerData] = useState<ChartDatum[]>([]);
  const [paymentData, setPaymentData] = useState<ChartDatum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await dashboardService.getSummaryIncomeData(query);
        if (!isMounted) return;
        setCustomerData(res.data.customerData);
        setPaymentData(res.data.paymentData);
      } catch (err) {
        if (isMounted) setError('โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [query]);

  const totalCustomerRevenue = useMemo(
    () => customerData.reduce((sum, item) => sum + item.value, 0),
    [customerData]
  );

  const totalPaymentRevenue = useMemo(
    () => paymentData.reduce((sum, item) => sum + item.value, 0),
    [paymentData]
  );

  return {
    customerData,
    paymentData,
    totalCustomerRevenue,
    totalPaymentRevenue,
    isLoading,
    error,
  };
}