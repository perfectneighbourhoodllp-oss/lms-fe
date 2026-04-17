import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⬛' },
  { to: '/leads', label: 'Leads', icon: '👥' },
  { to: '/projects', label: 'Projects', icon: '🏗' },
  { to: '/team', label: 'Team', icon: '🧑‍💼', roles: ['admin', 'manager'] },
  { to: '/agents', label: 'Agent Performance', icon: '📊', roles: ['admin', 'manager'] },
  { to: '/meta-webhook', label: 'Meta Ads', icon: '📡', roles: ['admin', 'manager'] },
  { to: '/activity-logs', label: 'Activity Logs', icon: '📋', roles: ['admin'] },
];

const ROLE_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  sales: 'bg-green-100 text-green-700',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile nav)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const visibleNav = NAV.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">PNH</div>
          <span className="font-bold text-gray-800">PNH Lead MS</span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`
            }
          >
            <span className="text-lg leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-gray-800">{user?.name}</p>
            <span className={`badge text-[10px] ${ROLE_BADGE[user?.role] || 'bg-gray-100 text-gray-600'}`}>
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="btn-secondary w-full text-xs py-1.5"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-100 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col flex-shrink-0 shadow-xl transition-transform duration-300 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-[10px]">PNH</div>
            <span className="font-bold text-gray-800 text-sm">PNH Lead MS</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
