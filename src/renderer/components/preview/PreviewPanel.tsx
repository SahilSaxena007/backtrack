import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { ChevronRight, ChevronsDown, ChevronsUp, Shield, X } from 'lucide-react';
import { usePreviewStore } from '../../store/previewStore';
import { FolderTree, FileStatus, TreeNode } from './FolderTree';

const riskStyles: Record<string, string> = {
  safe: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  low: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  medium: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  high: 'bg-orange-500/15 text-orange-200 border-orange-400/30',
  critical: 'bg-red-500/15 text-red-200 border-red-400/30'
};

const formatDuration = (ms?: number) => {
  if (!ms || Number.isNaN(ms)) {
    return '—';
  }
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${seconds}s`;
};

type TreeBuildResult = {
  tree: TreeNode | null;
  folderPaths: string[];
};

const buildTreeFromPaths = (paths: string[], filePaths: Set<string>): TreeBuildResult => {
  const root: TreeNode = { name: '', path: '', type: 'folder', children: [] };
  const nodeMap = new Map<string, TreeNode>();

  const getOrCreateNode = (path: string, name: string, type: 'folder' | 'file') => {
    if (nodeMap.has(path)) {
      return nodeMap.get(path)!;
    }
    const node: TreeNode = { name, path, type, children: [] };
    nodeMap.set(path, node);
    return node;
  };

  for (const rawPath of paths) {
    if (!rawPath) {
      continue;
    }
    const normalized = rawPath.replace(/\//g, '\\');
    const parts = normalized.split('\\').filter(Boolean);
    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}\\${part}` : part;
      const isLast = index === parts.length - 1;
      const isFile = isLast && filePaths.has(currentPath);
      const type: 'folder' | 'file' = isFile ? 'file' : 'folder';
      let child = current.children.find((item) => item.path === currentPath);

      if (!child) {
        child = getOrCreateNode(currentPath, part, type);
        current.children.push(child);
      }
      current = child;
    });
  }

  const sortTree = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  };
  sortTree(root);

  const folderPaths = Array.from(nodeMap.values())
    .filter((node) => node.type === 'folder')
    .map((node) => node.path);

  return { tree: root, folderPaths };
};

