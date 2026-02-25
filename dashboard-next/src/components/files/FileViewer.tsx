"use client";

import type { FileContent } from "@/lib/hooks/useFile";

const LANG_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".py": "python",
  ".sh": "bash",
  ".bash": "bash",
  ".md": "markdown",
  ".markdown": "markdown",
  ".css": "css",
  ".html": "html",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".sql": "sql",
  ".rs": "rust",
  ".go": "go",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileViewerProps {
  file: FileContent;
}

export default function FileViewer({ file }: FileViewerProps) {
  const lang = LANG_MAP[file.ext] ?? "plaintext";
  const isMarkdown = file.ext === ".md" || file.ext === ".markdown";

  return (
    <div className="flex flex-col gap-3">
      {/* File metadata bar */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="font-mono">{file.name}</span>
        <span>{formatSize(file.size)}</span>
        <span>{new Date(file.modified).toLocaleString()}</span>
        <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">{lang}</span>
      </div>

      {/* Rendered markdown */}
      {isMarkdown && file.html && (
        <div
          className="prose prose-invert prose-sm max-w-none border border-zinc-800 rounded p-4 bg-zinc-950"
          dangerouslySetInnerHTML={{ __html: file.html }}
        />
      )}

      {/* Source code */}
      <pre className="bg-zinc-950 border border-zinc-800 rounded p-4 overflow-auto text-sm leading-relaxed">
        <code className={`language-${lang} text-zinc-300`}>
          {file.content}
        </code>
      </pre>
    </div>
  );
}
