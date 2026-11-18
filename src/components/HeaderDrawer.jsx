'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut, ShieldCheck, Settings, Sparkles } from 'lucide-react';

export default function HeaderDrawer({
  profile,
  modules,
  activeModule,
  onSelectModule,
  onLogout,
  onOpenMorningSettings,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-3.5 py-3 flex items-center justify-between">
          {/* Left: Drawer Button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 transition"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Center: App Name */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🌅</span>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide">सारथी (Saarthi)</h1>
          </div>

          {/* Right: Google Profile & Logout */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 pl-1.5 pr-2.5 py-1 rounded-full transition"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User'}
                  className="w-7 h-7 rounded-full border border-white/70 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-800 flex items-center justify-center text-xs font-bold">
                  {(profile?.full_name?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <span className="text-xs font-semibold max-w-[75px] truncate hidden sm:inline">
                {profile?.full_name?.split(' ')[0] || 'User'}
              </span>
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white text-slate-800 rounded-2xl shadow-xl border border-stone-200 p-3 z-50">
                <p className="text-xs font-bold truncate">{profile?.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate mb-2.5">{profile?.email}</p>
                <button
                  onClick={onLogout}
                  className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Top Module Switcher Tabs */}
        <div className="max-w-3xl mx-auto px-3 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {modules.map((mod) => {
            const isActive = activeModule === mod.slug;
            return (
              <button
                key={mod.slug}
                onClick={() => onSelectModule(mod.slug)}
                className={`flex-1 min-w-[105px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-orange-600 shadow-sm scale-[1.01]'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <span>{mod.icon}</span>
                <span>{mod.title}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Left Slide-Over Sidebar Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-white h-full shadow-2xl p-5 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  <span className="font-bold text-slate-800">सारथी मेनू</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                {profile?.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-sm flex items-center gap-2.5 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Admin Panel (Manage AI)</span>
                  </Link>
                )}

                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    if (onOpenMorningSettings) onOpenMorningSettings();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl hover:bg-stone-100 text-slate-700 font-medium text-sm flex items-center gap-2.5 transition"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Morning Card Settings</span>
                </button>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 text-[11px] text-slate-400">
              <p>DB Chat Limit: {profile?.max_db_chats || 10} chats</p>
              <p className="mt-0.5">Local Device History: 30 Days</p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
