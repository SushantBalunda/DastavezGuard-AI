import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  ShieldAlert,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  AuditedDocument,
  ComplianceAuditResult,
  UploadedDocFile,
} from '../types/audit';
import { matchUploadedFileForDocument } from '../utils/compliance';

interface DocumentFindingsListProps {
  audit: ComplianceAuditResult;
  uploadedFiles: UploadedDocFile[];
}

type FilterMode = 'ALL' | 'CRITICAL' | 'WARNING' | 'VERIFIED';

function getDocumentSeverity(doc: AuditedDocument): 'CRITICAL' | 'WARNING' | 'VERIFIED' {
  if (
    doc.documentBlockers.length > 0 ||
    doc.validityStatus === 'EXPIRED' ||
    doc.scanClarity === 'UNREADABLE'
  ) {
    return 'CRITICAL';
  }
  if (
    doc.documentWarnings.length > 0 ||
    doc.validityStatus === 'EXPIRING_SOON' ||
    doc.scanClarity === 'BLURRY' ||
    doc.scanClarity === 'SLIGHTLY_CROPPED' ||
    doc.scanClarity === 'MINOR_GLARE' ||
    doc.extractedFields.officialStampOrSignaturePresent === false
  ) {
    return 'WARNING';
  }
  return 'VERIFIED';
}

