import { motion } from 'framer-motion';
import type { FileModification } from '@shared/types';

interface Props {
  modifications: FileModification[];
  onUndoAnyway: () => void;
  onCancel: () => void;
  onViewDetails: () => void;
}

export default function ModificationWarning({
  modifications,
  onUndoAnyway,
  onCancel,
  onViewDetails,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-900"
      >
        <div className="mb-4 text-6xl">⚠️</div>
        <h2 className="mb-4 text-2xl font-bold">Files Modified Since Execution</h2>

        <p className="mb-4 text-gray-600 dark:text-gray-400">
          {modifications.length} file{modifications.length > 1 ? 's have' : ' has'} been changed
          since the organization.
        </p>

        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
          <p className="mb-2 text-sm font-medium text-orange-800 dark:text-orange-300">
            What this means:
          </p>
          <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-400">
            <li>• Undoing will restore files to their pre-organization state</li>
            <li>• Changes you made after organization will be lost</li>
            <li>• We recommend canceling to keep your changes</li>
          </ul>
        </div>

        <div className="space-y-3">
          <button
            onClick={onCancel}
            className="w-full rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
          >
            Cancel Undo (Recommended)
          </button>
          <button
            onClick={onViewDetails}
            className="w-full rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-900 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            See Which Files Changed
          </button>
          <button
            onClick={onUndoAnyway}
            className="w-full rounded-lg bg-orange-500 px-6 py-3 font-medium text-white transition hover:bg-orange-600"
          >
            Undo Anyway (Lose My Changes)
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
