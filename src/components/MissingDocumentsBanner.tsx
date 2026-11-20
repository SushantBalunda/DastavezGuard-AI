import React from 'react';
import { ArrowUp, ShieldAlert } from 'lucide-react';
import type { MissingDocumentItem } from '../types/audit';

interface MissingDocumentsBannerProps {
  targetScheme: string;
  missingDocuments: MissingDocumentItem[];
  onJumpToUpload: () => void;
}

export const MissingDocumentsBanner: React.FC<MissingDocumentsBannerProps> = ({
  targetScheme,
  missingDocuments,
  onJumpToUpload,
}) => {
  if (!missingDocuments || missingDocuments.length === 0) {
    return null;
  }

  return (
    <section
      role="alert"
      aria-labelledby="missing-mandatory-docs-heading"
      data-testid="missing-mandatory-docs-banner"
      className="rounded-xl border border-red-300 bg-red-50 p-5 text-red-950"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-red-800">
              <span>Mandatory Scheme Checklist Alert</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {missingDocuments.length} Missing Document{missingDocuments.length > 1 ? 's' : ''}
              </span>
            </div>
            <h2
              id="missing-mandatory-docs-heading"
              className="mt-0.5 font-display text-lg font-bold text-red-950"
            >
              Missing Mandatory Documents for {targetScheme}
            </h2>
            <p className="mt-1 text-sm text-red-900">
              Your uploaded batch is incomplete for this scheme&apos;s submission checklist. Add the following document{missingDocuments.length > 1 ? 's' : ''} before portal lock:
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onJumpToUpload}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer print:hidden"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
          <span>Upload Missing Documents</span>
        </button>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {missingDocuments.map((item) => (
          <li
            key={item.requirementKey}
            className="rounded-lg border border-red-200 bg-white/90 px-3.5 py-2.5 text-xs"
          >
            <p className="font-semibold text-red-900">{item.label}</p>
            <p className="mt-0.5 text-slate-700">{item.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
