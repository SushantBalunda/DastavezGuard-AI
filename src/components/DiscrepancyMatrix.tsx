import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ComplianceAuditResult } from '../types/audit';
import {
  buildFieldComparisonRows,
  type FieldComparisonCell,
} from '../utils/compliance';

interface DiscrepancyMatrixProps {
  audit: ComplianceAuditResult;
}

type MatrixFilterMode = 'ALL' | 'ISSUES_ONLY';

function renderHighlightedCell(cell: FieldComparisonCell) {
  if (cell.status === 'EMPTY' || !cell.value) {
    return <span className="text-slate-400">—</span>;
  }

  if (cell.status === 'MATCH') {
    return <span className="text-slate-900">{cell.value}</span>;
  }

  const diffHighlightClass =
    cell.status === 'CRITICAL'
      ? 'rounded-xs bg-red-100 px-0.5 text-red-900 font-semibold underline decoration-red-600'
      : 'rounded-xs bg-amber-100 px-0.5 text-amber-900 font-medium underline decoration-amber-600';

  return (
    <span>
      {cell.segments.map((seg, idx) =>
        seg.kind === 'diff' ? (
          <mark key={idx} className={diffHighlightClass}>
            {seg.text}
          </mark>
        ) : (
          <span key={idx}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

export const DiscrepancyMatrix: React.FC<DiscrepancyMatrixProps> = ({ audit }) => {
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilterMode>('ALL');

  const comparisonRows = useMemo(
    () => buildFieldComparisonRows(audit.documents),
    [audit.documents],
  );

  const issueRowsCount = useMemo(
    () =>
      comparisonRows.filter(
        (r) => r.rowStatus === 'CRITICAL' || r.rowStatus === 'WARNING',
      ).length,
    [comparisonRows],
  );

  const visibleRows = useMemo(() => {
    if (matrixFilter === 'ALL') return comparisonRows;
    return comparisonRows.filter(
      (r) => r.rowStatus === 'CRITICAL' || r.rowStatus === 'WARNING',
    );
  }, [comparisonRows, matrixFilter]);

  return (
    <section
      aria-labelledby="discrepancy-heading"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="border-b border-slate-200 pb-4">
        <p className="text-xs font-medium text-slate-500">Cross-Document Verification</p>
        <h2 id="discrepancy-heading" className="mt-1 font-display text-xl font-bold text-slate-900">
          Identity Comparison Matrix &amp; Discrepancies
        </h2>
      </div>

      {audit.discrepancies.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            Zero cross-document field mismatches or certificate expiry discrepancies detected.
          </span>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200">
          {audit.discrepancies.map((item) => (
            <div key={item.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.severity === 'CRITICAL' ? (
                    <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
                  )}
                  <span
                    className={`font-mono text-xs font-semibold ${
                      item.severity === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    {item.severity}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{item.field}</span>
                </div>
              </div>

              <p className="mt-1.5 text-sm font-medium text-slate-800">{item.summary}</p>

              {item.documentComparison.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-4 font-medium">Document</th>
                        <th className="py-1.5 font-medium">Observed Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {item.documentComparison.map((comp, idx) => (
                        <tr key={`${item.id}-${comp.documentIndex}-${idx}`}>
                          <td className="py-2 pr-4 font-medium text-slate-700 whitespace-nowrap">
                            Doc 0{comp.documentIndex} · {comp.documentType}
                          </td>
                          <td className="py-2 font-mono text-slate-900">{comp.observedValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Remediation: </span>
                {item.remediationStep}
              </p>
            </div>
          ))}
        </div>
      )}

      {audit.documents.length > 0 && (
        <div className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Side-by-Side Extracted Field Comparison
              </h3>
              <p className="text-xs text-slate-500">
                Character-level spelling differences are highlighted in amber (minor variation) or red (critical mismatch).
              </p>
            </div>

            <div
              role="group"
              aria-label="Filter field comparison table"
              className="flex flex-wrap items-center gap-1 self-start rounded-lg bg-slate-100 p-1 print:hidden"
            >
              <button
                type="button"
                aria-pressed={matrixFilter === 'ALL'}
                onClick={() => setMatrixFilter('ALL')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  matrixFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Show All Fields ({comparisonRows.length})
              </button>
              <button
                type="button"
                aria-pressed={matrixFilter === 'ISSUES_ONLY'}
                onClick={() => setMatrixFilter('ISSUES_ONLY')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  matrixFilter === 'ISSUES_ONLY'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Show Mismatches &amp; Warnings Only ({issueRowsCount})
              </button>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>All compared identity and banking fields match across uploaded documents.</span>
            </div>
          ) : (
            <div
              data-testid="field-comparison-table-wrap"
              className="mt-3 overflow-x-auto rounded-lg border border-slate-200"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap">Field</th>
                    <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap">Status</th>
                    {audit.documents.map((doc) => (
                      <th
                        key={doc.documentIndex}
                        className="min-w-[165px] px-3.5 py-2.5 align-top font-semibold"
                      >
                        <span className="block font-mono text-[11px] font-medium text-slate-500">
                          Doc 0{doc.documentIndex}
                        </span>
                        <span className="mt-0.5 block leading-snug text-slate-800">
                          {doc.documentType}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {visibleRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="px-3.5 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                        {row.label}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {row.rowStatus === 'CRITICAL' ? (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-red-700">
                            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Mismatch</span>
                          </span>
                        ) : row.rowStatus === 'WARNING' ? (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Minor Diff</span>
                          </span>
                        ) : row.rowStatus === 'MATCH' ? (
                          <span className="inline-flex items-center gap-1 font-mono font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Match</span>
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400">Empty</span>
                        )}
                      </td>
                      {row.cells.map((cell) => (
                        <td
                          key={`${row.key}-${cell.documentIndex}`}
                          className={`px-3.5 py-2.5 font-mono tabular-nums ${
                            cell.status === 'CRITICAL'
                              ? 'bg-red-50/60'
                              : cell.status === 'WARNING'
                                ? 'bg-amber-50/50'
                                : ''
                          }`}
                        >
                          {renderHighlightedCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {audit.recommendedNextActions.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Recommended Next Actions</h3>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
            {audit.recommendedNextActions.map((action, idx) => (
              <li key={idx}>{action}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};
