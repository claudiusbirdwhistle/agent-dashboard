"use client";

import { useState } from "react";
import type { FileNode } from "@/types";

interface FileTreeProps {
  nodes: FileNode[];
  onSelect: (node: FileNode) => void;
  depth?: number;
}

function FileTreeNode({
  node,
  onSelect,
  depth,
}: {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDir = node.type === "directory";

  function handleClick() {
    if (isDir) {
      setExpanded((prev) => !prev);
    } else {
      onSelect(node);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-sm rounded transition-colors ${
          isDir
            ? "text-zinc-300 hover:bg-zinc-800"
            : "text-zinc-400 hover:text-white hover:bg-zinc-800"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="shrink-0 text-xs w-4 text-center">
          {isDir ? (expanded ? "▾" : "▸") : "·"}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && node.children && (
        <FileTree nodes={node.children} onSelect={onSelect} depth={depth + 1} />
      )}
    </li>
  );
}

export default function FileTree({ nodes, onSelect, depth = 0 }: FileTreeProps) {
  return (
    <ul className="list-none m-0 p-0">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </ul>
  );
}
