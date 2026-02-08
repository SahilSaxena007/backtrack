import { useEffect, useState } from 'react';
import { MainControlPage } from './pages/MainControlPage';
import { FloatingButtonPage } from './pages/FloatingButtonPage';
import { ChatDrawerPage } from './pages/ChatDrawerPage';
import { PreviewTestPage } from './pages/PreviewTestPage';
import { PreviewToast } from './components/preview/PreviewToast';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { PreviewButton } from './components/preview/PreviewButton';
import { usePreviewStore } from './store/previewStore';
import { useExecutionStore } from './store/executionStore';
import ProgressOverlay from './components/execution/ProgressOverlay';

function App() {
  const [currentPage, setCurrentPage] = useState<string>('');
  const { showToast, plan } = usePreviewStore();
  const updateExecution = useExecutionStore((s) => s.updateProgress);

  useEffect(() => {
    // Determine which page to show based on URL hash
    const hash = window.location.hash.replace('#/', '');
    setCurrentPage(hash || 'control-panel');

    // Listen for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#/', '');
      setCurrentPage(newHash || 'control-panel');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || plan) {
      return;
    }
    (window as any).__previewToast = {
      show: showToast
    };
    return () => {
      if ((window as any).__previewToast) {
        delete (window as any).__previewToast;
      }
    };
  }, [plan, showToast]);

  useEffect(() => {
    if (!window.api?.onExecutionProgress) {
      return;
    }
    const unsubscribe = window.api.onExecutionProgress((progress) => {
      updateExecution(progress);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [updateExecution]);

  // Route to the appropriate page
  if (currentPage === 'control-panel') {
    return (
      <>
        <MainControlPage />
        <PreviewToast />
        <PreviewPanel />
        <PreviewButton />
        <ProgressOverlay />
      </>
    );
  }

  if (currentPage === 'floating-button') {
    return (
      <>
        <div className="w-screen h-screen bg-transparent">
          <FloatingButtonPage />
        </div>
        <PreviewToast />
        <PreviewPanel />
        <PreviewButton />
        <ProgressOverlay />
      </>
    );
  }

  if (currentPage === 'chat-drawer') {
    return (
      <>
        <div className="w-screen h-screen bg-transparent">
          <ChatDrawerPage />
        </div>
        <PreviewToast />
        <PreviewPanel />
        <PreviewButton />
        <ProgressOverlay />
      </>
    );
  }

  if (currentPage === 'preview-test') {
    return (
      <>
        <PreviewTestPage />
        <PreviewToast />
        <PreviewPanel />
        <PreviewButton />
        <ProgressOverlay />
      </>
    );
  }

  // Default fallback
  return (
    <>
      <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">Unknown page: {currentPage}</p>
      </div>
      <PreviewToast />
      <PreviewPanel />
      <PreviewButton />
      <ProgressOverlay />
    </>
  );
}

export default App;
