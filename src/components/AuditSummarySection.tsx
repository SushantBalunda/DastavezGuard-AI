import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Printer,
  ShieldAlert,
  Volume2,
} from 'lucide-react';
import type { ComplianceAuditResult } from '../types/audit';
import {
  buildComplianceMailtoUrl,
  buildTtsBriefingScript,
} from '../utils/compliance';

interface AuditSummarySectionProps {
  audit: ComplianceAuditResult;
  onOpenAdvisor: () => void;
}

export const AuditSummarySection: React.FC<AuditSummarySectionProps> = ({
  audit,
  onOpenAdvisor,
}) => {
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAudioUrl(null);
    setTtsError(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audit]);

  const handleToggleTts = async () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    setTtsLoading(true);
    setTtsError(null);
    try {
      const script = buildTtsBriefingScript(audit);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voiceName: 'Kore' }),
      });
      const data = (await res.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Failed to generate audio briefing.');
      }
      const nextUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setAudioUrl(nextUrl);
      setTimeout(() => {
        if (audioRef.current) {
          void audioRef.current.play();
          setIsPlaying(true);
        }
      }, 60);
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'Unable to generate TTS briefing.');
    } finally {
      setTtsLoading(false);
    }
  };

  const tierStyle =
    audit.readinessTier === 'Ready to Submit'
      ? {
          text: 'text-emerald-700',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
        }
      : audit.readinessTier === 'Needs Attention'
        ? {
            text: 'text-amber-800',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            icon: <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />,
          }
        : {
            text: 'text-red-700',
            bg: 'bg-red-50',
            border: 'border-red-200',
            icon: <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />,
          };

  return (
    <section
      aria-labelledby="audit-summary-heading"
      data-testid="audit-summary-section"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{audit.targetScheme}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Audit Date: {audit.auditDate}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{audit.documents.length} Documents</span>
          </div>
          <h2
            id="audit-summary-heading"
            className="mt-1 font-display text-xl font-bold text-slate-900"
          >
            Pre-Submission Compliance Report
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={() => void handleToggleTts()}
            disabled={ttsLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {ttsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-700" aria-hidden="true" />
            ) : audioUrl ? (
              isPlaying ? (
                <Pause className="h-4 w-4 text-blue-700" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 text-blue-700" aria-hidden="true" />
              )
            ) : (
              <Volume2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
            )}
            <span>
              {ttsLoading
                ? 'Generating Briefing...'
                : audioUrl
                  ? isPlaying
                    ? 'Pause Briefing'
                    : 'Play Briefing'
                  : 'Listen to Audit Briefing'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <span>Print Report</span>
          </button>

          <a
            href={buildComplianceMailtoUrl(audit)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Mail className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <span>Share via Email</span>
          </a>

          <button
            type="button"
            onClick={onOpenAdvisor}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>Ask Compliance Advisor</span>
          </button>

          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            className="hidden"
          />
        </div>
      </div>

      {ttsError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
        >
          Audio Briefing unavailable: {ttsError}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-5">
          <div>
            <p className="text-xs font-medium text-slate-500">Readiness Score</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                data-testid="readiness-score-value"
                className="font-mono text-5xl font-semibold tracking-tight text-slate-900 tabular-nums"
              >
                {audit.readinessScore}
              </span>
              <span className="font-mono text-lg text-slate-400 tabular-nums">/ 100</span>
            </div>

            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold ${tierStyle.bg} ${tierStyle.border} ${tierStyle.text}`}
            >
              {tierStyle.icon}
              <span>{audit.readinessTier}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
            <div>
              <p className="text-xs text-slate-500">Critical Blockers</p>
              <p className="mt-0.5 font-mono text-xl font-semibold text-red-700 tabular-nums">
                {audit.criticalBlockersCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Minor Warnings</p>
              <p className="mt-0.5 font-mono text-xl font-semibold text-amber-700 tabular-nums">
                {audit.minorWarningsCount}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col justify-between gap-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Auditor Verdict</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              {audit.executiveVerdict}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Score Deduction Ledger</h3>
            {audit.deductions.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700">
                No deductions applied. Base score of 100 retained.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-200 border-t border-b border-slate-200">
                {audit.deductions.map((item, idx) => (
                  <li
                    key={`${item.reason}-${idx}`}
                    className="flex items-start justify-between gap-4 py-2.5 text-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 font-mono text-xs font-semibold ${
                          item.severity === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {item.severity}
                      </span>
                      <span className="text-slate-700">{item.reason}</span>
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold tabular-nums shrink-0 ${
                        item.severity === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      -{item.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
