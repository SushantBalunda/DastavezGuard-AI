import React from 'react';
import { Check, Loader2 } from 'lucide-react';

export type AuditWorkflowStage = 'upload' | 'processing' | 'review';

interface AuditProgressStepperProps {
  currentStage: AuditWorkflowStage;
  hasDocuments: boolean;
}

interface StepDefinition {
  id: AuditWorkflowStage;
  number: string;
  label: string;
  sublabel: string;
}

const STEPS: StepDefinition[] = [
  {
    id: 'upload',
    number: '01',
    label: 'Upload Docs',
    sublabel: '1–4 scans or PDFs',
  },
  {
    id: 'processing',
    number: '02',
    label: 'Processing',
    sublabel: 'Field & expiry audit',
  },
  {
    id: 'review',
    number: '03',
    label: 'Review Results',
    sublabel: 'Score & discrepancies',
  },
];

const STAGE_ORDER: Record<AuditWorkflowStage, number> = {
  upload: 0,
  processing: 1,
  review: 2,
};

export const AuditProgressStepper: React.FC<AuditProgressStepperProps> = ({
  currentStage,
  hasDocuments,
}) => {
  const activeIndex = STAGE_ORDER[currentStage];

  return (
    <nav
      aria-label="Audit workflow progress"
      data-testid="audit-progress-stepper"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-6 print:hidden"
    >
      <ol className="flex items-center justify-between gap-2 sm:gap-4">
        {STEPS.map((step, index) => {
          const isCompleted = index < activeIndex;
          const isCurrent = index === activeIndex;
          const isConnectorActive = index < activeIndex;

          const uploadDetail =
            step.id === 'upload' && isCurrent && hasDocuments
              ? 'Ready to audit'
              : step.sublabel;

          return (
            <React.Fragment key={step.id}>
              <li
                aria-current={isCurrent ? 'step' : undefined}
                data-stage={step.id}
                data-state={isCompleted ? 'completed' : isCurrent ? 'active' : 'upcoming'}
                className="flex shrink-0 flex-col items-center gap-1.5 text-center sm:min-w-0 sm:flex-row sm:gap-3 sm:text-left"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors sm:h-8 sm:w-8 ${
                    isCompleted
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : isCurrent
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-300 bg-slate-50 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : step.id === 'processing' && isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    step.number
                  )}
                </span>

                <div>
                  <p
                    className={`whitespace-nowrap text-[11px] font-semibold sm:text-sm ${
                      isCompleted
                        ? 'text-emerald-800'
                        : isCurrent
                          ? 'text-slate-900'
                          : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="hidden truncate text-xs text-slate-500 md:block">
                    {uploadDetail}
                  </p>
                </div>
              </li>

              {index < STEPS.length - 1 && (
                <li
                  aria-hidden="true"
                  className={`h-px flex-1 min-w-3 transition-colors ${
                    isConnectorActive ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
