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

export type UniverseSource = "static" | "sp500_historical" | "sp100_historical" | "sp50_historical";

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
  | "validation"
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

// --- Signal Validation Result Types ---

export interface ValidationTestResult {
  beta?: number;
  t_stat?: number;
  p_value?: number;
  r_squared?: number;
  n_obs?: number;
  mean_ic?: number;
  ic_std?: number;
  ir?: number;
  pct_positive?: number;
  n_periods?: number;
  mean_coefficient?: number;
  fm_t_stat?: number;
  test_statistic?: number;
  bucket_means?: Record<string, number>;
  spread_mean?: number;
  spread_t_stat?: number;
  spread_p_value?: number;
  spread_sharpe?: number;
  jt_statistic?: number;
  jt_p_value?: number;
  oos_r_squared?: number;
  directional_hit_rate?: number;
  oos_sharpe?: number;
  is_r_squared?: number;
  overfit_flag?: boolean;
  n_test_obs?: number;
  n_windows?: number;
}

export interface MultipleTestingRow {
  test_name: string;
  original_p_value: number;
  adjusted_p_value: number;
  rejected: boolean;
}

export interface SignalValidationResults {
  skipped?: boolean;
  error?: string;
  summary_text?: string;
  ols_results?: Record<string, ValidationTestResult>;
  ic_results?: Record<string, ValidationTestResult>;
  portfolio_sort_results?: Record<string, ValidationTestResult>;
  fama_macbeth_results?: Record<string, ValidationTestResult>;
  granger_results?: Record<string, ValidationTestResult>;
  subgroup_results?: Record<string, Record<string, ValidationTestResult>>;
  placebo_results?: Record<string, unknown>;
  multiple_testing_table?: MultipleTestingRow[];
  oos_results?: Record<string, ValidationTestResult>;
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
  signalValidation?: SignalValidationResults;
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
