import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useExecutionStore } from '../../store/executionStore';

export function ProgressOverlay() {
  const { status, progress, currentAction, message, error, reset } = useExecutionStore();

  if (status === 'idle') return null;

  const titleMap: Record<string, string> = {
    preparing: 'Preparing',
    executing: 'Executing Plan',
    success: 'Success',
    error: 'Error',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className="w-[460px] rounded-2xl border border-white/15 bg-slate-900/70 p-6 text-white shadow-[0_30px_120px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center gap-2">
            {status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : status === 'error' ? (
              <XCircle className="h-5 w-5 text-red-400" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
            )}
            <h2 className="text-lg font-semibold">{titleMap[status]}</h2>
          </div>

          {(status === 'preparing' || status === 'executing') && (
            <>
              <p className="text-sm text-slate-200/80 mb-3">{message || 'Working...'}</p>
              <div className="mb-2 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{progress ?? 0}%</span>
                <span className="truncate max-w-[70%] text-right">
                  {currentAction || 'Executing...'}
                </span>
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="space-y-3 text-sm text-slate-200">
              <p>All actions completed successfully.</p>
              <p className="text-emerald-300 text-xs">Undo is available via backup checkpoint.</p>
              <button
                onClick={reset}
                className="mt-2 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition"
              >
                Done
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3 text-sm text-slate-200">
              <p className="text-red-200">{error || 'Execution failed.'}</p>
              <p className="text-emerald-300 text-xs">
                Backup restoration attempted automatically.
              </p>
              <button
                onClick={reset}
                className="mt-2 w-full rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition"
              >
                Close
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ProgressOverlay;
