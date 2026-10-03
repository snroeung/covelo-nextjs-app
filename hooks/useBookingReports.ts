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
 * Shared user reports for one itinerary / room, newest first.
 * A successful submit lands at the top of the list straight from the
 * server response, then the list refetches to pick up anyone else's.
 */
export function useBookingReports(subjectType: ReportSubjectType, subjectKey: string) {
  const queryClient = useQueryClient();
  const queryKey = ['reports.list', subjectType, subjectKey] as const;

  const { data = [], dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () => trpc.reports.list.query({ subjectType, subjectKey }),
    enabled: subjectKey.length > 0,
  });

  const submit = useMutation({
    mutationFn: (input: SubmitReportInput) =>
      trpc.reports.submit.mutate({ subjectType, subjectKey, ...input }),
    onSuccess: (report) => {
      queryClient.setQueryData<BookingReport[]>(queryKey, (prev = []) => [report, ...prev]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    reports: data,
    /** Clock for "time ago" labels — avoids an impure Date.now() during render */
    now: dataUpdatedAt || null,
    submit,
  };
}
