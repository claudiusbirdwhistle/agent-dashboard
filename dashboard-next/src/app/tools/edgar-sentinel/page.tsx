"use client";

import { useState } from "react";
import MermaidChart from "@/components/tools/edgar-sentinel/MermaidChart";
import PipelineParams from "@/components/tools/edgar-sentinel/PipelineParams";
import StageProgress from "@/components/tools/edgar-sentinel/StageProgress";
import BacktestResultsView from "@/components/tools/edgar-sentinel/BacktestResultsView";
import DbStatsPanel from "@/components/tools/edgar-sentinel/DbStatsPanel";
import { DEFAULT_CONFIG } from "@/components/tools/edgar-sentinel/types";
import type { PipelineConfig } from "@/components/tools/edgar-sentinel/types";
import {
  useEdgarSentinelJob,
  useStartPipeline,
  useCancelJob,
  useDbStats,
} from "@/lib/hooks/useEdgarSentinel";

const PIPELINE_CHART = `flowchart LR
  subgraph ing["1. Ingestion"]
    direction TB
    EDGAR["SEC EDGAR API"]
    FETCH["Fetch Filings"]
    PARSE["Parse Sections"]
    STORE["SQLite Store"]
    EDGAR --> FETCH --> PARSE --> STORE
  end

  subgraph ana["2. Analysis"]
    direction TB
    DICT["Dictionary\\n(Loughran-McDonald)"]
    SIM["Similarity\\n(TF-IDF Cosine)"]
    LLM["LLM\\n(Claude)"]
    SENT["Sentiment +\\nSimilarity Results"]
    DICT --> SENT
    SIM --> SENT
    LLM --> SENT
  end

  subgraph sig["3. Signals"]
    direction TB
    NORM["Z-Score\\nNormalization"]
    DECAY["Exponential\\nTime Decay"]
    COMP["Composite\\nEnsemble"]
    NORM --> DECAY --> COMP
  end

  subgraph bt["4. Backtest"]
    direction TB
    PORT["Portfolio\\nConstruction"]
    RET["Returns\\n(Yahoo Finance)"]
    METRICS["Sharpe, Sortino\\nDrawdown, IC"]
    PORT --> RET --> METRICS
  end

  ing --> ana --> sig --> bt

  style ing fill:#172554,stroke:#1e40af,color:#93c5fd
  style ana fill:#2e1065,stroke:#6b21a8,color:#c4b5fd
  style sig fill:#052e16,stroke:#15803d,color:#86efac
  style bt fill:#451a03,stroke:#b45309,color:#fcd34d`;

export default function EdgarSentinelPage() {
  const [config, setConfig] = useState<PipelineConfig>(DEFAULT_CONFIG);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { data: job } = useEdgarSentinelJob(activeJobId);
  const { data: dbStats, isLoading: isDbStatsLoading } = useDbStats();
  const startMutation = useStartPipeline();
  const cancelMutation = useCancelJob();

  const isRunning = job?.status === "running" || job?.status === "pending";

  const handleRun = async () => {
    try {
      const { jobId } = await startMutation.mutateAsync(config);
      setActiveJobId(jobId);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleCancel = async () => {
    if (!activeJobId) return;
    try {
      await cancelMutation.mutateAsync(activeJobId);
    } catch {
      // Error handled by mutation state
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">EDGAR Sentinel</h1>
        <p className="text-sm text-zinc-400 mt-1">
          SEC filing sentiment analysis pipeline — configure parameters, run
          the full pipeline, and view backtest results with benchmark
          comparisons.
        </p>
      </div>

      {/* Mermaid Flowchart */}
      <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          Data Flow Pipeline
        </h2>
        <MermaidChart
          chart={PIPELINE_CHART}
          className="w-full overflow-x-auto [&>svg]:mx-auto"
        />
      </div>

      {/* Database Stats */}
      <DbStatsPanel stats={dbStats} isLoading={isDbStatsLoading} />

      {/* Parameters */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          Pipeline Configuration
        </h2>
        <PipelineParams
          config={config}
          onChange={setConfig}
          disabled={isRunning}
        />
      </div>

      {/* Run / Cancel Controls */}
      <div className="flex items-center gap-3">
        {!isRunning ? (
          <button
            onClick={handleRun}
            disabled={startMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {startMutation.isPending ? "Starting..." : "Run Pipeline"}
          </button>
        ) : (
          <button
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel"}
          </button>
        )}
        {startMutation.isError && (
          <p className="text-xs text-red-400">
            {startMutation.error.message}
          </p>
        )}
        {job?.status === "completed" && (
          <span className="text-xs text-emerald-400 font-medium">
            Pipeline completed
          </span>
        )}
        {job?.status === "failed" && (
          <span className="text-xs text-red-400 font-medium">
            Pipeline failed{job.error ? `: ${job.error}` : ""}
          </span>
        )}
      </div>

      {/* Stage Progress */}
      {job && <StageProgress stages={job.stages} />}

      {/* Results */}
      {job?.status === "completed" && job.results && (
        <BacktestResultsView results={job.results} />
      )}
    </div>
  );
}
