import React from 'react';

interface HeaderBarProps {
  onLoadSample: () => void;
  onOpenRules: () => void;
  onOpenAdvisor: () => void;
  onRunAudit: () => void;
  isAuditing: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onLoadSample,
  onOpenRules,
  onOpenAdvisor,
  onRunAudit,
  isAuditing,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        <a
          href="#workbench"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          DastavezGuard AI
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#workbench"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Workbench
          </a>
          <button
            type="button"
            onClick={onLoadSample}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Sample Case
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Scoring Rules
          </button>
          <button
            type="button"
            onClick={onOpenAdvisor}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Advisor
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onRunAudit}
            disabled={isAuditing}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {isAuditing ? 'Auditing...' : 'Run Audit'}
          </button>
        </div>
      </div>
    </header>
  );
};