const collectFilePaths = (paths: string[], fileCandidates: string[]) => {
  const fileSet = new Set<string>();
  for (const path of fileCandidates) {
    fileSet.add(path.replace(/\//g, '\\'));
  }
  for (const path of paths) {
    const normalized = path.replace(/\//g, '\\');
    if (normalized.includes('.')) {
      fileSet.add(normalized);
    }
  }
  return fileSet;
};

const badgeForAction = (actionType: string): FileStatus | undefined => {
  switch (actionType) {
    case 'create_folder':
      return 'NEW';
    case 'move_file':
    case 'move_files_batch':
      return 'MOVED';
    case 'rename_file':
      return 'RENAMED';
    default:
      return undefined;
  }
};

export function PreviewPanel() {
  const {
    mode,
    plan,
    expandedFolders,
    showButton,
    approvePlan,
    modifyPlan,
    cancelPlan,
    toggleFolder,
    expandAll,
    collapseAll
  } = usePreviewStore();
  const risk = plan?.safety_analysis?.overall_risk ?? 'low';

  useEffect(() => {
    if (mode !== 'panel') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        showButton();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, showButton]);

  const { beforeTree, afterTree, folderPaths, statusMap } = useMemo(() => {
    if (!plan) {
      return {
        beforeTree: null,
        afterTree: null,
        folderPaths: [],
        statusMap: {} as Record<string, FileStatus>
      };
    }

    const beforePaths: string[] = [];
    const afterPaths: string[] = [];
    const fileCandidates: string[] = [];
    const status: Record<string, FileStatus> = {};

    for (const action of plan.actions) {
      const params = action.params ?? {};
      const actionStatus = badgeForAction(action.type);

      if (params.source) {
        beforePaths.push(params.source);
        if (Array.isArray(params.files)) {
          for (const file of params.files) {
            const fullPath = `${params.source}\\${file}`;
            beforePaths.push(fullPath);
            fileCandidates.push(fullPath);
          }
        } else {
          fileCandidates.push(params.source);
        }
      }

      if (params.path) {
        afterPaths.push(params.path);
        if (actionStatus) {
          status[params.path] = actionStatus;
        }
      }

      if (params.destination) {
        afterPaths.push(params.destination);
        if (Array.isArray(params.files)) {
          for (const file of params.files) {
            const fullPath = `${params.destination}\\${file}`;
            afterPaths.push(fullPath);
            fileCandidates.push(fullPath);
            if (actionStatus) {
              status[fullPath] = actionStatus;
            }
          }
        } else {
          fileCandidates.push(params.destination);
          if (actionStatus) {
            status[params.destination] = actionStatus;
          }
        }
      }

      if (action.type === 'rename_file') {
        const basePath = params.path?.replace(/\\[^\\]+$/, '') ?? '';
        const newName = params.new_name ?? params.newName ?? params.new_path?.split('\\').pop();
        if (basePath && newName) {
          const newPath = `${basePath}\\${newName}`;
          afterPaths.push(newPath);
          fileCandidates.push(newPath);
          status[newPath] = 'RENAMED';
        }
      }
    }

    const beforeFileSet = collectFilePaths(beforePaths, fileCandidates);
    const afterFileSet = collectFilePaths(afterPaths, fileCandidates);

    const beforeBuild = buildTreeFromPaths(beforePaths, beforeFileSet);
    const afterBuild = buildTreeFromPaths(afterPaths, afterFileSet);

    return {
      beforeTree: beforeBuild.tree,
      afterTree: afterBuild.tree,
      folderPaths: Array.from(new Set([...beforeBuild.folderPaths, ...afterBuild.folderPaths])),
      statusMap: status
    };
  }, [plan]);

  const stats = useMemo(() => {
    if (!plan) {
      return null;
    }
    return [
      { label: 'Files', value: plan.summary.files_affected },
      { label: 'Folders', value: plan.summary.folders_created },
      { label: 'Actions', value: plan.summary.total_actions },
      { label: 'Time', value: formatDuration(plan.gemini_metadata?.total_time_ms) }
    ];
  }, [plan]);

  return (
    <AnimatePresence>
      {mode === 'panel' && plan && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={showButton}
        >
          <motion.div
            className="flex h-[92vh] w-[95vw] max-w-[95vw] flex-col rounded-2xl border border-white/10 bg-[#080a0f] text-white shadow-[0_40px_120px_rgba(2,6,23,0.8)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-slate-400">Preview</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
                <span className="text-slate-100">Review changes</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => expandAll(folderPaths)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:text-slate-200"
                >
                  <ChevronsDown className="h-3.5 w-3.5" />
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:text-slate-200"
                >
                  <ChevronsUp className="h-3.5 w-3.5" />
                  Collapse All
                </button>
                <span className="h-4 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={showButton}
                  className="rounded-full border border-white/10 p-1 text-slate-300 transition hover:bg-white/10"
                  aria-label="Close preview panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-4 px-6 py-4">
              <div className="grid flex-1 grid-cols-2 gap-4">
                <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#111318]/80 backdrop-blur">
                  <div className="border-b border-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Before</p>
                    <p className="text-xs text-slate-400">Current State</p>
                  </div>
                  <div className="flex-1 px-2 py-3">
                    <FolderTree
                      tree={beforeTree}
                      expandedFolders={expandedFolders}
                      onToggle={toggleFolder}
                    />
                  </div>
                </div>

                <div className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-[#111318]/80 backdrop-blur">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-500/50 via-indigo-400/70 to-transparent" />
                  <div className="border-b border-white/5 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-indigo-300">After</p>
                    <p className="text-xs text-slate-400">Proposed State</p>
                  </div>
                  <div className="flex-1 px-2 py-3">
                    <FolderTree
                      tree={afterTree}
                      expandedFolders={expandedFolders}
                      onToggle={toggleFolder}
                      statusMap={statusMap}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 bg-[#080a0f] py-3">
                <div className="flex flex-1 items-center">
                  {stats?.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`flex flex-col px-4 ${index !== 0 ? 'border-l border-white/5' : ''}`}
                    >
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                        {stat.label}
                      </span>
                      <span className="text-lg font-semibold text-slate-100">{stat.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    <Shield className="h-3.5 w-3.5" />
                    Undo available for 24h
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${riskStyles[risk] ?? riskStyles.low}`}
                  >
                    {risk} risk
                  </span>
                  <button
                    type="button"
                    onClick={cancelPlan}
                    className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={modifyPlan}
                    className="rounded-xl border border-white/10 bg-[#111318] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/5"
                  >
                    Modify
                  </button>
                  <button
                    type="button"
                    onClick={approvePlan}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(16,185,129,0.45)] transition hover:from-emerald-500 hover:to-emerald-400"
                  >
                    Approve &amp; Execute
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
