import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

type Status = 'idle' | 'checking' | 'undoing' | 'success' | 'error';

interface UndoProgressState {
  status: Status;
  progress: number;
  message: string;
}

export default function UndoProgress() {
  const [state, setState] = useState<UndoProgressState>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  useEffect(() => {
    if (!window.api?.onUndoProgress) return;
    const unsubscribe = window.api.onUndoProgress((progress: any) => {
      setState({
        status: progress.status,
        progress: progress.progress || 0,
        message: progress.message || '',
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (state.status === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className="w-[480px] rounded-2xl border border-white/15 bg-slate-900/80 p-7 text-white shadow-[0_30px_120px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          {(state.status === 'checking' || state.status === 'undoing') && (
            <>
              <h2 className="text-xl font-semibold mb-3">
                {state.status === 'checking' ? 'Checking for changes...' : 'Undoing changes'}
              </h2>
              <div className="mb-3 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-200/80">{state.message}</p>
            </>
          )}

          {state.status === 'success' && (
            <div className="space-y-3 text-sm text-slate-100">
              <div className="text-5xl">✅</div>
              <div className="text-lg font-semibold">Undo Successful</div>
              <p>All files have been restored to their original state.</p>
              <button
                onClick={() => setState({ status: 'idle', progress: 0, message: '' })}
                className="mt-2 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition"
              >
                Done
              </button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="space-y-3 text-sm text-slate-100">
              <div className="text-5xl">❌</div>
              <div className="text-lg font-semibold">Undo Failed</div>
              <p>{state.message}</p>
              <button
                onClick={() => setState({ status: 'idle', progress: 0, message: '' })}
                className="mt-2 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 transition"
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
