'use client';

import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, keyExtractor, onRowClick, emptyMessage = 'No data' }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="glass rounded-xl p-12 text-center">
        <p className="text-text-dim text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-medium text-text-dim uppercase tracking-wider ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={`
                border-b border-white/5 last:border-0
                ${onRowClick ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}
              `}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-sm ${col.className || ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
