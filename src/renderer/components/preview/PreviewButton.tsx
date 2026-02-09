import { motion, AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useMemo } from 'react';
import { usePreviewStore } from '../../store/previewStore';

const riskDot: Record<string, string> = {
  safe: 'bg-emerald-500',
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
};

export function PreviewButton() {
  const { mode, plan, showPanel } = usePreviewStore();

  const files = useMemo(() => plan?.summary.files_affected ?? 0, [plan]);
  const risk = plan?.safety_analysis?.overall_risk ?? 'low';

  return (
    <AnimatePresence>
      {mode === 'button' && plan && (
        <motion.button
          type="button"
          onClick={showPanel}
          className="fixed right-6 top-6 z-[10040] flex items-center gap-3 rounded-full border border-gray-200/80 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.2)] backdrop-blur-xl transition hover:bg-white"
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <span className="flex items-center gap-2 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
            <Eye className="h-3.5 w-3.5" />
            Preview
          </span>
          <span className="text-slate-600">{files} files</span>
          <span className="flex h-2.5 w-2.5 items-center justify-center">
            <span className={`h-2.5 w-2.5 rounded-full ${riskDot[risk] ?? riskDot.low}`} />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
