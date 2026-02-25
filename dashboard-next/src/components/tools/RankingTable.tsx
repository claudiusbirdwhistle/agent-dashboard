"use client";

export interface Column<T = Record<string, unknown>> {
  key: string;
  label: string;
  format?: (value: T[keyof T], row: T) => string;
}

interface RankingTableProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  maxRows?: number;
}

export default function RankingTable<T extends Record<string, unknown>>({
  columns,
  data,
  title,
  maxRows,
}: RankingTableProps<T>) {
  const rows = maxRows != null ? data.slice(0, maxRows) : data;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/60">
      {title && (
        <h3 className="border-b border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200">
          {title}
        </h3>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-xs uppercase tracking-wider text-zinc-400">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-zinc-700/50 text-zinc-300 even:bg-zinc-800/40 hover:bg-zinc-700/30"
              >
                {columns.map((col) => {
                  const raw = row[col.key as keyof T];
                  const display = col.format
                    ? col.format(raw as T[keyof T], row)
                    : String(raw);
                  return (
                    <td key={col.key} className="px-4 py-2 tabular-nums">
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
