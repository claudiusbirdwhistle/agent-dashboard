/**
 * Tests for Shell layout components: Shell, Sidebar, Header
 */
import React from "react";
import { render, screen } from "@testing-library/react";

// Minimal mock to avoid Next.js routing deps in tests
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

jest.mock("next/link", () => {
  const Link = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

// Mock hooks used inside Sidebar
jest.mock("@/lib/hooks/useTasks", () => ({
  useTasks: () => ({
    data: {
      tasks: [
        {
          id: "dir-1",
          text: "Focus on testing",
          source: "user",
          type: "focus",
          priority: "urgent",
          status: "pending",
          created_at: new Date().toISOString(),
          acknowledged_at: null,
          completed_at: null,
          agent_notes: null,
          is_current: false,
        },
      ],
      activeObjectiveId: null,
      currentDirectiveId: null,
    },
  }),
}));

jest.mock("@/lib/hooks/useRateLimits", () => ({
  useRateLimits: () => ({
    data: { type: "seven_day", utilization: 0.84, status: "allowed_warning", resetsAt: null, isUsingOverage: false, surpassedThreshold: 0.75 },
  }),
}));

jest.mock("@/lib/hooks/useStatus", () => ({
  useStatus: () => ({
    data: {
      enabled: true,
      processStatus: "running",
      phase: "dashboard-next",
      totalInvocations: 12,
      stallCount: 0,
      activeObjectives: 1,
      diskUsage: null,
    },
  }),
  useToggleAgent: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Shell from "@/components/layout/Shell";

describe("Sidebar", () => {
  it("renders navigation links", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  it("shows pending directives section", () => {
    render(<Sidebar />);
    expect(screen.getByText(/Focus on testing/i)).toBeInTheDocument();
  });
});

describe("Header", () => {
  it("renders the dashboard title", () => {
    render(<Header />);
    expect(screen.getByText(/Agent Dashboard/i)).toBeInTheDocument();
  });

  it("renders agent status from useStatus hook", () => {
    render(<Header />);
    // Should show invocations count
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });
});

describe("Shell", () => {
  it("renders children inside the shell layout", () => {
    render(
      <Shell>
        <div>Main content</div>
      </Shell>
    );
    expect(screen.getByText("Main content")).toBeInTheDocument();
  });

  it("renders sidebar inside shell", () => {
    render(
      <Shell>
        <div>content</div>
      </Shell>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
