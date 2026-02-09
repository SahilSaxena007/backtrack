import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useUndoStore } from '../../store/undoStore';
import UndoConfirmation from './UndoConfirmation';

export default function UndoButton() {
  const { canUndo, description, isUndoing } = useUndoStore();
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!canUndo && !isUndoing) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {(canUndo || isUndoing) && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => {
              if (canUndo && !isUndoing) {
                setShowConfirmation(true);
              }
            }}
            disabled={!canUndo || isUndoing}
            className={`fixed right-6 top-20 z-[9996] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-xl transition-all duration-200 ${
              canUndo && !isUndoing
                ? 'border-amber-200 bg-white/95 text-amber-700 hover:bg-amber-50'
                : 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              <div className="text-left">
                <div className="text-xs font-semibold">{isUndoing ? 'Undoing...' : 'Undo'}</div>
                <div className="max-w-[150px] truncate text-[10px] opacity-80">
                  {canUndo ? description : 'No undo available'}
                </div>
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {showConfirmation && <UndoConfirmation onClose={() => setShowConfirmation(false)} />}
    </>
  );
}
