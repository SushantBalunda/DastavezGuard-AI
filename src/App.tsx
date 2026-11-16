import { useState } from 'react';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { DocumentUploadPanel } from './components/DocumentUploadPanel';
import { AuditSummarySection } from './components/AuditSummarySection';
import { DiscrepancyMatrix } from './components/DiscrepancyMatrix';
import { DocumentFindingsList } from './components/DocumentFindingsList';
import { ComplianceAdvisorChat } from './components/ComplianceAdvisorChat';
import { ComplianceRulesModal } from './components/ComplianceRulesModal';
import type { ComplianceAuditResult, UploadedDocFile } from './types/audit';
import { getSampleAuditCase, TARGET_SCHEMES } from './utils/compliance';

export default function App() {
  const [files, setFiles] = useState<UploadedDocFile[]>([]);
  const [targetScheme, setTargetScheme] = useState<string>(TARGET_SCHEMES[0]);
  const [customScheme, setCustomScheme] = useState<string>('');
  const [todayDate, setTodayDate] = useState<string>('2026-11-15');
  const [auditResult, setAuditResult] = useState<ComplianceAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  const effectiveScheme =
    targetScheme === 'Custom Scheme' ? customScheme.trim() : targetScheme.trim();

  const handleFilesAdd = (newFiles: UploadedDocFile[]) => {
    setFiles((prev) => [...prev, ...newFiles].slice(0, 4));
    setValidationError(null);
    setAuditError(null);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setValidationError(null);
  };

  const handleClearAll = () => {
    setFiles([]);
    setAuditResult(null);
    setValidationError(null);
    setAuditError(null);
  };

  const handleLoadSample = () => {
    const sample = getSampleAuditCase();
    setFiles(sample.files);
    setTargetScheme(sample.targetScheme);
    setCustomScheme('');
    setTodayDate(sample.todayDate);
    setAuditResult(sample.auditResult);
    setValidationError(null);
    setAuditError(null);
  };

  const handleRunAudit = async () => {
    setValidationError(null);
    setAuditError(null);

    if (files.length === 0) {
      setValidationError(
        'Please upload 1 to 4 documents (or click "Load Sample Case") before running a compliance audit.',
      );
      document.getElementById('workbench')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (!effectiveScheme) {
      setValidationError('Please enter a Custom Target Scheme name before running the audit.');
      return;
    }

    setIsAuditing(true);
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: files.map((f) => ({
            name: f.name,
            mimeType: f.mimeType,
            base64Data: f.base64Data,
          })),
          targetScheme: effectiveScheme,
          todayDate,
        }),
      });

      const data = (await response.json()) as ComplianceAuditResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Compliance audit failed.');
      }

      setAuditResult(data);
    } catch (err) {
      setAuditError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during the document compliance audit.',
      );
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <HeaderBar
        onLoadSample={handleLoadSample}
        onOpenRules={() => setIsRulesOpen(true)}
        onOpenAdvisor={() => setIsAdvisorOpen(true)}
        onRunAudit={() => void handleRunAudit()}
        isAuditing={isAuditing}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <DocumentUploadPanel
          files={files}
          targetScheme={targetScheme}
          customScheme={customScheme}
          todayDate={todayDate}
          isAuditing={isAuditing}
          validationError={validationError}
          onFilesAdd={handleFilesAdd}
          onRemoveFile={handleRemoveFile}
          onClearAll={handleClearAll}
          onTargetSchemeChange={(s) => {
            setTargetScheme(s);
            setValidationError(null);
          }}
          onCustomSchemeChange={(c) => {
            setCustomScheme(c);
            setValidationError(null);
          }}
          onTodayDateChange={setTodayDate}
          onRunAudit={() => void handleRunAudit()}
          onLoadSample={handleLoadSample}
        />

        {auditError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          >
            <p className="font-semibold">Audit Request Failed</p>
            <p className="mt-1">{auditError}</p>
          </div>
        )}

        {isAuditing && (
          <section
            aria-label="Running compliance audit"
            className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="h-44 animate-pulse rounded-lg bg-slate-100 lg:col-span-4" />
              <div className="h-44 animate-pulse rounded-lg bg-slate-100 lg:col-span-8" />
            </div>
          </section>
        )}

        {!isAuditing && !auditResult && (
          <section
            aria-label="Awaiting compliance audit"
            className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center"
          >
            <ShieldCheck className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              No Audit Report Generated Yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-lg text-sm text-slate-600">
              Upload 1–4 scans or PDFs above and click &quot;Run Compliance Audit&quot;, or load our realistic 3-document Indian portal sample case to inspect cross-document mismatch detection.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadSample}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Load Sample Case
              </button>
              <button
                type="button"
                onClick={() => setIsAdvisorOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <MessageSquare className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <span>Ask Compliance Advisor</span>
              </button>
            </div>
          </section>
        )}

        {!isAuditing && auditResult && (
          <>
            <AuditSummarySection
              audit={auditResult}
              onOpenAdvisor={() => setIsAdvisorOpen(true)}
            />
            <DiscrepancyMatrix audit={auditResult} />
            <DocumentFindingsList audit={auditResult} />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>DastavezGuard AI · Pre-Submission Document Verification Assistant</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="hover:text-slate-800 underline underline-offset-4 cursor-pointer"
            >
              Scoring Rubric
            </button>
            <button
              type="button"
              onClick={() => setIsAdvisorOpen(true)}
              className="hover:text-slate-800 underline underline-offset-4 cursor-pointer"
            >
              Compliance Advisor
            </button>
          </div>
        </div>
      </footer>

      <ComplianceAdvisorChat
        isOpen={isAdvisorOpen}
        onClose={() => setIsAdvisorOpen(false)}
        auditContext={auditResult}
      />

      <ComplianceRulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
}
