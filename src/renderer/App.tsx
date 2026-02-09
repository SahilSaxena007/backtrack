import { useEffect, useState } from 'react';
import { MainControlPage } from './pages/MainControlPage';
import { FloatingButtonPage } from './pages/FloatingButtonPage';
import { ChatDrawerPage } from './pages/ChatDrawerPage';
import { PreviewTestPage } from './pages/PreviewTestPage';
import { PreviewWorkspacePage } from './pages/PreviewWorkspacePage';
import { OnboardingPage } from './pages/OnboardingPage';
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
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const { showToast, showButton, plan } = usePreviewStore();
  const updateExecution = useExecutionStore((s) => s.updateProgress);
  const enableUndo = useUndoStore((s) => s.enableUndo);
  const isPreviewSurfacePage = currentPage === 'preview-workspace' || currentPage === 'preview-test';

  useEffect(() => {
    const hash = window.location.hash.replace('#/', '');
    setCurrentPage(hash || 'control-panel');

    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#/', '');
      setCurrentPage(newHash || 'control-panel');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const completed = localStorage.getItem('backtrack.onboarding.completed') === 'true';
    const activeFolder = localStorage.getItem('backtrack.active-folder');
    setIsOnboardingComplete(completed);

    if (completed && activeFolder && window.api?.setActiveBasePath) {
      void window.api.setActiveBasePath(activeFolder);
    }
  }, []);

  useEffect(() => {
    if (!window.api?.onPreviewWorkspaceEvent) {
      return;
    }

    const unsubscribe = window.api.onPreviewWorkspaceEvent((event: any) => {
      if (!event?.type) {
        return;
      }

      const previewStore = usePreviewStore.getState();

      if (event.type === 'present-plan' && event.plan) {
        previewStore.showToast(event.plan);
        if (event.mode === 'panel') {
          previewStore.showPanel();
        } else if (event.mode === 'button') {
          previewStore.showButton();
        }
        return;
      }

      if (event.type === 'set-mode') {
        if (event.mode === 'panel') {
          previewStore.showPanel();
        } else if (event.mode === 'button') {
          previewStore.showButton();
        } else if (event.mode === 'toast' && previewStore.plan) {
          previewStore.showToast(previewStore.plan);
        }
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
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
    if (!isPreviewSurfacePage || !window.api?.onExecutionProgress) {
      return;
    }

    const unsubscribe = window.api.onExecutionProgress((progress: any) => {
      console.log('[ExecutionProgress]', progress);
      updateExecution(progress);
      if (progress?.status === 'success' && window.api?.getLatestExecution) {
        showButton();
        window.api.getLatestExecution().then((res: any) => {
          if (res?.success && res.execution) {
            enableUndo({
              execution_id: res.execution.execution_id,
              description: res.execution.description || 'File organization',
              completed_at: res.execution.completed_at || new Date().toISOString(),
            });
          }
        });
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isPreviewSurfacePage, updateExecution, enableUndo, showButton]);

  useEffect(() => {
    if (!isPreviewSurfacePage || !window.api?.onModificationWarning) {
      return;
    }

    const unsubscribe = window.api.onModificationWarning((mods: FileModification[]) => {
      setModifications(mods);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isPreviewSurfacePage]);

  const renderModificationWarning = () => {
    if (!modifications) {
      return null;
    }
    return (
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
    );
  };

  const renderPreviewSurfaceUI = () => (
    <>
      <PreviewToast />
      <PreviewPanel />
      <PreviewButton />
      <ProgressOverlay />
      <UndoButton />
      <UndoProgress />
      {renderModificationWarning()}
    </>
  );

  if (currentPage === 'control-panel') {
    if (!isOnboardingComplete) {
      return (
        <OnboardingPage
          onComplete={({ path }) => {
            setIsOnboardingComplete(true);
            if (window.api?.setActiveBasePath) {
              void window.api.setActiveBasePath(path);
            }
          }}
        />
      );
    }
    return <MainControlPage />;
  }

  if (currentPage === 'floating-button') {
    return (
      <div className="w-screen h-screen bg-transparent">
        <FloatingButtonPage />
      </div>
    );
  }

  if (currentPage === 'chat-drawer') {
    return (
      <div className="w-screen h-screen bg-transparent">
        <ChatDrawerPage />
      </div>
    );
  }

  if (currentPage === 'preview-workspace') {
    return (
      <>
        <PreviewWorkspacePage />
        {renderPreviewSurfaceUI()}
      </>
    );
  }

  if (currentPage === 'preview-test') {
    return (
      <>
        <PreviewTestPage />
        {renderPreviewSurfaceUI()}
      </>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Unknown page: {currentPage}</p>
    </div>
  );
}

export default App;
