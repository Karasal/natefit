'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Scan,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg glass"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col
          bg-surface border-r border-white/5
          transition-all duration-200
          ${collapsed ? 'w-16' : 'w-60'}
          ${collapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-2 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center shrink-0">
            <Scan className="h-5 w-5 text-neon" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-lg tracking-tight">NATEFIT</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto hidden lg:block text-text-dim hover:text-text"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-neon/10 text-neon'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                  }
                `}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          {!collapsed && profile && (
            <p className="text-xs text-text-dim mb-2 px-2 truncate">{profile.full_name}</p>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-dim hover:text-danger hover:bg-danger/5 w-full transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
