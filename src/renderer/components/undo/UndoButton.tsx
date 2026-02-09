import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useUndoStore } from '../../store/undoStore';
import UndoConfirmation from './UndoConfirmation';

export default function UndoButton() {
  const { canUndo, description, isUndoing } = useUndoStore();
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!canUndo && !isUndoing) return null;

  const handleClick = () => {
    if (canUndo && !isUndoing) {
      setShowConfirmation(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {(canUndo || isUndoing) && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={handleClick}
            disabled={!canUndo || isUndoing}
            className={`fixed bottom-24 right-6 z-[9996] px-4 py-3 rounded-xl backdrop-blur-[20px] backdrop-saturate-[150%] border shadow-lg transition-all duration-200 ${
              canUndo && !isUndoing
                ? 'bg-orange-500/90 hover:bg-orange-600/90 text-white border-orange-400 cursor-pointer hover:scale-105'
                : 'bg-gray-300/70 text-gray-500 border-gray-400 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">⏪</span>
              <div className="text-left">
                <div className="font-semibold text-sm">
                  {isUndoing ? 'Undoing...' : 'Undo'}
                </div>
                <div className="text-xs opacity-80">
                  {canUndo ? description.substring(0, 30) : 'No undo available'}
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
