"use client";

import type { PipelineConfig, UniverseSource } from "./types";

interface PipelineParamsProps {
  config: PipelineConfig;
  onChange: (config: PipelineConfig) => void;
  disabled?: boolean;
}

const TICKER_PRESETS: Record<string, string> = {
  "SP10": "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,UNH,V",
  "SP50": "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,UNH,V,XOM,LLY,AVGO,JNJ,WMT,MA,PG,HD,ORCL,CVX,MRK,ABBV,KO,BAC,PEP,COST,NFLX,TMO,CRM,MCD,ACN,ABT,WFC,IBM,CSCO,LIN,ADBE,PM,TXN,NOW,GE,QCOM,AMD,MS,RTX,SPGI,DHR,NEE,HON,AMGN",
  "SP100": "AAPL,MSFT,GOOGL,AMZN,META,NVDA,TSLA,JPM,UNH,V,XOM,LLY,AVGO,JNJ,WMT,MA,PG,HD,ORCL,CVX,MRK,ABBV,KO,BAC,PEP,COST,NFLX,TMO,CRM,MCD,ACN,ABT,WFC,IBM,CSCO,LIN,ADBE,PM,TXN,NOW,GE,QCOM,AMD,MS,RTX,SPGI,DHR,NEE,HON,AMGN,BX,ISRG,GS,UNP,BMY,DE,T,BKNG,PLD,SYK,VRTX,C,MDT,ETN,AXP,MMC,GILD,SO,REGN,CB,CMG,ANET,ZTS,BDX,CI,TJX,MO,SHW,DUK,ITW,BSX,AON,PGR,FI,SCHW,EQIX,FCX,EMR,MCO,APD,CL,PANW,KLAC,HCA,NSC,GD,AIG",
  "FAANG+": "AAPL,AMZN,GOOGL,META,MSFT,NFLX,NVDA,TSLA",
  "Financials": "JPM,BAC,GS,MS,WFC,C,BLK,SCHW",
  "Tech": "AAPL,MSFT,GOOGL,AMZN,META,NVDA,CRM,ORCL,ADBE,INTC",
};

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg p-4 ${color}`}>
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-400">{text}</span>
      {hint && <span className="text-[10px] text-zinc-600 ml-1">({hint})</span>}
    </label>
  );
}

export default function PipelineParams({
  config,
  onChange,
  disabled,
}: PipelineParamsProps) {
  const update = <K extends keyof PipelineConfig>(
    section: K,
    patch: Partial<PipelineConfig[K]>,
  ) => {
    onChange({
      ...config,
      [section]: { ...config[section], ...patch },
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Ingestion */}
      <Section title="1. Ingestion" color="border-blue-800 bg-blue-950/30">
        <div>
          <Label text="Tickers" hint="comma-separated" />
          <textarea
            value={config.ingestion.tickers}
            onChange={(e) => update("ingestion", { tickers: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono disabled:opacity-50"
          />
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {Object.entries(TICKER_PRESETS).map(([name, tickers]) => (
              <button
                key={name}
                onClick={() => update("ingestion", { tickers })}
                disabled={disabled}
                className="px-2 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded border border-zinc-700 disabled:opacity-50"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label text="Form Type" />
            <select
              value={config.ingestion.formType}
              onChange={(e) =>
                update("ingestion", {
                  formType: e.target.value as "10-K" | "10-Q" | "both",
                })
              }
              disabled={disabled}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            >
              <option value="both">Both</option>
              <option value="10-K">10-K</option>
              <option value="10-Q">10-Q</option>
            </select>
          </div>
          <div>
            <Label text="Start Year" />
            <input
              type="number"
              value={config.ingestion.startYear}
              onChange={(e) =>
                update("ingestion", { startYear: parseInt(e.target.value) || 2020 })
              }
              disabled={disabled}
              min={2000}
              max={2026}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            />
          </div>
          <div>
            <Label text="End Year" />
            <input
              type="number"
              value={config.ingestion.endYear}
              onChange={(e) =>
                update("ingestion", { endYear: parseInt(e.target.value) || 2026 })
              }
              disabled={disabled}
              min={2000}
              max={2026}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            />
          </div>
        </div>
      </Section>

      {/* Analysis */}
      <Section title="2. Analysis" color="border-purple-800 bg-purple-950/30">
        <div className="flex flex-col gap-2">
          <Label text="Analyzers" />
          {(["dictionary", "similarity", "llm"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.analysis[key]}
                onChange={(e) => update("analysis", { [key]: e.target.checked })}
                disabled={disabled}
                className="rounded border-zinc-600 bg-zinc-800 text-purple-500"
              />
              <span className="text-xs text-zinc-300 capitalize">
                {key === "llm" ? "LLM (Claude)" : key === "dictionary" ? "Dictionary (Loughran-McDonald)" : "Similarity (TF-IDF Cosine)"}
              </span>
            </label>
          ))}
        </div>
        {config.analysis.llm && (
          <div>
            <Label text="LLM Model" />
            <select
              value={config.analysis.llmModel}
              onChange={(e) => update("analysis", { llmModel: e.target.value })}
              disabled={disabled}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
            </select>
          </div>
        )}
      </Section>

      {/* Signals */}
      <Section title="3. Signal Generation" color="border-green-800 bg-green-950/30">
        <div>
          <Label text="Signal Buffer" hint="days after filing" />
          <input
            type="number"
            value={config.signals.bufferDays}
            onChange={(e) =>
              update("signals", { bufferDays: parseInt(e.target.value) || 2 })
            }
            disabled={disabled}
            min={0}
            max={30}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
          />
        </div>
        <div>
          <div className="flex justify-between">
            <Label text="Decay Half-Life" hint="days" />
            <span className="text-xs text-zinc-500">{config.signals.decayHalfLife}d</span>
          </div>
          <input
            type="range"
            value={config.signals.decayHalfLife}
            onChange={(e) =>
              update("signals", { decayHalfLife: parseInt(e.target.value) })
            }
            disabled={disabled}
            min={7}
            max={365}
            step={1}
            className="w-full mt-1 accent-green-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>7d</span>
            <span>90d</span>
            <span>180d</span>
            <span>365d</span>
          </div>
        </div>
        <div>
          <Label text="Composite Method" />
          <select
            value={config.signals.compositeMethod}
            onChange={(e) =>
              update("signals", {
                compositeMethod: e.target.value as "equal" | "ic_weighted" | "custom",
              })
            }
            disabled={disabled}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
          >
            <option value="equal">Equal Weight</option>
            <option value="ic_weighted">IC-Weighted</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </Section>

      {/* Backtest */}
      <Section title="4. Backtest" color="border-amber-800 bg-amber-950/30">
        <div>
          <Label text="Universe Source" hint="survivorship bias control" />
          <select
            value={config.backtest.universeSource}
            onChange={(e) =>
              update("backtest", {
                universeSource: e.target.value as UniverseSource,
              })
            }
            disabled={disabled}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
          >
            <option value="static">Static (tickers as entered above)</option>
            <option value="sp500_historical">Historical S&amp;P 500 — fully survivorship-free</option>
            <option value="sp100_historical">Historical S&amp;P 100 — approx. survivorship-free</option>
            <option value="sp50_historical">Historical S&amp;P 50 — approx. survivorship-free</option>
          </select>
          {config.backtest.universeSource === "sp500_historical" && (
            <p className="text-[10px] text-amber-400 mt-1">
              Uses point-in-time S&amp;P 500 membership data — only tickers that were
              actually in the index on each rebalance date will be included.
              Data downloaded from github.com/fja05680/sp500 on first use.
            </p>
          )}
          {(config.backtest.universeSource === "sp100_historical" || config.backtest.universeSource === "sp50_historical") && (
            <p className="text-[10px] text-amber-400 mt-1">
              Uses point-in-time SP500 data filtered to a curated{" "}
              {config.backtest.universeSource === "sp100_historical" ? "S&amp;P 100" : "S&amp;P 50"}{" "}
              reference set. Approximately survivorship-free — prevents including
              companies never in the SP500, with minor bias from ~5–10 historical
              members not in current composition.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label text="Rebalance" />
            <select
              value={config.backtest.rebalanceFrequency}
              onChange={(e) =>
                update("backtest", {
                  rebalanceFrequency: e.target.value as "monthly" | "quarterly",
                })
              }
              disabled={disabled}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            >
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <Label text="Quantiles" />
            <input
              type="number"
              value={config.backtest.numQuantiles}
              onChange={(e) =>
                update("backtest", {
                  numQuantiles: parseInt(e.target.value) || 5,
                })
              }
              disabled={disabled}
              min={2}
              max={10}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label text="Long Quantile" hint="1=best" />
            <input
              type="number"
              value={config.backtest.longQuantile}
              onChange={(e) =>
                update("backtest", {
                  longQuantile: parseInt(e.target.value) || 1,
                })
              }
              disabled={disabled}
              min={1}
              max={config.backtest.numQuantiles}
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50"
            />
          </div>
          <div>
            <Label text="Short Quantile" hint="optional" />
            <input
              type="number"
              value={config.backtest.shortQuantile ?? ""}
              onChange={(e) =>
                update("backtest", {
                  shortQuantile: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              disabled={disabled}
              min={1}
              max={config.backtest.numQuantiles}
              placeholder="None"
              className="w-full mt-1 px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-200 disabled:opacity-50 placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <Label text="Transaction Cost" hint="bps" />
            <span className="text-xs text-zinc-500">{config.backtest.transactionCostBps} bps</span>
          </div>
          <input
            type="range"
            value={config.backtest.transactionCostBps}
            onChange={(e) =>
              update("backtest", {
                transactionCostBps: parseInt(e.target.value),
              })
            }
            disabled={disabled}
            min={0}
            max={50}
            step={1}
            className="w-full mt-1 accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>0</span>
            <span>10</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
