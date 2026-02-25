"use client";

import { useState } from "react";
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

  // If we have a path, fetch its tree
  const rootDir = segments.length > 0 ? ROOT_DIRS.find((d) => d.label === segments[0]) : null;
  const treePath = rootDir?.path ?? null;
  const { data: treeNodes, isLoading: treeLoading } = useFileTree(treePath ?? "");

  // Fetch selected file content
  const { data: fileData, isLoading: fileLoading } = useFile(selectedFile);

  // When user clicks a path segment that's a file, load it directly
  const isFilePath = absPath && segments.length > 1;

  function handleFileSelect(node: FileNode) {
    setSelectedFile(node.path);
  }

  // Root view: show the 5 directories
  if (segments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-zinc-100 mb-6">File Viewer</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {ROOT_DIRS.map((d) => (
            <a
              key={d.label}
              href={`/files/${d.label}`}
              className="flex flex-col items-center gap-2 p-6 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
            >
              <span className="text-2xl">📁</span>
              <span className="text-sm font-medium text-zinc-300">{d.label}</span>
              <span className="text-xs text-zinc-500 font-mono">{d.path}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Breadcrumbs segments={segments} />

      <div className="flex gap-6">
        {/* Sidebar: File tree */}
        <div className="w-64 shrink-0 border border-zinc-800 rounded-lg bg-zinc-900 p-3 overflow-auto max-h-[calc(100vh-12rem)]">
          {treeLoading ? (
            <p className="text-sm text-zinc-500">Loading tree…</p>
          ) : treeNodes && treeNodes.length > 0 ? (
            <FileTree nodes={treeNodes} onSelect={handleFileSelect} />
          ) : (
            <p className="text-sm text-zinc-500">Empty directory</p>
          )}
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
