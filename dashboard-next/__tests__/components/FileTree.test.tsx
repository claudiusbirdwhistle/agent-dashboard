/**
 * @jest-environment jsdom
 *
 * Component tests for FileTree (expand/collapse, renders dirs and files).
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FileTree from "@/components/files/FileTree";
import type { FileNode } from "@/types";

const TREE: FileNode[] = [
  {
    name: "output",
    path: "/output",
    type: "directory",
    children: [
      { name: "report.md", path: "/output/report.md", type: "file" },
      {
        name: "summaries",
        path: "/output/summaries",
        type: "directory",
        children: [
          {
            name: "summary.json",
            path: "/output/summaries/summary.json",
            type: "file",
          },
        ],
      },
    ],
  },
  { name: "README.md", path: "/output/README.md", type: "file" },
];

describe("FileTree component", () => {
  it("renders top-level entries", () => {
    render(<FileTree nodes={TREE} onSelect={jest.fn()} />);
    expect(screen.getByText("output")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });

  it("does not render children before directory is expanded", () => {
    render(<FileTree nodes={TREE} onSelect={jest.fn()} />);
    // report.md is inside output/ which is collapsed by default
    expect(screen.queryByText("report.md")).not.toBeInTheDocument();
  });

  it("expands a directory on click to show children", () => {
    render(<FileTree nodes={TREE} onSelect={jest.fn()} />);
    fireEvent.click(screen.getByText("output"));
    expect(screen.getByText("report.md")).toBeInTheDocument();
    expect(screen.getByText("summaries")).toBeInTheDocument();
  });

  it("collapses an expanded directory on second click", () => {
    render(<FileTree nodes={TREE} onSelect={jest.fn()} />);
    fireEvent.click(screen.getByText("output"));
    expect(screen.getByText("report.md")).toBeInTheDocument();
    fireEvent.click(screen.getByText("output"));
    expect(screen.queryByText("report.md")).not.toBeInTheDocument();
  });

  it("calls onSelect with the file node when a file is clicked", () => {
    const onSelect = jest.fn();
    render(<FileTree nodes={TREE} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("README.md"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "README.md", type: "file" })
    );
  });

  it("does not call onSelect when a directory is clicked (directories expand)", () => {
    const onSelect = jest.fn();
    render(<FileTree nodes={TREE} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("output"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders nested children after expanding parent then child", () => {
    const onSelect = jest.fn();
    render(<FileTree nodes={TREE} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("output"));
    fireEvent.click(screen.getByText("summaries"));
    expect(screen.getByText("summary.json")).toBeInTheDocument();
  });
});
