import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  File,
  FileArchive,
  FileCode,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Music,
  Folder
} from 'lucide-react';
import { useMemo } from 'react';

export type FileStatus = 'NEW' | 'MOVED' | 'RENAMED' | 'DELETED';

export type TreeNode = {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: TreeNode[];
};

interface FolderTreeProps {
  tree: TreeNode | null;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  statusMap?: Record<string, FileStatus>;
}

const statusStyles: Record<FileStatus, string> = {
  NEW: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  MOVED: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  RENAMED: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  DELETED: 'bg-red-500/20 text-red-200 border-red-400/30'
};

const fileIconFor = (name: string) => {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return ImageIcon;
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return FileVideo;
  }
  if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
    return Music;
  }
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(ext)) {
    return FileText;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return FileArchive;
  }
  if (['js', 'ts', 'tsx', 'json', 'md', 'html', 'css', 'yml', 'yaml'].includes(ext)) {
    return FileCode;
  }
  return File;
};

const TreeRow = ({
  node,
  depth,
  expandedFolders,
  onToggle,
  statusMap
}: {
  node: TreeNode;
  depth: number;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  statusMap?: Record<string, FileStatus>;
}) => {
  const isFolder = node.type === 'folder';
  const isExpanded = depth < 1 || expandedFolders.has(node.path);
  const Icon = isFolder ? Folder : fileIconFor(node.name);
  const status = statusMap?.[node.path];

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => isFolder && onToggle(node.path)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-slate-200 transition hover:bg-white/5"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {isFolder ? (
          <ChevronRight
            className={`h-3 w-3 text-slate-400 transition ${isExpanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="h-3 w-3" />
        )}
        <Icon className="h-3.5 w-3.5 text-slate-300" />
        <span className="flex-1 truncate text-slate-100">{node.name}</span>
        {status && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[status]}`}>
            {status}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isFolder && isExpanded && node.children.length > 0 && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="space-y-1">
              {node.children.map((child) => (
                <TreeRow
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  expandedFolders={expandedFolders}
                  onToggle={onToggle}
                  statusMap={statusMap}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export function FolderTree({ tree, expandedFolders, onToggle, statusMap }: FolderTreeProps) {
  const rootChildren = useMemo(() => tree?.children ?? [], [tree]);

  if (!tree || rootChildren.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        No files to display.
      </div>
    );
  }

  return (
    <div className="h-full space-y-1 overflow-y-auto pr-2 scrollbar-dark">
      {rootChildren.map((child) => (
        <TreeRow
          key={child.path}
          node={child}
          depth={0}
          expandedFolders={expandedFolders}
          onToggle={onToggle}
          statusMap={statusMap}
        />
      ))}
    </div>
  );
}
