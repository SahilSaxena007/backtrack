import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePreviewStore } from '../../store/previewStore';

const riskStyles: Record<string, { label: string; classes: string }> = {
  safe: { label: 'Safe', classes: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  low: { label: 'Low', classes: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' },
  medium: { label: 'Medium', classes: 'bg-amber-500/15 text-amber-200 border-amber-400/30' },
  high: { label: 'High', classes: 'bg-orange-500/15 text-orange-200 border-orange-400/30' },
  critical: { label: 'Critical', classes: 'bg-red-500/15 text-red-200 border-red-400/30' }
};

const formatDuration = (ms?: number) => {
  if (!ms || Number.isNaN(ms)) {
    return '—';
  }
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${seconds}s`;
};

export function PreviewToast() {
  const { mode, plan, showPanel, approvePlan } = usePreviewStore();
  const risk = plan?.safety_analysis?.overall_risk ?? 'low';

  const stats = useMemo(() => {
    if (!plan) {
      return null;
    }
    return [
      { label: 'Files', value: plan.summary.files_affected },
      { label: 'Folders', value: plan.summary.folders_created },
      { label: 'Actions', value: plan.summary.total_actions },
      { label: 'Time', value: formatDuration(plan.gemini_metadata?.total_time_ms) }
    ];
  }, [plan]);

  const content = (
    <AnimatePresence>
      {mode === 'toast' && plan && (
        <motion.div
          className="fixed right-6 top-6 z-[10020] w-[360px] rounded-2xl border border-white/20 bg-white/15 p-4 text-white shadow-[0_20px_80px_rgba(15,23,42,0.35)] backdrop-blur-[30px] dark:border-white/10 dark:bg-slate-900/40"
          initial={{ opacity: 0, x: 24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Plan ready to preview</p>
              <p className="text-xs text-slate-200/80">Review changes before any files are touched.</p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${riskStyles[risk]?.classes ?? riskStyles.low.classes}`}
            >
              {riskStyles[risk]?.label ?? 'Low'} risk
            </span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {stats?.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-white/10 px-2 py-2 text-xs text-slate-100"
              >
                <div className="text-sm font-semibold">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-200/70">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={showPanel}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/20"
            >
              View Full Preview
            </button>
            <button
              type="button"
              onClick={approvePlan}
              className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgba(16,185,129,0.45)] transition hover:bg-emerald-400"
            >
              Approve &amp; Execute
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
