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
    message: ''
  });

  useEffect(() => {
    if (!window.api?.onUndoProgress) {
      return;
    }
    const unsubscribe = window.api.onUndoProgress((progress: any) => {
      setState({
        status: progress.status,
        progress: progress.progress || 0,
        message: progress.message || ''
      });
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  if (state.status === 'idle') {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/45"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          className="w-[460px] rounded-2xl border border-slate-200 bg-white/95 p-7 text-slate-900 shadow-[0_30px_100px_rgba(15,23,42,0.3)] backdrop-blur-xl"
        >
          {(state.status === 'checking' || state.status === 'undoing') && (
            <>
              <h2 className="mb-3 text-xl font-semibold">
                {state.status === 'checking' ? 'Checking changes before undo...' : 'Restoring files'}
              </h2>
              <div className="mb-3 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-700">{state.message}</p>
            </>
          )}

          {state.status === 'success' && (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="text-3xl">Success</div>
              <div className="text-lg font-semibold text-slate-900">Undo Complete</div>
              <p>Your files were restored to their previous state.</p>
              <button
                onClick={() => setState({ status: 'idle', progress: 0, message: '' })}
                className="mt-2 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Done
              </button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="text-lg font-semibold text-red-600">Undo failed</div>
              <p>{state.message || 'Undo could not complete safely.'}</p>
              <button
                onClick={() => setState({ status: 'idle', progress: 0, message: '' })}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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
