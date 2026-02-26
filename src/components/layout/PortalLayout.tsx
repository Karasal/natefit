'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scan, History, GitCompare, Target, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/portal', label: 'Home', icon: Scan },
  { href: '/portal/scan', label: 'Scan', icon: Scan },
  { href: '/portal/history', label: 'History', icon: History },
  { href: '/portal/compare', label: 'Compare', icon: GitCompare },
  { href: '/portal/goals', label: 'Goals', icon: Target },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-white/5 bg-surface/80 backdrop-blur-lg sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon/10 flex items-center justify-center">
              <Scan className="h-4 w-4 text-neon" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight">NATEFIT</span>
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/portal/settings"
              className="p-2 rounded-lg text-text-dim hover:text-text hover:bg-white/5"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-text-dim hover:text-danger hover:bg-danger/5"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Bottom Tab Bar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-white/5 lg:hidden z-30">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-1
                  ${isActive ? 'text-neon' : 'text-text-dim'}
                `}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
