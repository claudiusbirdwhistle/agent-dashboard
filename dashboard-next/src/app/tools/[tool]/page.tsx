"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useToolSummary } from "@/lib/hooks/useToolSummary";
import StatCard from "@/components/tools/StatCard";
import RankingTable, { type Column } from "@/components/tools/RankingTable";

/** Registry of known tools with display names and summary-to-UI mappers. */
const TOOL_META: Record<
  string,
  { title: string; description: string }
> = {
  "sci-trends": {
    title: "Scientific Trends",
    description: "Global research output, growth rates, and citation analysis from OpenAlex.",
  },
  climate: {
    title: "Climate Trends",
    description: "Temperature trends, extremes, and volatility across global cities.",
  },
  "sea-level": {
    title: "Sea Level Rise",
    description: "Tide gauge trends, regional patterns, and acceleration analysis.",
  },
  "attention-gap": {
    title: "Attention Gap",
    description: "Media vs. scientific attention divergence across research fields.",
  },
  "ocean-warming": {
    title: "Ocean Warming",
    description: "Sea surface temperature trends, basin ranking, and ENSO analysis.",
  },
  "uk-grid-decarb": {
    title: "UK Grid Decarbonisation",
    description: "Carbon intensity trends and renewable generation across UK regions.",
  },
  "solar-cycles": {
    title: "Solar Cycles",
    description: "Sunspot cycles, predictions, and solar activity analysis.",
  },
  "exoplanet-census": {
    title: "Exoplanet Census",
    description: "Confirmed exoplanet statistics, detection methods, and habitable zone analysis.",
  },
  "covid-attention": {
    title: "COVID Attention Dynamics",
    description: "Research attention shifts during and after the COVID-19 pandemic.",
  },
  "us-debt-dynamics": {
    title: "US Debt Dynamics",
    description: "Federal debt composition, blended interest rates, and fiscal projections.",
  },
  "currency-contagion": {
    title: "Currency Contagion",
    description: "Currency crisis propagation and correlation analysis.",
  },
  "gbif-biodiversity": {
    title: "GBIF Biodiversity",
    description: "Global biodiversity occurrence records and species distributions.",
  },
  "river-flow": {
    title: "River Flow",
    description: "River discharge trends and hydrological analysis.",
  },
  "solar-seismic": {
    title: "Solar-Seismic Correlation",
    description: "Analysis of potential correlations between solar activity and seismicity.",
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function SciTrendsView({ data }: { data: any }) {
  const fieldCols: Column[] = [
    { key: "name", label: "Field" },
    { key: "cagr_5y", label: "5yr CAGR", format: (v: any) => `${((v as number) * 100).toFixed(1)}%` },
    { key: "works_2024", label: "Works 2024", format: (v: any) => (v as number).toLocaleString() },
  ];

  const topicCols: Column[] = [
    { key: "name", label: "Topic" },
    { key: "field", label: "Field" },
    { key: "cagr", label: "CAGR", format: (v: any) => `${((v as number) * 100).toFixed(1)}%` },
    { key: "works_2024", label: "Works 2024", format: (v: any) => (v as number).toLocaleString() },
  ];

  const countryCols: Column[] = [
    { key: "name", label: "Country" },
    { key: "works_2024", label: "Works 2024", format: (v: any) => (v as number).toLocaleString() },
    { key: "share_2024", label: "Share", format: (v: any) => `${((v as number) * 100).toFixed(1)}%` },
    { key: "cagr_5y", label: "5yr CAGR", format: (v: any) => `${((v as number) * 100).toFixed(1)}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          title="Global Works (2024)"
          value={data.globalWorks2024?.toLocaleString() ?? "—"}
        />
        <StatCard
          title="Countries Tracked"
          value={data.countriesTracked?.toLocaleString() ?? "—"}
        />
        <StatCard
          title="Topics Tracked"
          value={data.topicsTracked?.toLocaleString() ?? "—"}
        />
      </div>

      {/* Tables */}
      {data.fields?.length > 0 && (
        <RankingTable
          title="Fields by Growth Rate"
          columns={fieldCols}
          data={data.fields}
          maxRows={15}
        />
      )}

      {data.topGrowing?.length > 0 && (
        <RankingTable
          title="Fastest Growing Topics"
          columns={topicCols}
          data={data.topGrowing}
          maxRows={10}
        />
      )}

      {data.countries?.length > 0 && (
        <RankingTable
          title="Top Countries by Output"
          columns={countryCols}
          data={data.countries}
          maxRows={10}
        />
      )}
    </div>
  );
}

function GenericView({ data }: { data: any }) {
  // For tools without a specific view, render key stats and any arrays as tables
  const stats: { title: string; value: string }[] = [];
  const tables: { key: string; rows: any[] }[] = [];

  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val) && val.length > 0) {
      tables.push({ key, rows: val });
    } else if (typeof val === "number") {
      stats.push({ title: key, value: val.toLocaleString() });
    } else if (typeof val === "string" && val.length < 100) {
      stats.push({ title: key, value: val });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <StatCard key={s.title} title={s.title} value={s.value} />
          ))}
        </div>
      )}

      {tables.map(({ key, rows }) => {
        const sampleRow = rows[0];
        const cols: Column[] = Object.keys(sampleRow)
          .filter((k) => typeof sampleRow[k] !== "object")
          .map((k) => ({
            key: k,
            label: k.replace(/_/g, " "),
            format:
              typeof sampleRow[k] === "number"
                ? (v: any) => (v as number).toLocaleString()
                : undefined,
          }));

        return (
          <RankingTable
            key={key}
            title={key.replace(/_/g, " ")}
            columns={cols}
            data={rows}
            maxRows={15}
          />
        );
      })}
    </div>
  );
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export default function ToolPage() {
  const params = useParams<{ tool: string }>();
  const tool = params.tool;
  const meta = TOOL_META[tool];
  const { data, isLoading, isError, error } = useToolSummary(tool);

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
          <Link href="/" className="hover:text-zinc-300 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-zinc-300">{meta?.title ?? tool}</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100">
          {meta?.title ?? tool}
        </h1>
        {meta?.description && (
          <p className="text-sm text-zinc-400 mt-1">{meta.description}</p>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          Loading {meta?.title ?? tool} data...
        </div>
      ) : isError ? (
        <div className="rounded border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          Failed to load data: {(error as Error)?.message ?? "Unknown error"}
        </div>
      ) : data ? (
        tool === "sci-trends" ? (
          <SciTrendsView data={data} />
        ) : (
          <GenericView data={data} />
        )
      ) : null}
    </div>
  );
}
