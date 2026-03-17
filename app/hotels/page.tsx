'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DateInput } from '@/components/DateInput';
import { LocationSearch, type SelectedPlace } from '@/components/LocationSearch';
import { PointsGrid } from '@/components/PointsGrid';
import { usePointsCalc } from '@/hooks/usePointsCalc';
import { useTheme } from '@/contexts/ThemeContext';

// Placeholder price until Duffel Stays API access is granted
const DEMO_PRICE = 620;

export default function HotelsPage() {
  const [destPlace, setDestPlace] = useState<SelectedPlace | null>(null);
  const [checkIn, setCheckIn]     = useState('');
  const [checkOut, setCheckOut]   = useState('');

  const { isDark } = useTheme();
  const pointsResult = usePointsCalc(DEMO_PRICE, 'hotel');

  const labelCls   = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const headingCls = isDark ? 'text-cv-blue-300' : 'text-cv-blue-900';
  const subTextCls = isDark ? 'text-cv-blue-400' : 'text-cv-blue-500';
  const emptyBg    = isDark ? 'border-cv-blue-900 text-cv-blue-400' : 'border-cv-blue-200 text-cv-blue-500';

  const header = (
    <>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${labelCls}`}>Location</span>
        <LocationSearch
          onSelect={setDestPlace}
          onClear={() => setDestPlace(null)}
        />
      </div>
      <DateInput label="Check-in"  value={checkIn}  onChange={setCheckIn} />
      <DateInput label="Check-out" value={checkOut} onChange={setCheckOut} />
    </>
  );

  return (
    <AppShell header={header}>
      {!destPlace ? (
        <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${emptyBg}`}>
          <p className="text-sm">Search for a location to see your points breakdown.</p>
        </div>
      ) : pointsResult ? (
        <>
          <div className="flex items-baseline justify-between">
            <h2 className={`text-xs font-semibold uppercase tracking-widest ${headingCls}`}>Points breakdown</h2>
            <span className={`text-xs ${subTextCls}`}>{destPlace.description} · hotel</span>
          </div>
          <PointsGrid result={pointsResult} />
        </>
      ) : (
        <div className={`flex items-center justify-center rounded-xl border border-dashed py-16 ${emptyBg}`}>
          <p className="text-sm">Something went wrong calculating points.</p>
        </div>
      )}
    </AppShell>
  );
}