export const DocumentFindingsList: React.FC<DocumentFindingsListProps> = ({
  audit,
  uploadedFiles,
}) => {
  const [filter, setFilter] = useState<FilterMode>('ALL');
  const [zoomedPreview, setZoomedPreview] = useState<{
    title: string;
    fileName: string;
    src: string;
  } | null>(null);

  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let verified = 0;
    for (const d of audit.documents) {
      const sev = getDocumentSeverity(d);
      if (sev === 'CRITICAL') critical += 1;
      else if (sev === 'WARNING') warning += 1;
      else verified += 1;
    }
    return { all: audit.documents.length, critical, warning, verified };
  }, [audit.documents]);

  const filteredDocs = useMemo(() => {
    if (filter === 'ALL') return audit.documents;
    return audit.documents.filter((d) => getDocumentSeverity(d) === filter);
  }, [audit.documents, filter]);

  return (
    <section
      aria-labelledby="document-findings-heading"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Per-Document Extraction &amp; Quality</p>
          <h2
            id="document-findings-heading"
            className="mt-1 font-display text-xl font-bold text-slate-900"
          >
            Document Inspection Ledger
          </h2>
        </div>

        <div
          role="group"
          aria-label="Filter documents by audit status"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 print:hidden"
        >
          {(
            [
              { id: 'ALL', label: `All (${counts.all})` },
              { id: 'CRITICAL', label: `Critical (${counts.critical})` },
              { id: 'WARNING', label: `Warnings (${counts.warning})` },
              { id: 'VERIFIED', label: `Verified (${counts.verified})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">
          No documents match the selected filter.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {filteredDocs.map((doc) => {
            const sev = getDocumentSeverity(doc);
            const matchedFile = matchUploadedFileForDocument(
              uploadedFiles,
              doc.documentIndex,
              doc.fileName,
            );
            const isPdf = matchedFile?.mimeType === 'application/pdf';
            const canZoom = Boolean(matchedFile && !isPdf && matchedFile.previewUrl);

            return (
              <article
                key={`${doc.documentIndex}-${doc.fileName}`}
                className="rounded-lg border border-slate-200 bg-white break-inside-avoid"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono tabular-nums">Doc 0{doc.documentIndex}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[260px]" title={doc.fileName}>
                        {doc.fileName}
                      </span>
                    </div>
                    <h3 className="mt-0.5 font-display text-base font-bold text-slate-900">
                      {doc.documentType}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      <span className="text-slate-500">Clarity:</span>
                      <span
                        className={`font-mono font-semibold ${
                          doc.scanClarity === 'UNREADABLE'
                            ? 'text-red-700'
                            : doc.scanClarity === 'CLEAR'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {doc.scanClarity}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Validity:</span>
                      <span
                        className={`font-mono font-semibold ${
                          doc.validityStatus === 'EXPIRED'
                            ? 'text-red-700'
                            : doc.validityStatus === 'EXPIRING_SOON'
                              ? 'text-amber-700'
                              : doc.validityStatus === 'VALID'
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                        }`}
                      >
                        {doc.validityStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-semibold">
                      {sev === 'CRITICAL' ? (
                        <>
                          <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />
                          <span className="text-red-700">Blocker</span>
                        </>
                      ) : sev === 'WARNING' ? (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                          <span className="text-amber-700">Warning</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                          <span className="text-emerald-700">Verified</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-12">
                  <div className="lg:col-span-3">
                    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {matchedFile ? (
                        isPdf ? (
                          <div className="flex aspect-[16/11] w-full flex-col items-center justify-center gap-1.5 px-3 text-center text-slate-600">
                            <FileText className="h-8 w-8 text-blue-700" aria-hidden="true" />
                            <span className="font-mono text-xs font-medium text-slate-800">
                              PDF Document
                            </span>
                            <span className="max-w-full truncate text-[11px] text-slate-500">
                              {matchedFile.name}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setZoomedPreview({
                                title: `Doc 0${doc.documentIndex} · ${doc.documentType}`,
                                fileName: doc.fileName,
                                src: matchedFile.previewUrl,
                              })
                            }
                            aria-label={`Inspect thumbnail preview for ${doc.documentType}`}
                            className="group relative block aspect-[16/11] w-full overflow-hidden bg-white cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700"
                          >
                            <img
                              src={matchedFile.previewUrl}
                              alt={`Document thumbnail: ${doc.documentType} (${doc.fileName})`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
                            />
                            <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
                              <ZoomIn className="h-3 w-3" aria-hidden="true" />
                              <span>Inspect</span>
                            </span>
                          </button>
                        )
                      ) : (
                        <div className="flex aspect-[16/11] w-full flex-col items-center justify-center gap-1.5 px-3 text-center text-slate-400">
                          <ImageIcon className="h-7 w-7" aria-hidden="true" />
                          <span className="text-xs">Preview unavailable</span>
                        </div>
                      )}
                    </div>
                    {canZoom && (
                      <p className="mt-1.5 text-[11px] text-slate-500 print:hidden">
                        Click thumbnail to inspect scan details
                      </p>
                    )}
                  </div>

                  <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-6">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Full Name</dt>
                        <dd className="mt-0.5 font-mono font-medium text-slate-900">
                          {doc.extractedFields.fullName || 'Not Extracted'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Father / Mother Name</dt>
                        <dd className="mt-0.5 font-mono font-medium text-slate-900">
                          {doc.extractedFields.parentName || 'Not Extracted'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Date of Birth</dt>
                        <dd className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                          {doc.extractedFields.dateOfBirth || 'Not Extracted'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">ID / Certificate No.</dt>
                        <dd className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                          {doc.extractedFields.idOrCertificateNumber || 'Not Extracted'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Issue Date / Valid Till</dt>
                        <dd className="mt-0.5 font-mono font-medium text-slate-900 tabular-nums">
                          {doc.extractedFields.issueDate || '—'} /{' '}
                          {doc.extractedFields.validTillDate || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Official Stamp / Signature</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {doc.extractedFields.officialStampOrSignaturePresent === true
                            ? 'Present / Verified'
                            : doc.extractedFields.officialStampOrSignaturePresent === false
                              ? 'Missing / Unverified'
                              : 'Not Applicable'}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">Address</dt>
                        <dd className="mt-0.5 font-mono text-slate-800">
                          {doc.extractedFields.address || 'Not Extracted'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="lg:col-span-4 space-y-3 border-t border-slate-200 pt-3 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Scan &amp; Validity Notes</p>
                      <p className="mt-1 text-xs text-slate-600">{doc.clarityNotes}</p>
                      <p className="mt-1 text-xs text-slate-600">{doc.validityNotes}</p>
                    </div>

                    {doc.documentBlockers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-700">Critical Blockers</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-red-700">
                          {doc.documentBlockers.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {doc.documentWarnings.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Warnings</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-800">
                          {doc.documentWarnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {zoomedPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="zoomed-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 print:hidden"
        >
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <h3
                  id="zoomed-preview-title"
                  className="font-display text-base font-bold text-slate-900"
                >
                  {zoomedPreview.title}
                </h3>
                <p className="truncate text-xs text-slate-500">{zoomedPreview.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPreview(null)}
                aria-label="Close document preview"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 max-h-[75vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
              <img
                src={zoomedPreview.src}
                alt={`Enlarged preview of ${zoomedPreview.title}`}
                referrerPolicy="no-referrer"
                className="mx-auto max-h-[68vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
