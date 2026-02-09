import { Eye, X } from 'lucide-react';
import { usePreviewStore } from '../store/previewStore';

export function PreviewWorkspacePage() {
  const { plan, mode, showPanel } = usePreviewStore();
  const hasPlan = Boolean(plan);

  return (
    <div className="relative h-screen w-screen bg-transparent">
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-5 top-5 z-[10030] flex items-center gap-2 rounded-2xl border border-blue-200/70 bg-white/90 px-3 py-2 text-xs text-slate-800 shadow-xl backdrop-blur-xl">
          <span className="font-semibold tracking-wide text-slate-800">Preview Workspace</span>
          <span className="h-4 w-px bg-slate-300" />
          <button
            type="button"
            onClick={showPanel}
            disabled={!hasPlan}
            className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={hasPlan ? 'Open before/after preview' : 'Generate a plan to preview'}
          >
            <Eye className="h-3.5 w-3.5" />
            {mode === 'panel' ? 'Preview Open' : 'Open Preview'}
          </button>
          <button
            type="button"
            onClick={() => void window.api.hidePreviewWorkspace()}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
