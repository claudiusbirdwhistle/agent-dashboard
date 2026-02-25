/**
 * Tests for tool page components: ToolPage, RankingTable, StatCard, useToolSummary
 */
import React from "react";
import { render, screen, within, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock Next.js deps
jest.mock("next/navigation", () => ({
  usePathname: () => "/tools/sci-trends",
  useParams: () => ({ tool: "sci-trends" }),
}));

jest.mock("next/link", () => {
  const Link = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  Link.displayName = "Link";
  return Link;
});

// Import after mocks
import StatCard from "@/components/tools/StatCard";
import RankingTable from "@/components/tools/RankingTable";
import { useToolSummary } from "@/lib/hooks/useToolSummary";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Works" value="10.2M" />);
    expect(screen.getByText("Total Works")).toBeInTheDocument();
    expect(screen.getByText("10.2M")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<StatCard title="Growth" value="+5.1%" subtitle="5-year CAGR" />);
    expect(screen.getByText("5-year CAGR")).toBeInTheDocument();
  });

  it("applies positive color class for positive trend", () => {
    const { container } = render(<StatCard title="Growth" value="+5%" trend="positive" />);
    expect(container.querySelector(".text-emerald-400")).toBeTruthy();
  });

  it("applies negative color class for negative trend", () => {
    const { container } = render(<StatCard title="Decline" value="-3%" trend="negative" />);
    expect(container.querySelector(".text-red-400")).toBeTruthy();
  });
});

describe("RankingTable", () => {
  const columns = [
    { key: "name", label: "Field" },
    { key: "cagr_5y", label: "5yr CAGR", format: (v: number) => `${(v * 100).toFixed(1)}%` },
    { key: "works_2024", label: "Works 2024", format: (v: number) => v.toLocaleString() },
  ];

  const data = [
    { name: "Energy", cagr_5y: 0.0508, works_2024: 81601 },
    { name: "Computer Science", cagr_5y: 0.0239, works_2024: 676186 },
    { name: "Physics", cagr_5y: -0.0127, works_2024: 207692 },
  ];

  it("renders table headers", () => {
    render(<RankingTable columns={columns} data={data} />);
    expect(screen.getByText("Field")).toBeInTheDocument();
    expect(screen.getByText("5yr CAGR")).toBeInTheDocument();
    expect(screen.getByText("Works 2024")).toBeInTheDocument();
  });

  it("renders all data rows", () => {
    render(<RankingTable columns={columns} data={data} />);
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Physics")).toBeInTheDocument();
  });

  it("applies format functions to cell values", () => {
    render(<RankingTable columns={columns} data={data} />);
    expect(screen.getByText("5.1%")).toBeInTheDocument();
    expect(screen.getByText("81,601")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<RankingTable columns={columns} data={data} title="Top Fields by Growth" />);
    expect(screen.getByText("Top Fields by Growth")).toBeInTheDocument();
  });

  it("limits rows when maxRows is set", () => {
    render(<RankingTable columns={columns} data={data} maxRows={2} />);
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.queryByText("Physics")).not.toBeInTheDocument();
  });
});

describe("useToolSummary hook", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches from /api/<tool>/summary", async () => {
    const mockData = { fields: [], generated: "2026-01-01" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { result } = renderHook(() => useToolSummary("sci-trends"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/sci-trends/summary");
    expect(result.current.data).toEqual(mockData);
  });

  it("returns error state on fetch failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useToolSummary("bad-tool"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
