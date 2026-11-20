import React, { useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import type { UploadedDocFile } from '../types/audit';
import { SCHEME_CHECKLISTS, TARGET_SCHEMES } from '../utils/compliance';

interface DocumentUploadPanelProps {
  files: UploadedDocFile[];
  targetScheme: string;
  customScheme: string;
  todayDate: string;
  isAuditing: boolean;
  validationError: string | null;
  onFilesAdd: (newFiles: UploadedDocFile[]) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onTargetSchemeChange: (scheme: string) => void;
  onCustomSchemeChange: (custom: string) => void;
  onTodayDateChange: (date: string) => void;
  onRunAudit: () => void;
  onLoadSample: () => void;
}

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsBase64(file: File): Promise<{ base64Data: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIndex = dataUrl.indexOf(',');
      const base64Data = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : '';
      resolve({ base64Data, dataUrl });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export const DocumentUploadPanel: React.FC<DocumentUploadPanelProps> = ({
  files,
  targetScheme,
  customScheme,
  todayDate,
  isAuditing,
  validationError,
  onFilesAdd,
  onRemoveFile,
  onClearAll,
  onTargetSchemeChange,
  onCustomSchemeChange,
  onTodayDateChange,
  onRunAudit,
  onLoadSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const checklistRules = SCHEME_CHECKLISTS[targetScheme] ?? [];

  const handleSelectedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadNotice(null);

    const remainingSlots = 6 - files.length;
    if (remainingSlots <= 0) {
      setUploadNotice(
        'Maximum of 6 documents allowed per pre-submission audit. Remove one to add another.',
      );
      return;
    }

    const incoming = Array.from(fileList);
    const validFiles: File[] = [];
    const rejectedNames: string[] = [];

    for (const f of incoming) {
      if (!ACCEPTED_MIME_TYPES.has(f.type)) {
        rejectedNames.push(f.name);
        continue;
      }
      if (f.size > 15 * 1024 * 1024) {
        rejectedNames.push(`${f.name} (>15MB)`);
        continue;
      }
      validFiles.push(f);
    }

    if (rejectedNames.length > 0) {
      setUploadNotice(
        `Skipped unsupported or oversized files: ${rejectedNames.join(', ')}. Allowed formats: JPG, PNG, WEBP, PDF (max 15 MB).`,
      );
    }

    const sliced = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      setUploadNotice(
        `Only ${remainingSlots} slot(s) remained; extra files beyond the 6-document cap were skipped.`,
      );
    }

    if (sliced.length === 0) return;

    const prepared: UploadedDocFile[] = await Promise.all(
      sliced.map(async (f, idx) => {
        const { base64Data, dataUrl } = await readFileAsBase64(f);
        return {
          id: `${Date.now()}-${idx}-${f.name}`,
          name: f.name,
          mimeType: f.type,
          sizeBytes: f.size,
          base64Data,
          previewUrl: dataUrl,
        };
      }),
    );

    onFilesAdd(prepared);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <section
      id="workbench"
      aria-labelledby="workbench-heading"
      className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 print:hidden"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500">
            Pre-Submission Forensic Compliance Workbench
          </p>
          <h1
            id="workbench-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
          >
            Audit identity, academic, financial &amp; category records before portal lock
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Upload 1 to 6 documents (JPG, PNG, WEBP, or PDF). DastavezGuard AI auto-classifies 19 document types, verifies mandatory scheme checklists, inspects QR/seal signals, and flags FY 2026–27 expiry and character-level mismatches.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onLoadSample}
            disabled={isAuditing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Load Sample Case</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-7">
          <label
            htmlFor="target-scheme-select"
            className="block text-sm font-medium text-slate-800"
          >
            Target Scheme / Portal Name
          </label>
          <select
            id="target-scheme-select"
            value={targetScheme}
            onChange={(e) => onTargetSchemeChange(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
          >
            {TARGET_SCHEMES.map((scheme) => (
              <option key={scheme} value={scheme}>
                {scheme}
              </option>
            ))}
          </select>

          <p className="mt-2 text-xs text-slate-600">
            {checklistRules.length > 0 ? (
              <>
                <span className="font-semibold text-slate-800">Mandatory Checklist: </span>
                {checklistRules.map((r) => r.label).join(' · ')}
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-800">General Cross-Check: </span>
                Cross-checks all uploaded files without enforcing a fixed mandatory document list.
              </>
            )}
          </p>

          {targetScheme === 'Custom / General Document Cross-Check' && (
            <div className="mt-2.5">
              <label htmlFor="custom-scheme-input" className="sr-only">
                Optional Custom Target Portal Label
              </label>
              <input
                id="custom-scheme-input"
                type="text"
                value={customScheme}
                onChange={(e) => onCustomSchemeChange(e.target.value)}
                placeholder="Optional custom label (e.g., UPSC CSE / GATE 2027 / State PSC)"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
          )}
        </div>

        <div className="md:col-span-5">
          <label
            htmlFor="today-date-input"
            className="block text-sm font-medium text-slate-800"
          >
            Today&apos;s Date (FY 2026–27 Validity Reference)
          </label>
          <input
            id="today-date-input"
            type="date"
            value={todayDate}
            onChange={(e) => onTodayDateChange(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
          />
          <p className="mt-2 text-xs text-slate-500">
            Income &amp; OBC-NCL/EWS certificates issued before April 1, 2026 are flagged as prior-FY expired.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-800">
            Document Batch ({files.length} / 6 slots filled)
          </span>
          {files.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={isAuditing}
              className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              Clear all documents
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleSelectedFiles(e.dataTransfer.files);
          }}
          className={`mt-2 rounded-xl border border-dashed p-6 text-center transition-colors ${
            isDragging
              ? 'border-blue-700 bg-blue-50/60'
              : 'border-slate-300 bg-slate-50/70 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            id="doc-file-upload"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => void handleSelectedFiles(e.target.files)}
            className="sr-only"
          />
          <Upload className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-800">
            Drag and drop 1–6 scans or PDFs here, or{' '}
            <label
              htmlFor="doc-file-upload"
              className="text-blue-700 underline underline-offset-4 hover:text-blue-800 cursor-pointer"
            >
              browse files
            </label>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports Aadhaar, PAN, APAAR/ABC, Voter ID, Driving Licence, Passport, Class X/XII/College Marksheets, Bonafide, Fee Receipt, TC/Migration, Income, Caste/OBC-NCL/EWS, Domicile, UDID, Bank Passbook/Cheque, Photo &amp; Signature (JPG, PNG, WEBP, PDF)
          </p>
        </div>

        {uploadNotice && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>{uploadNotice}</span>
          </div>
        )}

        {files.length > 0 && (
          <div
            data-testid="uploaded-files-grid"
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {files.map((doc, idx) => (
              <div
                key={doc.id}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-slate-100 bg-slate-100">
                  {doc.mimeType === 'application/pdf' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-600">
                      <FileText className="h-8 w-8 text-blue-700" aria-hidden="true" />
                      <span className="font-mono text-xs font-medium">PDF Document</span>
                    </div>
                  ) : (
                    <img
                      src={doc.previewUrl}
                      alt={`Uploaded document preview: ${doc.name}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
                      <span>Doc 0{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(doc.sizeBytes)}</span>
                    </div>
                    <p
                      title={doc.name}
                      className="mt-0.5 truncate text-xs font-medium text-slate-900"
                    >
                      {doc.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(doc.id)}
                    disabled={isAuditing}
                    aria-label={`Remove ${doc.name}`}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {validationError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ImageIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span>Aadhaar (XXXX-XXXX-last4) &amp; Bank Account numbers are automatically masked in all outputs.</span>
        </div>

        <button
          type="button"
          onClick={onRunAudit}
          disabled={isAuditing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {isAuditing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span>{isAuditing ? 'Running Forensic Audit...' : 'Run Compliance Audit'}</span>
        </button>
      </div>
    </section>
  );
};
