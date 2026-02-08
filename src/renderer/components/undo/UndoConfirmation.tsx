import { motion } from 'framer-motion';
import { useUndoStore } from '../../store/undoStore';

interface Props {
  onClose: () => void;
}

export default function UndoConfirmation({ onClose }: Props) {
  const { executionId, description, timestamp, startUndo, completeUndo, disableUndo } =
    useUndoStore.getState();

  const handleConfirm = async () => {
    onClose();
    startUndo();
    try {
      const result = await window.api.executeUndo?.(executionId);
      if (result?.success) {
        completeUndo();
      } else {
        disableUndo();
        alert(`Undo failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      disableUndo();
      alert(`Undo failed: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-2xl font-bold">Undo Execution?</h2>

        <div className="mb-6">
          <p className="mb-2 text-gray-600 dark:text-gray-400">
            This will restore your files to the state before:
          </p>
          <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <p className="mb-2 font-medium text-gray-900 dark:text-white">"{description}"</p>
            {timestamp && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(timestamp).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm text-green-800 dark:text-green-300">
            ✓ Guaranteed restoration - all changes will be reversed
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-900 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-orange-500 px-6 py-3 font-medium text-white transition hover:bg-orange-600"
          >
            Yes, Undo
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
