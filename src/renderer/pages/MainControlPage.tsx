import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { BacktrackMark } from '../components/brand/BacktrackMark';

export function MainControlPage() {
  const [isDeployed, setIsDeployed] = useState(false);
  const [status, setStatus] = useState('');
  const [activeFolder, setActiveFolder] = useState('');

  useEffect(() => {
    window.api.isButtonDeployed().then(setIsDeployed);
    const storedFolder = localStorage.getItem('backtrack.active-folder') || '';
    setActiveFolder(storedFolder);
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        await window.api.openDrawer();
        setStatus('Chat drawer opened.');
      }

      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        const result = await window.api.showPreviewWorkspace();
        setStatus(result.message);
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const proceed = window.confirm('Undo the most recent file organization?');
        if (!proceed) {
          return;
        }

        const latest = await window.api.getLatestExecution();
        const executionId = latest?.execution?.execution_id;
        if (!executionId) {
          setStatus('No previous organization found to undo.');
          return;
        }

        const result = await window.api.executeUndo(executionId);
        if (result?.success) {
          setStatus('Undo started. Track progress in the preview workspace.');
        } else {
          setStatus(result?.error || 'Could not undo the latest operation.');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleDeploy = async () => {
    setStatus('Deploying floating button...');
    const result = await window.api.deployFloatingButton();
    if (result.success) {
      setIsDeployed(true);
      setStatus('Floating button deployed at bottom-right of your active display.');
    } else {
      setStatus(result.message || 'Could not deploy floating button.');
    }
  };

  const handleHide = async () => {
    setStatus('Hiding workspace windows...');
    const result = await window.api.hideFloatingButton();
    if (result.success) {
      setIsDeployed(false);
      setStatus('Floating button and companion windows hidden.');
    } else {
      setStatus(result.message || 'Could not hide floating button.');
    }
  };

  const statusClasses = status.toLowerCase().includes('could not') || status.toLowerCase().includes('error')
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#f8fafc_0%,#dbeafe_55%,#cbd5e1_100%)] p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl border border-blue-100 bg-white/90 p-9 shadow-[0_36px_120px_rgba(15,23,42,0.2)] backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg">
              <BacktrackMark className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Backtrack Control Panel</h1>
            <p className="mt-2 text-slate-600">AI file organization with preview and one-click undo.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Active folder scope</p>
            <p className="mt-2 truncate text-sm font-medium text-slate-700">
              {activeFolder || 'No folder selected yet'}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {!isDeployed ? (
              <button
                onClick={handleDeploy}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:to-blue-600"
              >
                Deploy Floating Button
              </button>
            ) : (
              <button
                onClick={handleHide}
                className="w-full rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-slate-700"
              >
                Hide Floating Button
              </button>
            )}
          </div>

          {status && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${statusClasses}`}>
              {status}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-blue-900">
              <Keyboard className="h-4 w-4" />
              <p className="text-sm font-semibold">Keyboard shortcuts</p>
            </div>
            <div className="grid gap-2 text-sm text-blue-900/90 md:grid-cols-3">
              <p>
                <span className="font-semibold">Ctrl/Cmd + K</span>
                {' '}Open chat drawer
              </p>
              <p>
                <span className="font-semibold">Ctrl/Cmd + P</span>
                {' '}Show preview workspace
              </p>
              <p>
                <span className="font-semibold">Ctrl/Cmd + Z</span>
                {' '}Undo latest organization
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
