import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { RecentAuditEntry } from '../utils/auditHistory';

interface RecentAuditsPanelProps {
  entries: RecentAuditEntry[];
  activeAuditId: string | null;
  onSelectAudit: (entry: RecentAuditEntry) => void;
  onRemoveAudit: (id: string) => void;
  onClearHistory: () => void;
}

function formatSavedTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const RecentAuditsPanel: React.FC<RecentAuditsPanelProps> = ({
  entries,
  activeAuditId,
  onSelectAudit,
  onRemoveAudit,
  onClearHistory,
}) => {
  return (
    <section
      aria-labelledby="recent-audits-heading"
      data-testid="recent-audits-section"
      className="rounded-xl border border-slate-200 bg-white p-6 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 text-slate-500" aria-hidden="true" />
          <div>
            <h2
              id="recent-audits-heading"
              className="font-display text-lg font-bold text-slate-900"
            >
              Recent Audits
            </h2>
            <p className="text-xs text-slate-500">
              Last {entries.length} of 5 compliance summaries saved locally in this browser
            </p>
          </div>
        </div>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
          >
            Clear history
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No previous audits saved yet. Run a compliance audit or load the sample case to store up to 5 recent summaries here for quick review.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const { result } = entry;
            const isActive = entry.id === activeAuditId;
            const tierColor =
              result.readinessTier === 'Ready to Submit'
                ? 'text-emerald-700'
                : result.readinessTier === 'Needs Attention'
                  ? 'text-amber-700'
                  : 'text-red-700';

            const tierIcon =
              result.readinessTier === 'Ready to Submit' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : result.readinessTier === 'Needs Attention' ? (
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
              );

            return (
              <div
                key={entry.id}
                className={`flex items-start justify-between gap-2 rounded-lg border p-3.5 transition-colors ${
                  isActive
                    ? 'border-blue-700 bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAudit(entry)}
                  aria-pressed={isActive}
                  className="min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                      {result.readinessScore}
                      <span className="text-xs font-normal text-slate-400"> / 100</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tierColor}`}>
                      {tierIcon}
                      <span>{result.readinessTier}</span>
                    </span>
                  </div>

                  <p
                    title={result.targetScheme}
                    className="mt-1.5 truncate text-sm font-semibold text-slate-900"
                  >
                    {result.targetScheme}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-mono tabular-nums">{result.auditDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{result.documents.length} docs</span>
                    <span aria-hidden="true">·</span>
                    <span>{result.criticalBlockersCount} blockers</span>
                  </div>

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {isActive ? 'Currently viewing' : `Saved ${formatSavedTime(entry.savedAt)}`}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onRemoveAudit(entry.id)}
                  aria-label={`Delete recent audit for ${result.targetScheme}`}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
