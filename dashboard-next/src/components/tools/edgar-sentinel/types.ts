export interface PipelineConfig {
  ingestion: IngestionConfig;
  analysis: AnalysisConfig;
  signals: SignalsConfig;
  backtest: BacktestConfig;
}

export interface IngestionConfig {
  tickers: string;
  formType: "10-K" | "10-Q" | "both";
  startYear: number;
  endYear: number;
}

export interface AnalysisConfig {
  dictionary: boolean;
  similarity: boolean;
  llm: boolean;
  llmModel: string;
}

export interface SignalsConfig {
  bufferDays: number;
  decayHalfLife: number;
  compositeMethod: "equal" | "ic_weighted" | "custom";
}

export type UniverseSource = "static" | "sp500_historical";

export interface BacktestConfig {
  rebalanceFrequency: "monthly" | "quarterly";
  numQuantiles: number;
  longQuantile: number;
  shortQuantile: number | null;
  transactionCostBps: number;
  universeSource: UniverseSource;
}

export type PipelineStage =
  | "idle"
  | "ingestion"
  | "analysis"
  | "signals"
  | "backtest"
  | "complete"
  | "failed";

export interface StageResult {
  stage: string;
  status: "pending" | "running" | "completed" | "failed";
  summary?: string;
  detail?: Record<string, unknown>;
  error?: string;
}

export interface EquityCurvePoint {
  date: string;
  portfolio: number;
  spy: number | null;
  equalWeight: number;
}

export interface PortfolioPosition {
  ticker: string;
  weight: number;
  quantile: number;
  signalScore: number;
  leg: "long" | "short";
  dollarValue: number;
}

export interface PortfolioSnapshot {
  rebalanceDate: string;
  portfolioValue: number;
  turnover: number;
  transactionCost: number;
  nLong: number;
  nShort: number;
  positions: PortfolioPosition[];
}

export interface SignalHistoryEntry {
  date: string;
  signals: Array<{ ticker: string; compositeScore: number; rank: number }>;
}

export interface BacktestResults {
  strategy: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    winRate: number;
    informationCoefficient: number;
  };
  benchmarks: {
    spy: { totalReturn: number; annualizedReturn: number; sharpeRatio: number };
    equalWeight: {
      totalReturn: number;
      annualizedReturn: number;
      sharpeRatio: number;
    };
  };
  monthlyReturns: Array<{
    month: string;
    strategy: number;
    spy: number;
    equalWeight: number;
  }>;
  signalRankings: Array<{
    ticker: string;
    compositeScore: number;
    rank: number;
  }>;
  equityCurve?: EquityCurvePoint[];
  portfolioHistory?: PortfolioSnapshot[];
  signalHistory?: SignalHistoryEntry[];
}

export interface PipelineJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  currentStage: PipelineStage;
  stages: StageResult[];
  results?: BacktestResults;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface DbStats {
  filings: number;
  filingSections: number;
  sentimentResults: number;
  similarityResults: number;
  individualSignals: number;
  compositeSignals: number;
  tickers: string[];
  dbPath: string;
  dbExists: boolean;
  error?: string;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  ingestion: {
    tickers: "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,UNH,V",
    formType: "both",
    startYear: 2024,
    endYear: 2026,
  },
  analysis: {
    dictionary: true,
    similarity: true,
    llm: false,
    llmModel: "claude-sonnet-4-6",
  },
  signals: {
    bufferDays: 2,
    decayHalfLife: 90,
    compositeMethod: "equal",
  },
  backtest: {
    rebalanceFrequency: "quarterly",
    numQuantiles: 5,
    longQuantile: 1,
    shortQuantile: null,
    transactionCostBps: 10,
    universeSource: "static" as UniverseSource,
  },
};
