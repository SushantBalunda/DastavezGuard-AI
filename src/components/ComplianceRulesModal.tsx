import React from 'react';
import { X } from 'lucide-react';
import { SUPPORTED_DOCUMENT_GROUPS } from '../utils/compliance';

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
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="rules-modal-title" className="font-display text-lg font-bold text-slate-900">
            DastavezGuard AI Forensic Audit Rubric
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
                Missing mandatory documents required by the selected Target Scheme checklist.
              </li>
              <li>
                Cross-document name mismatches (including abbreviations like &quot;Kr.&quot; vs
                &quot;Kumar&quot; or missing middle names), PIN code discrepancies, or Date of Birth conflicts.
              </li>
              <li>
                Certificates past Valid-Till date, or Family Income / OBC-NCL / EWS certificates
                issued before <span className="font-mono">2026-04-01</span> (prior Financial Year) for FY 2026–27 schemes.
              </li>
              <li>
                Invalid 11-character IFSC format on banking proof or <span className="font-mono">UNREADABLE</span> scans.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">3. Minor Warnings (-10 pts each)</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Missing issuing officer seal, authorized signature, or DigiLocker/e-District QR block.</li>
              <li>Declared annual income exceeding ₹2.5L scholarship or ₹8.0L OBC-NCL ceilings.</li>
              <li>Address phrasing differences, cluttered photo background, or minor glare/cropping.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">4. Supported Document Classes (19 Types)</h3>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              {SUPPORTED_DOCUMENT_GROUPS.map((grp) => (
                <div key={grp.group} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{grp.group}</p>
                  <p className="mt-1 text-slate-600">{grp.types.join(', ')}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">5. Privacy &amp; Non-Guessing Policy</h3>
            <p className="mt-1">
              The first 8 digits of Aadhaar numbers (<span className="font-mono">XXXX-XXXX-last4</span>) and leading bank account digits (<span className="font-mono">XXXXXXlast4</span>) are masked. Unreadable text is never guessed.
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
