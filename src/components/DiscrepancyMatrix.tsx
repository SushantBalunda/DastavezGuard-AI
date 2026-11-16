import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { ComplianceAuditResult } from '../types/audit';

interface DiscrepancyMatrixProps {
  audit: ComplianceAuditResult;
}

export const DiscrepancyMatrix: React.FC<DiscrepancyMatrixProps> = ({ audit }) => {
  const fieldsToCompare = [
    { key: 'fullName', label: 'Full Name' },
    { key: 'parentName', label: 'Father / Mother Name' },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'idOrCertificateNumber', label: 'ID / Cert No.' },
    { key: 'address', label: 'Address' },
  ] as const;

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

      {audit.documents.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Side-by-Side Extracted Identity Fields
          </h3>
          <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3.5 py-2.5 font-semibold whitespace-nowrap">Field</th>
                  {audit.documents.map((doc) => (
                    <th
                      key={doc.documentIndex}
                      className="px-3.5 py-2.5 font-semibold whitespace-nowrap"
                    >
                      Doc 0{doc.documentIndex} · {doc.documentType}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {fieldsToCompare.map((field) => (
                  <tr key={field.key} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {field.label}
                    </td>
                    {audit.documents.map((doc) => {
                      const val = doc.extractedFields[field.key];
                      return (
                        <td
                          key={`${field.key}-${doc.documentIndex}`}
                          className="px-3.5 py-2.5 font-mono text-slate-900 tabular-nums"
                        >
                          {val ? val : <span className="text-slate-400">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
