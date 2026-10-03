'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { BookingReport, QuoteValues, ReportSubjectType } from '@/lib/reports/types';

export interface SubmitReportInput {
  optionKey: string;
  optionName: string;
  quote: QuoteValues;
  /** null = "couldn't find it" */
  entered: QuoteValues | null;
}

/**
 * Shared user reports for one itinerary / room, grouped by booking option.
 * A successful submit lands at the top of that option's list straight from the
 * server response, then the list refetches to pick up anyone else's.
 */
export function useBookingReports(subjectType: ReportSubjectType, subjectKey: string) {
  const queryClient = useQueryClient();
  const queryKey = ['reports.list', subjectType, subjectKey] as const;

  const { data = {}, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () => trpc.reports.list.query({ subjectType, subjectKey }),
    enabled: subjectKey.length > 0,
  });

  const submit = useMutation({
    mutationFn: (input: SubmitReportInput) =>
      trpc.reports.submit.mutate({ subjectType, subjectKey, ...input }),
    onSuccess: (report) => {
      queryClient.setQueryData<Record<string, BookingReport[]>>(queryKey, (prev = {}) => ({
        ...prev,
        [report.optionKey]: [report, ...(prev[report.optionKey] ?? [])],
      }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    reportsByOption: data,
    /** Clock for "time ago" labels — avoids an impure Date.now() during render */
    now: dataUpdatedAt || null,
    submit,
  };
}
