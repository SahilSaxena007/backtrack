import { motion } from 'framer-motion';
import { useUndoStore } from '../../store/undoStore';

interface Props {
  onClose: () => void;
}

export default function UndoConfirmation({ onClose }: Props) {
  const { executionId, description, timestamp, startUndo, completeUndo, disableUndo } = useUndoStore.getState();

  const handleConfirm = async () => {
    onClose();
    startUndo();

    try {
      let execId = executionId;
      if (!execId && window.api?.getLatestExecution) {
        const latest = await window.api.getLatestExecution();
        execId = latest?.execution?.execution_id;
      }

      if (!execId) {
        throw new Error('No operation is available to undo yet.');
      }

      const result = await window.api.executeUndo?.(execId);
      if (result?.success) {
        completeUndo();
      } else {
        disableUndo();
        alert(result?.error || 'Undo could not be completed.');
      }
    } catch (error: any) {
      disableUndo();
      alert(error?.message || 'Undo could not be completed.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/45"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-3 text-xl font-bold text-slate-900">Undo this organization?</h2>

        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-1 text-sm text-slate-600">You are about to restore files from:</p>
          <p className="font-medium text-slate-900">{description}</p>
          {timestamp && <p className="mt-1 text-xs text-slate-500">{new Date(timestamp).toLocaleString()}</p>}
        </div>

        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Safe restore enabled. Backtrack will reverse every recorded change in this execution.
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white transition hover:bg-amber-600"
          >
            Undo Now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
