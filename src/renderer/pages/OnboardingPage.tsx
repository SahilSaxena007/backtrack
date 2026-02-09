import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { BacktrackMark } from '../components/brand/BacktrackMark';

type OnboardingMode = 'demo' | 'custom';

interface OnboardingPageProps {
  onComplete: (payload: { mode: OnboardingMode; path: string }) => void;
}

const ONBOARDING_STORAGE_KEY = 'backtrack.onboarding.completed';
const ACTIVE_FOLDER_KEY = 'backtrack.active-folder';
const MODE_KEY = 'backtrack.folder-mode';

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [mode, setMode] = useState<OnboardingMode>('demo');
  const [customPath, setCustomPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBrowse = async () => {
    const result = await window.api.selectFolderDialog();
    if (result.success && result.path) {
      setCustomPath(result.path);
      setMode('custom');
      setError('');
    }
  };

  const saveChoice = (selectedMode: OnboardingMode, selectedPath: string) => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    localStorage.setItem(ACTIVE_FOLDER_KEY, selectedPath);
    localStorage.setItem(MODE_KEY, selectedMode);
    onComplete({ mode: selectedMode, path: selectedPath });
  };

  const handleGetStarted = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'demo') {
        const demoResult = await window.api.setupDemoFolder();
        if (!demoResult.success || !demoResult.path) {
          throw new Error(demoResult.message || 'Could not prepare demo folder.');
        }

        const scopeResult = await window.api.setActiveBasePath(demoResult.path);
        if (!scopeResult.success) {
          throw new Error(scopeResult.message || 'Could not activate demo folder.');
        }

        saveChoice('demo', demoResult.path);
        return;
      }

      if (!customPath.trim()) {
        throw new Error('Choose a folder before continuing.');
      }

      const validation = await window.api.validateFolderPath(customPath);
      if (!validation.success || !validation.exists || !validation.isDirectory) {
        throw new Error('That folder is not accessible. Please choose a different folder.');
      }

      const scopeResult = await window.api.setActiveBasePath(customPath);
      if (!scopeResult.success) {
        throw new Error(scopeResult.message || 'Could not activate selected folder.');
      }

      saveChoice('custom', customPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start onboarding.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#dbeafe_0%,#f8fafc_35%,#e2e8f0_100%)] p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl border border-blue-100 bg-white/90 p-10 shadow-[0_40px_120px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg">
              <BacktrackMark className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome to Backtrack</h1>
            <p className="mt-2 text-slate-600">AI-Powered File Organization</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Choose a folder to organize
            </p>

            <button
              type="button"
              onClick={() => setMode('demo')}
              className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                mode === 'demo'
                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-blue-200'
              }`}
            >
              <p className="font-semibold text-slate-900">Demo Mode (Safe sandbox)</p>
              <p className="mt-1 text-sm text-slate-600">
                Uses a sample folder in your user directory so judges can test safely.
              </p>
            </button>

            <div
              className={`rounded-2xl border px-5 py-4 transition ${
                mode === 'custom'
                  ? 'border-blue-300 bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => setMode('custom')}
                className="w-full text-left"
              >
                <p className="font-semibold text-slate-900">Custom Folder</p>
                <p className="mt-1 text-sm text-slate-600">Pick any folder you want Backtrack to organize.</p>
              </button>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={customPath}
                  onChange={(event) => setCustomPath(event.target.value)}
                  placeholder="Select folder path..."
                  className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                >
                  <FolderOpen className="h-4 w-4" />
                  Browse
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8">
            <button
              type="button"
              onClick={handleGetStarted}
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Preparing Workspace...' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
