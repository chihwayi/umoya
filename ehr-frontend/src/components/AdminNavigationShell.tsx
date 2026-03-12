import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bell, Heart, LogOut, Menu, Settings, User, Users, X, type LucideIcon } from 'lucide-react';
import { tenantApi } from '../services/api';
import {
  cacheTenantBranding,
  formatTenantDisplayName,
  getBrandInitials,
  readCachedTenantBranding,
  TenantBranding,
} from '../utils/tenantBranding';

interface AdminNavigationShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  navigationItems?: NavigationItem[];
  portalLabel?: string;
  headerTone?: 'default' | 'pharmacy' | 'finance' | 'radiology' | 'imaging';
  topBarActions?: React.ReactNode;
  contentClassName?: string;
}

interface NavigationItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
  roles?: string[];
}

interface EhrUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const AdminNavigationShell: React.FC<AdminNavigationShellProps> = ({
  title,
  subtitle,
  children,
  navigationItems,
  portalLabel,
  headerTone = 'default',
  topBarActions,
  contentClassName = 'p-6',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<EhrUser | null>(null);
  const [tenantBranding, setTenantBranding] = useState<TenantBranding | null>(() => readCachedTenantBranding(tenantSlug));

  useEffect(() => {
    const userData = localStorage.getItem('ehr_user');
    if (!userData || !tenantSlug) {
      navigate(`/ehr/${tenantSlug || ''}`);
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch {
      navigate(`/ehr/${tenantSlug}`);
    }
  }, [navigate, tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    setTenantBranding(readCachedTenantBranding(tenantSlug));
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;

    let active = true;
    tenantApi
      .getTenantBySlug(tenantSlug)
      .then(({ data }) => {
        if (!active || !data) return;
        const nextBranding: TenantBranding = {
          clinicName: data.clinicName,
          logoUrl: data.logoUrl,
        };
        setTenantBranding(nextBranding);
        cacheTenantBranding(tenantSlug, nextBranding);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [tenantSlug]);

  const userInitials = useMemo(() => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  }, [user]);

  const tenantDisplayName = useMemo(
    () => formatTenantDisplayName(tenantSlug, tenantBranding?.clinicName),
    [tenantSlug, tenantBranding?.clinicName],
  );

  const tenantInitials = useMemo(() => getBrandInitials(tenantDisplayName), [tenantDisplayName]);

  const handleLogout = () => {
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    sessionStorage.removeItem('ehr_welcome_shown');
    navigate(`/ehr/${tenantSlug}`);
  };

  const role = user?.role || '';
  const workspaceLabel = portalLabel || `${(role || 'clinic').replace('_', ' ')} workspace`;
  const headerToneClass = {
    default: 'from-blue-600 via-indigo-600 to-purple-600',
    pharmacy: 'from-teal-600 via-emerald-600 to-cyan-600',
    finance: 'from-amber-500 via-orange-500 to-indigo-600',
    radiology: 'from-violet-600 via-indigo-600 to-blue-600',
    imaging: 'from-cyan-600 via-blue-600 to-indigo-600',
  }[headerTone];
  const normalizedPath = location.pathname.replace(/\/+$/, '');

  const defaultNavigationItems = useMemo<NavigationItem[]>(() => {
    if (!tenantSlug) return [];
    return [
      {
        key: 'dashboard',
        label: 'Dashboard',
        path: `/ehr/${tenantSlug}/dashboard`,
        icon: Heart,
        exact: true,
      },
      {
        key: 'users',
        label: 'User Management',
        path: `/ehr/${tenantSlug}/users`,
        icon: Users,
        exact: true,
        roles: ['admin'],
      },
      {
        key: 'settings',
        label: 'Profile Settings',
        path: `/ehr/${tenantSlug}/settings`,
        icon: Settings,
        exact: true,
      },
    ];
  }, [tenantSlug]);

  const resolvedNavigationItems = useMemo(
    () =>
      (navigationItems && navigationItems.length ? navigationItems : defaultNavigationItems).filter((item) =>
        item.roles?.length ? item.roles.includes(role) : true,
      ),
    [defaultNavigationItems, navigationItems, role],
  );

  const isNavItemActive = (item: NavigationItem) => {
    const normalizedTarget = item.path.replace(/\/+$/, '');
    if (item.exact) {
      return normalizedPath === normalizedTarget;
    }
    return (
      normalizedPath === normalizedTarget ||
      normalizedPath.startsWith(`${normalizedTarget}/`)
    );
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      active ? 'bg-white/20 text-white' : 'text-slate-300 hover:bg-white/10'
    }`;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-slate-800 via-slate-900 to-gray-900 border-r border-slate-700/50 z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl border border-white/20 bg-white/5 overflow-hidden flex items-center justify-center">
                {tenantBranding?.logoUrl ? (
                  <img
                    src={tenantBranding.logoUrl}
                    alt={`${tenantDisplayName} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold tracking-wide text-white">{tenantInitials}</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white truncate">{tenantDisplayName}</h2>
                <p className="text-xs text-slate-300">EHR System</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>

          <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">{userInitials}</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">{user.firstName} {user.lastName}</h3>
                <p className="text-sm text-blue-200 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {resolvedNavigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={navItemClass(isNavItemActive(item))}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </aside>

      <div className="lg:ml-64">
        <header className={`bg-gradient-to-r ${headerToneClass} shadow-lg border-b border-blue-500/20 p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-white/20 rounded-lg">
                <Menu className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                {subtitle ? <p className="text-blue-100">{subtitle}</p> : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {topBarActions}
              <button className="p-2 hover:bg-white/20 rounded-lg relative transition-colors">
                <Bell className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-lg">
                <User className="w-4 h-4 text-white" />
                <span className="text-sm text-white font-medium capitalize">{workspaceLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <main className={contentClassName}>{children}</main>
      </div>
    </div>
  );
};

export default AdminNavigationShell;
