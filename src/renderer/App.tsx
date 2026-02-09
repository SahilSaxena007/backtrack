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
import { useUndoStore } from './store/undoStore';
import type { FileModification } from '@shared/types';
import ProgressOverlay from './components/execution/ProgressOverlay';
import UndoButton from './components/undo/UndoButton';
import UndoProgress from './components/undo/UndoProgress';
import ModificationWarning from './components/undo/ModificationWarning';

function App() {
  const [currentPage, setCurrentPage] = useState<string>('');
  const [modifications, setModifications] = useState<FileModification[] | null>(null);
  const { showToast, plan } = usePreviewStore();
  const updateExecution = useExecutionStore((s) => s.updateProgress);
  const enableUndo = useUndoStore((s) => s.enableUndo);

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
    const unsubscribe = window.api.onExecutionProgress((progress: any) => {
      console.log('[ExecutionProgress]', progress);
      updateExecution(progress);
      if (progress?.status === 'success' && window.api?.getLatestExecution) {
        console.log('[App] Execution success! Fetching latest execution for undo...');
        window.api.getLatestExecution().then((res: any) => {
          console.log('[App] getLatestExecution result:', res);
          if (res?.success && res.execution) {
            console.log('[App] Enabling undo with execution_id:', res.execution.execution_id);
            enableUndo({
              execution_id: res.execution.execution_id,
              description: res.execution.description || 'File organization',
              completed_at: res.execution.completed_at || new Date().toISOString(),
            });
            console.log('[App] enableUndo called');
          } else {
            console.log('[App] Cannot enable undo - no execution data');
          }
        });
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [updateExecution, enableUndo]);

  useEffect(() => {
    if (!window.api?.onModificationWarning) return;
    const unsub = window.api.onModificationWarning((mods: FileModification[]) => {
      console.log('[App] Modification warning received:', mods.length, 'modifications');
      setModifications(mods);
      console.log('[App] Modifications state updated, modal should appear');
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Route to the appropriate page
  if (currentPage === 'control-panel') {
    return (
      <>
        <MainControlPage />
        <PreviewToast />
        <PreviewPanel />
        <PreviewButton />
        <ProgressOverlay />
        <UndoButton />
        <UndoProgress />
        {modifications && (
          <ModificationWarning
            modifications={modifications}
            onCancel={() => {
              window.api.sendModificationDecision(false);
              setModifications(null);
            }}
            onUndoAnyway={() => {
              window.api.sendModificationDecision(true);
              setModifications(null);
            }}
            onViewDetails={() => {
              alert(modifications.map((m) => `${m.type.toUpperCase()}: ${m.path} (${m.message})`).join('\n'));
            }}
          />
        )}
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
        <UndoButton />
        <UndoProgress />
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
        <UndoButton />
        <UndoProgress />
        {modifications && (
          <ModificationWarning
            modifications={modifications}
            onCancel={() => {
              window.api.sendModificationDecision(false);
              setModifications(null);
            }}
            onUndoAnyway={() => {
              window.api.sendModificationDecision(true);
              setModifications(null);
            }}
            onViewDetails={() => {
              alert(modifications.map((m) => `${m.type.toUpperCase()}: ${m.path} (${m.message})`).join('\n'));
            }}
          />
        )}
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
        <UndoButton />
        <UndoProgress />
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
      <UndoButton />
      <UndoProgress />
      {(() => {
        console.log('[App] Render check - modifications:', modifications ? `${modifications.length} items` : 'null');
        return modifications ? (
          <ModificationWarning
            modifications={modifications}
          onCancel={() => {
            window.api.sendModificationDecision(false);
            setModifications(null);
          }}
          onUndoAnyway={() => {
            window.api.sendModificationDecision(true);
            setModifications(null);
          }}
          onViewDetails={() => {
            alert(
              modifications
                .map((m) => `${m.type.toUpperCase()}: ${m.path} (${m.message})`)
                .join('\n')
            );
          }}
        />
        ) : null;
      })()}
    </>
  );
}

export default App;
