import React, { useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { GlassButton } from './ui/GlassComponents';

interface NavLink {
  key: string;
  label: string;
}

interface PortalNavbarProps {
  links: NavLink[];
  activeKey: string;
  onNavigate: (key: string) => void;
  notifications: { id: string | number; title?: string; message: string; created_at?: string }[];
  hasUnread?: boolean;
  onLogout: () => void;
  userName?: string;
}

export const PortalNavbar = ({ links, activeKey, onNavigate, notifications, hasUnread, onLogout, userName }: PortalNavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  return (
    <header className="sticky top-3 z-50 px-4 md:px-8">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-4 py-3 shadow-2xl shadow-blue-950/30 md:px-6">
        <button onClick={() => onNavigate('home')} className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-2xl font-extrabold text-transparent">Sangam</button>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <button
              key={link.key}
              onClick={() => onNavigate(link.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium text-slate-100 ${
                activeKey === link.key ? 'neon-primary' : 'hover:bg-white/10'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="relative">
            <button onClick={() => setBellOpen((p) => !p)} className="relative rounded-full p-2 text-cyan-200 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-300/30">
              <Bell size={20} />
              {hasUnread && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
            </button>
            {bellOpen && (
              <div className="glass absolute right-0 mt-2 w-80 p-3 shadow-xl">
                <p className="mb-2 text-sm font-semibold text-cyan-200">Latest Updates</p>
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((n) => (
                    <div key={n.id} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-sm">
                      <p className="font-medium text-violet-200">{n.title || 'Update'}</p>
                      <p className="text-slate-200">{n.message}</p>
                    </div>
                  ))}
                  {notifications.length === 0 && <p className="text-sm text-slate-300">No new notifications.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setProfileOpen((p) => !p)} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 hover:bg-white/10">
              Profile <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="glass absolute right-0 mt-2 w-48 p-2 shadow-xl">
                <p className="mb-2 px-2 text-xs text-slate-300">{userName || 'Student'}</p>
                <GlassButton variant="danger" size="sm" className="w-full" onClick={onLogout}>
                  <LogOut size={16} /> Logout
                </GlassButton>
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setMobileOpen((p) => !p)} className="rounded-full p-2 text-slate-100 hover:bg-white/10 md:hidden">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="glass mx-auto mt-2 max-w-7xl space-y-2 p-4 md:hidden">
          {links.map((link) => (
            <button key={link.key} onClick={() => { onNavigate(link.key); setMobileOpen(false); }} className="block w-full rounded-xl px-3 py-2 text-left text-slate-100 hover:bg-white/10">
              {link.label}
            </button>
          ))}
          <button onClick={onLogout} className="block w-full rounded-xl bg-red-500/90 px-3 py-2 text-left text-white">Logout</button>
        </div>
      )}
    </header>
  );
};
