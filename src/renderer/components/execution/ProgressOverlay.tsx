import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { usePreviewStore } from '../../store/previewStore';

const stageRows = [
  { id: 'backup', label: 'Creating safe backup checkpoint', threshold: 20 },
  { id: 'prepare', label: 'Preparing file operations', threshold: 50 },
  { id: 'execute', label: 'Applying file moves and folder changes', threshold: 90 },
  { id: 'complete', label: 'Safety verification complete', threshold: 100 }
];

export function ProgressOverlay() {
  const { status, progress, currentAction, message, error, reset } = useExecutionStore();
  const previewPlan = usePreviewStore((state) => state.plan);
  const startTimeRef = useRef<number | null>(null);
  const confettiTriggeredRef = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (status === 'preparing' || status === 'executing') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      setElapsedMs(Date.now() - startTimeRef.current);
      return;
    }

    if (status === 'success' && startTimeRef.current) {
      setElapsedMs(Date.now() - startTimeRef.current);
    }

    if (status === 'idle') {
      startTimeRef.current = null;
      confettiTriggeredRef.current = false;
      setElapsedMs(0);
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'success' || confettiTriggeredRef.current) {
      return;
    }

    confettiTriggeredRef.current = true;
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        confetti({
          particleCount: 120,
          spread: 80,
          startVelocity: 45,
          origin: { y: 0.6 }
        });
      })
      .catch(() => {
        // Keep UX functional if dependency is missing
      });
  }, [status]);

  const prettySeconds = useMemo(() => (elapsedMs > 0 ? (elapsedMs / 1000).toFixed(1) : '0.0'), [elapsedMs]);
  const filesAffected = previewPlan?.summary.files_affected ?? 0;
  const foldersCreated = previewPlan?.summary.folders_created ?? 0;

  if (status === 'idle') {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className="w-[500px] rounded-2xl border border-blue-200/70 bg-white/95 p-6 text-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.35)] backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center gap-2">
            {status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            ) : status === 'error' ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            )}
            <h2 className="text-lg font-semibold">
              {status === 'success'
                ? 'Files Organized!'
                : status === 'error'
                  ? 'Could not complete organization'
                  : 'Organizing your files'}
            </h2>
          </div>

          {(status === 'preparing' || status === 'executing') && (
            <>
              <p className="mb-3 text-sm text-slate-700">{message || 'Working on your organization plan...'}</p>
              <div className="mb-3 h-2 w-full rounded-full bg-blue-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-700"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
              <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
                <span>{progress ?? 0}%</span>
                <span className="max-w-[70%] truncate text-right">{currentAction || 'Applying actions...'}</span>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {stageRows.map((stage) => {
                  const complete = (progress ?? 0) >= stage.threshold;
                  const active = !complete && (progress ?? 0) >= stage.threshold - 30;
                  return (
                    <div
                      key={stage.id}
                      className={`flex items-center justify-between text-xs ${
                        complete ? 'text-emerald-700' : active ? 'text-blue-700' : 'text-slate-500'
                      }`}
                    >
                      <span>{stage.label}</span>
                      <span>{stage.threshold}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="space-y-4 text-sm text-slate-800">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-700">Organization complete</p>
                <div className="mt-2 space-y-1 text-emerald-800">
                  <p>Created {foldersCreated} folders</p>
                  <p>Moved {filesAffected} files</p>
                  <p>Completed in {prettySeconds}s</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void window.api.showPreviewWorkspace()}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  View Changes
                </button>
                <button
                  onClick={async () => {
                    const latest = await window.api.getLatestExecution();
                    const executionId = latest?.execution?.execution_id;
                    if (executionId) {
                      await window.api.executeUndo(executionId);
                    }
                    reset();
                  }}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Undo
                </button>
              </div>
              <button
                onClick={reset}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3 text-sm text-slate-700">
              <p>{error || 'We could not organize this folder safely.'}</p>
              <p className="text-xs text-emerald-700">
                Your files are protected. If any action failed, backup restoration was attempted automatically.
              </p>
              <button
                onClick={reset}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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
