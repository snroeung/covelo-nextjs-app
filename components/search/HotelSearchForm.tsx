'use client';

import { DateInput } from '@/components/DateInput';
import { GuestsDropdown, type GuestsValue } from '@/components/GuestsDropdown';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { useTheme } from '@/contexts/ThemeContext';

// Controlled hotel search form. Consumer owns state + provides `onSearch`.
// Reused by /search (redirects) and /hotels (runs the tRPC search).
// ponytail: no separate rooms control — matches current /hotels behavior (rooms fixed at 1).
export interface HotelSearchFormProps {
  onDestSelect: (p: SelectedPlace) => void;
  onDestClear: () => void;
  destInitialValue?: string;

  checkIn: string;
  onCheckInChange: (v: string) => void;
  checkOut: string;
  onCheckOutChange: (v: string) => void;

  guests: GuestsValue;
  onGuestsChange: (v: GuestsValue) => void;

  onSearch: () => void;
  searchDisabled: boolean;
  searchPending?: boolean;
}

export function HotelSearchForm(props: HotelSearchFormProps) {
  const { isDark } = useTheme();
  const {
    onDestSelect, onDestClear, destInitialValue,
    checkIn, onCheckInChange, checkOut, onCheckOutChange,
    guests, onGuestsChange, onSearch, searchDisabled, searchPending,
  } = props;

  const destField = (
    <LocationSearch
      fieldLabel="Destination"
      initialValue={destInitialValue}
      onSelect={onDestSelect}
      onClear={onDestClear}
    />
  );
  const checkInField = (
    <DateInput
      label="Check-in"
      value={checkIn}
      onChange={(v) => { onCheckInChange(v); if (checkOut && checkOut <= v) onCheckOutChange(''); }}
    />
  );
  const checkOutField = (
    <DateInput label="Check-out" value={checkOut} onChange={onCheckOutChange} min={checkIn || undefined} />
  );
  const guestsField = <GuestsDropdown value={guests} onChange={onGuestsChange} />;

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

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* Mobile */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {destField}
        <div className="flex gap-2.5">
          <div className="flex-1">{checkInField}</div>
          <div className="flex-1">{checkOutField}</div>
        </div>
        {guestsField}
        {searchButton}
      </div>

      {/* Desktop — single grid row */}
      <div
        className="hidden md:grid items-stretch gap-2.5"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 150px 150px 200px auto' }}
      >
        {destField}
        {checkInField}
        {checkOutField}
        {guestsField}
        {searchButton}
      </div>
    </div>
  );
}
