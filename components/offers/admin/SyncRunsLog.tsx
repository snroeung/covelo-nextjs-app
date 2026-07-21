'use client';

import type { PortalSyncRun } from '@/lib/types/portalData';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

interface Props {
  runs:   PortalSyncRun[];
  isDark: boolean;
}

export function SyncRunsLog({ runs, isDark }: Props) {
  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const divider = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const headBg  = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b text-[10px] font-mono font-bold tracking-widest ${muted} ${headBg} ${divider}`}>
        <div>WHEN</div>
        <div>SOURCE</div>
        <div>STATUS</div>
        <div>FOUND / WRITTEN</div>
        <div>TOKENS</div>
      </div>

      {runs.length === 0 && (
        <p className={`px-5 py-8 text-sm text-center ${muted}`}>No sync runs recorded yet.</p>
      )}

      {runs.map((run, i) => {
        const statusColor =
          run.status === 'success'
            ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-50 text-green-700'
            : run.status === 'partial'
            ? isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-50 text-amber-700'
            : isDark ? 'bg-red-900/40 text-red-400' : 'bg-red-50 text-red-700';

        return (
          <div
            key={run.id}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-5 py-3 ${
              i < runs.length - 1 ? `border-b ${divider}` : ''
            }`}
          >
            <div className={`text-[11px] font-mono whitespace-nowrap ${muted}`}>
              {formatDateTime(run.started_at)}
            </div>

            <div className="min-w-0">
              <div className={`text-sm font-semibold truncate ${ink}`}>{run.source_key}</div>
              <a
                href={run.source_url}
                target="_blank"
                rel="noreferrer"
                className={`text-[10px] font-mono underline block truncate ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
              >
                {run.source_url}
              </a>
              {run.error_message && (
                <div className={`text-[11px] mt-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {run.error_message}
                </div>
              )}
            </div>

            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${statusColor}`}>
                {run.status}
              </span>
            </div>

            <div className={`text-[11px] font-mono whitespace-nowrap ${muted}`}>
              {run.records_found} / {run.records_written}
            </div>

            <div className={`text-[11px] font-mono whitespace-nowrap ${muted}`}>
              {run.llm_tokens_used ?? '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
