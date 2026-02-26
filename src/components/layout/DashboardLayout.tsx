'use client';

import { Sidebar } from './Sidebar';
import type { ReactNode } from 'react';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <main className="lg:ml-60 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
