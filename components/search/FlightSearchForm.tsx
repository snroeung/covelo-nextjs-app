'use client';

import { DateInput } from '@/components/DateInput';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { useTheme } from '@/contexts/ThemeContext';
import type { TripType } from '@/lib/searchUrls';

// Controlled flight search form. The consumer owns all state (origin/arrival place,
// dates, trip type) and provides `onSearch`. Reused by /search (redirects) and
// /flights (runs the tRPC search + supports trip-planner auto-resolve seeding).
export interface FlightSearchFormProps {
  tripType: TripType;
  onTripTypeChange: (t: TripType) => void;

  onOriginSelect: (p: SelectedPlace) => void;
  onOriginClear: () => void;
  originInitialValue?: string;
  originInitialCommitted?: boolean;
  originFieldKey?: number;

  onArrivalSelect: (p: SelectedPlace) => void;
  onArrivalClear: () => void;
  arrivalInitialValue?: string;
  arrivalInitialCommitted?: boolean;
  arrivalFieldKey?: number;

  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;

  onSearch: () => void;
  searchDisabled: boolean;
  searchPending?: boolean;
}

const TRIP_LABELS: Record<TripType, string> = { roundtrip: 'Round trip', oneway: 'One-way' };

export function FlightSearchForm(props: FlightSearchFormProps) {
  const { isDark } = useTheme();
  const {
    tripType, onTripTypeChange,
    onOriginSelect, onOriginClear, originInitialValue, originInitialCommitted, originFieldKey,
    onArrivalSelect, onArrivalClear, arrivalInitialValue, arrivalInitialCommitted, arrivalFieldKey,
    startDate, onStartDateChange, endDate, onEndDateChange,
    onSearch, searchDisabled, searchPending,
  } = props;

  const segWrap = isDark ? 'border-gph-dark-line bg-gph-dark-bg' : 'border-gray-200 bg-gray-100';

  const tripPills = (
    <div className={`inline-flex gap-1 rounded-lg border p-1 ${segWrap}`}>
      {(['roundtrip', 'oneway'] as TripType[]).map((t) => {
        const active = t === tripType;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTripTypeChange(t)}
            className={`rounded-md px-4 py-1.5 text-xs font-bold transition-colors ${
              active
                ? isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white'
                : isDark ? 'text-gph-dark-muted' : 'text-gray-600'
            }`}
          >
            {TRIP_LABELS[t]}
          </button>
        );
      })}
    </div>
  );

  const searchButton = (
    <button
      onClick={onSearch}
      disabled={searchDisabled || searchPending}
      className={`rounded-lg px-6 min-h-11 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isDark
          ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi focus:ring-gph-dark-action'
          : 'bg-gray-900 text-white hover:bg-gray-700 focus:ring-gray-900'
      }`}
    >
      {searchPending ? 'Searching…' : 'Search →'}
    </button>
  );

  const fromField = (
    <LocationSearch
      key={originFieldKey}
      fieldLabel="From"
      forAirport
      initialValue={originInitialValue}
      initialCommitted={originInitialCommitted}
      onSelect={onOriginSelect}
      onClear={onOriginClear}
    />
  );
  const toField = (
    <LocationSearch
      key={arrivalFieldKey}
      fieldLabel="To"
      forAirport
      initialValue={arrivalInitialValue}
      initialCommitted={arrivalInitialCommitted}
      onSelect={onArrivalSelect}
      onClear={onArrivalClear}
    />
  );
  const departField = (
    <DateInput
      label="Depart"
      value={startDate}
      onChange={(v) => { onStartDateChange(v); if (endDate && endDate <= v) onEndDateChange(''); }}
    />
  );
  const returnField = (
    <DateInput label="Return" value={endDate} onChange={onEndDateChange} min={startDate || undefined} />
  );

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* Mobile — trip pills on their own row above the stacked fields */}
      <div className="md:hidden">{tripPills}</div>
      <div className="flex flex-col gap-2.5 md:hidden">
        {fromField}
        {toField}
        <div className="flex gap-2.5">
          <div className="flex-1">{departField}</div>
          {tripType === 'roundtrip' && <div className="flex-1">{returnField}</div>}
        </div>
        {searchButton}
      </div>

      {/* Desktop — single row incl. trip pills */}
      <div className="hidden md:grid items-stretch gap-2.5" style={{ gridTemplateColumns: 'auto 1fr 1fr 150px 150px auto' }}>
        <div className="flex items-center">{tripPills}</div>
        {fromField}
        {toField}
        {departField}
        <div className={tripType === 'oneway' ? 'invisible' : ''}>{returnField}</div>
        {searchButton}
      </div>
    </div>
  );
}
