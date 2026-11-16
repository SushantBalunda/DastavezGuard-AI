import React from 'react';
import { X } from 'lucide-react';

interface ComplianceRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComplianceRulesModal: React.FC<ComplianceRulesModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="rules-modal-title" className="font-display text-lg font-bold text-slate-900">
            DastavezGuard AI Strict Audit Rubric
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scoring Rules"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div>
            <h3 className="font-semibold text-slate-900">1. Readiness Score Formula (0–100)</h3>
            <p className="mt-1">
              Every batch begins at <span className="font-mono font-semibold">100</span> points.
              Each <span className="font-semibold text-red-700">Critical Blocker</span> deducts{' '}
              <span className="font-mono font-semibold">30</span> points, and each{' '}
              <span className="font-semibold text-amber-700">Minor Warning</span> deducts{' '}
              <span className="font-mono font-semibold">10</span> points (clamped at 0).
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">2. Critical Blockers (-30 pts each)</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                Cross-document name mismatches (including abbreviations like &quot;Kr.&quot; vs
                &quot;Kumar&quot; or missing middle names) or Date of Birth conflicts.
              </li>
              <li>
                Expired certificates past their Valid-Till date, or Income / OBC-NCL / EWS
                certificates older than 1 year (365 days) relative to Today&apos;s Date.
              </li>
              <li>
                Unreadable scans marked <span className="font-mono">UNREADABLE</span> due to
                blurriness, heavy glare, or cropped edges.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">3. Minor Warnings (-10 pts each)</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Missing or unverified issuing officer stamp or digital signature block.</li>
              <li>Address phrasing or punctuation differences across documents.</li>
              <li>Minor edge cropping or localized glare where text remains legible.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">4. Privacy &amp; Non-Guessing Policy</h3>
            <p className="mt-1">
              The first 8 digits of any 12-digit Aadhaar number are masked as{' '}
              <span className="font-mono">XXXX-XXXX-last4</span>. Unreadable text is never guessed.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
