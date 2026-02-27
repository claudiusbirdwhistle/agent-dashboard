"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useFileTree } from "@/lib/hooks/useFileTree";
import { useFile } from "@/lib/hooks/useFile";
import type { FileContent } from "@/lib/hooks/useFile";
import type { FileNode } from "@/types";
import FileTree from "@/components/files/FileTree";
import FileViewer from "@/components/files/FileViewer";
import Breadcrumbs from "@/components/files/Breadcrumbs";

const ROOT_DIRS = [
  { label: "output", path: "/output" },
  { label: "state", path: "/state" },
  { label: "tools", path: "/tools" },
  { label: "agent", path: "/agent" },
  { label: "logs", path: "/var/log/agent" },
];

function resolveAbsolutePath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  const root = segments[0];
  const dir = ROOT_DIRS.find((d) => d.label === root);
  if (!dir) return null;
  if (segments.length === 1) return dir.path;
  return dir.path + "/" + segments.slice(1).join("/");
}

export default function FilesPage() {
  const params = useParams<{ path?: string[] }>();
  const segments = params.path ?? [];
  const absPath = resolveAbsolutePath(segments);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);

  // If we have a path, fetch its tree
  const rootDir = segments.length > 0 ? ROOT_DIRS.find((d) => d.label === segments[0]) : null;
  const treePath = rootDir?.path ?? null;
  const { data: treeNodes, isLoading: treeLoading } = useFileTree(treePath ?? "");

  // Fetch selected file content
  const { data: fileData, isLoading: fileLoading } = useFile(selectedFile);

  // When user clicks a path segment that's a file, load it directly
  const isFilePath = absPath && segments.length > 1;

  const handleFileSelect = useCallback((node: FileNode) => {
    setSelectedFile(node.path);
    setTreeOpen(false); // collapse tree on mobile after selection
  }, []);

  // Root view: show the 5 directories
  if (segments.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-zinc-100 mb-6">File Viewer</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {ROOT_DIRS.map((d) => (
            <a
              key={d.label}
              href={`/files/${d.label}`}
              className="flex flex-col items-center gap-2 p-4 sm:p-6 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 transition-colors min-h-[80px]"
            >
              <span className="text-2xl">📁</span>
              <span className="text-sm font-medium text-zinc-300">{d.label}</span>
              <span className="text-[10px] sm:text-xs text-zinc-500 font-mono truncate max-w-full">{d.path}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Breadcrumbs segments={segments} />

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* File tree — collapsible on mobile */}
        <div className="md:w-64 md:shrink-0">
          <button
            type="button"
            onClick={() => setTreeOpen((v) => !v)}
            className="md:hidden w-full flex items-center justify-between px-3 py-2.5 mb-2 rounded border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 font-medium min-h-[44px]"
          >
            <span>File Tree</span>
            <span className={`text-xs text-zinc-500 transition-transform duration-150 ${treeOpen ? "rotate-90" : ""}`}>
              ▶
            </span>
          </button>
          <div className={`border border-zinc-800 rounded-lg bg-zinc-900 p-3 overflow-auto md:max-h-[calc(100vh-12rem)] ${treeOpen ? "max-h-72" : "hidden md:block md:max-h-[calc(100vh-12rem)]"}`}>
            {treeLoading ? (
              <p className="text-sm text-zinc-500">Loading tree…</p>
            ) : treeNodes && treeNodes.length > 0 ? (
              <FileTree nodes={treeNodes} onSelect={handleFileSelect} />
            ) : (
              <p className="text-sm text-zinc-500">Empty directory</p>
            )}
          </div>
        </div>

        {/* Main: File content */}
        <div className="flex-1 min-w-0">
          {fileLoading ? (
            <p className="text-sm text-zinc-500">Loading file…</p>
          ) : fileData ? (
            <FileViewer file={fileData as FileContent} />
          ) : isFilePath ? (
            <FileAutoLoad path={absPath!} />
          ) : (
            <div className="flex items-center justify-center h-64 border border-zinc-800 rounded-lg bg-zinc-900">
              <p className="text-sm text-zinc-500">
                Select a file from the tree to view its contents
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Auto-loads a file when navigated to via URL (e.g. /files/state/dev-objectives.json) */
function FileAutoLoad({ path }: { path: string }) {
  const { data, isLoading } = useFile(path);

  if (isLoading) {
    return <p className="text-sm text-zinc-500">Loading file…</p>;
  }
  if (!data) {
    return <p className="text-sm text-zinc-500">File not found</p>;
  }
  if (data.type === "file") {
    return <FileViewer file={data as FileContent} />;
  }
  return <p className="text-sm text-zinc-500">This is a directory. Use the tree to navigate.</p>;
}
