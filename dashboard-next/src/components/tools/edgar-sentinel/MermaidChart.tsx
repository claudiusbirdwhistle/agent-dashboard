"use client";

import { useEffect, useRef, useId } from "react";

interface MermaidChartProps {
  chart: string;
  className?: string;
}

export default function MermaidChart({ chart, className }: MermaidChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#3f3f46",
          primaryTextColor: "#e4e4e7",
          primaryBorderColor: "#52525b",
          lineColor: "#71717a",
          secondaryColor: "#27272a",
          tertiaryColor: "#18181b",
          fontFamily: "ui-monospace, monospace",
          fontSize: "14px",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 12,
        },
      });

      if (cancelled || !containerRef.current) return;

      try {
        const { svg } = await mermaid.render(`mermaid-${uniqueId}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML =
            '<p class="text-red-400 text-sm">Failed to render diagram</p>';
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart, uniqueId]);

  return <div ref={containerRef} className={className} />;
}
