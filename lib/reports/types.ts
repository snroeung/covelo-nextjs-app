export type ReportSubjectType = 'flight' | 'hotel';
export type ReportResult = 'matched' | 'different' | 'not_found';

/** What Covelo quoted, or what the traveller saw — dates are YYYY-MM-DD. */
export interface QuoteValues {
  cash: number;
  points: number | null;
  start: string;
  /** Return / check-out; null for one-way flights */
  end: string | null;
}

/** One report as the client sees it — reporter identity reduced to a name and an isMine flag. */
export interface BookingReport {
  id: string;
  optionKey: string;
  reporterName: string;
  result: ReportResult;
  quotedCash: number;
  reportedCash: number | null;
  reportedPoints: number | null;
  reportedStart: string | null;
  reportedEnd: string | null;
  createdAt: string;
  isMine: boolean;
}
