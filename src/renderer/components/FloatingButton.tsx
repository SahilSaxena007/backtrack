import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

export function FloatingButton() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Check drawer state on mount and poll for changes
  useEffect(() => {
    // Initial check
    window.api.isDrawerOpen().then(setDrawerOpen);

    // Poll drawer state every 500ms to stay in sync
    const interval = setInterval(async () => {
      const isOpen = await window.api.isDrawerOpen();
      setDrawerOpen(isOpen);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    const isOpen = await window.api.toggleDrawer();
    setDrawerOpen(isOpen);
  };

  // Keyboard shortcut: Cmd/Ctrl + K to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle mouse events for click-through
  const handleMouseEnter = () => {
    window.api.setButtonMouseEvents(false); // Enable mouse events
  };

  const handleMouseLeave = () => {
    window.api.setButtonMouseEvents(true); // Disable mouse events (click-through)
  };

  return (
    <motion.button
      onClick={handleToggle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        fixed bottom-6 right-6
        w-16 h-16
        rounded-full
        shadow-2xl
        flex items-center justify-center
        transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
        z-50
        ${
          drawerOpen
            ? 'bg-gray-800 hover:bg-gray-700'
            : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
        }
      `}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        scale: hasNewMessage && !drawerOpen ? [1, 1.1, 1] : 1,
      }}
      transition={{
        scale: {
          duration: 0.5,
          repeat: hasNewMessage && !drawerOpen ? Infinity : 0,
          repeatDelay: 1,
        },
      }}
    >
      {/* Loading border animation */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Breathing animation when idle (not loading, not open, no new messages) */}
      {!isLoading && !drawerOpen && !hasNewMessage && (
        <motion.div
          className="absolute inset-0 rounded-full bg-white opacity-10"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Icon - switches between MessageCircle and X */}
      <motion.div
        initial={false}
        animate={{ rotate: drawerOpen ? 90 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {drawerOpen ? (
          <X className="w-6 h-6 text-white" strokeWidth={2.5} />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
        )}
      </motion.div>

      {/* Notification badge for new messages */}
      {hasNewMessage && !drawerOpen && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        />
      )}
    </motion.button>
  );
}
