import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bell, Heart, LogOut, Menu, Package, Settings, User, Users, X, CheckCheck, ExternalLink, type LucideIcon } from 'lucide-react';
import { tenantApi, cdssApi } from '../services/api';
import LanguageSwitcher from './LanguageSwitcher';
import { OnboardingChecklist } from './OnboardingChecklist';
import { useOnboarding } from '../hooks/useOnboarding';
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
  moduleKey?: string;
  exact?: boolean;
  roles?: string[];
}

interface EhrUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const ROUTE_MODULE_MATCHERS: Array<{ pathPart: string; moduleKey: string }> = [
  { pathPart: 'radiology', moduleKey: 'radiology' },
  { pathPart: 'radiologist', moduleKey: 'radiology' },
  { pathPart: 'technologist/imaging', moduleKey: 'radiology' },
  { pathPart: 'operating-room', moduleKey: 'operating_room' },
  { pathPart: 'theatre', moduleKey: 'operating_room' },
  { pathPart: 'blood-bank', moduleKey: 'blood_bank' },
  { pathPart: 'oncology', moduleKey: 'oncology' },
  { pathPart: 'cardiology', moduleKey: 'cardiology' },
  { pathPart: 'ophthalmology', moduleKey: 'ophthalmology' },
  { pathPart: 'emergency', moduleKey: 'emergency' },
  { pathPart: 'infection-control', moduleKey: 'infection_control' },
  { pathPart: 'hiv', moduleKey: 'hiv' },
  { pathPart: 'maternity', moduleKey: 'maternity' },
  { pathPart: 'diabetes', moduleKey: 'diabetes' },
  { pathPart: 'telemedicine', moduleKey: 'telemedicine' },
  { pathPart: 'population-health', moduleKey: 'population_health' },
  { pathPart: 'patient-portal', moduleKey: 'patient_portal' },
  { pathPart: 'post-visit', moduleKey: 'patient_portal' },
];

const getNavigationModuleKey = (item: NavigationItem): string | undefined => {
  if (item.moduleKey) return item.moduleKey;
  const normalizedPath = item.path.toLowerCase();
  return ROUTE_MODULE_MATCHERS.find((matcher) => normalizedPath.includes(matcher.pathPart))?.moduleKey;
};

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
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [deploymentMode, setDeploymentMode] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);

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
        setEnabledModules(Array.isArray(data.enabledModules) ? data.enabledModules : []);
        setDeploymentMode(data.deploymentMode || null);
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

  // Poll unread count every 60 s while the user is logged in
  useEffect(() => {
    const token = localStorage.getItem('ehr_token') || '';
    if (!token || !tenantSlug) return;

    const fetchCount = () => {
      cdssApi.getStaffNotificationsUnreadCount(token, tenantSlug)
        .then(({ data }) => setUnreadCount(data?.count ?? 0))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [tenantSlug]);

  // Close panel on outside click
  useEffect(() => {
    if (!notifPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setNotifPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifPanelOpen]);

  const openNotifPanel = async () => {
    setNotifPanelOpen(prev => !prev);
    if (notifPanelOpen) return;
    const token = localStorage.getItem('ehr_token') || '';
    if (!token || !tenantSlug) return;
    setNotifLoading(true);
    try {
      const { data } = await cdssApi.getStaffNotifications(token, tenantSlug, { limit: 20 });
      setNotifications(data?.notifications ?? []);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch { /* silent */ } finally {
      setNotifLoading(false);
    }
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('ehr_token') || '';
    if (!token || !tenantSlug) return;
    try {
      await cdssApi.markAllStaffNotificationsRead(token, tenantSlug);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const markOneRead = async (id: string) => {
    const token = localStorage.getItem('ehr_token') || '';
    if (!token || !tenantSlug) return;
    try {
      await cdssApi.markStaffNotificationRead(id, token, tenantSlug);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const handleLogout = () => {
    window.dispatchEvent(new Event('ehr-logout'));
    localStorage.removeItem('ehr_token');
    localStorage.removeItem('ehr_user');
    localStorage.removeItem('ehr_tenant');
    sessionStorage.removeItem('ehr_welcome_shown');
    navigate(`/ehr/${tenantSlug}`);
  };

  const role = user?.role || '';
  const workspaceLabel = portalLabel || `${(role || 'clinic').replace('_', ' ')} workspace`;
  const { isVisible: onboardingVisible, reopen: reopenOnboarding } = useOnboarding(role || null);
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
        key: 'storeroom',
        label: 'Storeroom',
        path: `/ehr/${tenantSlug}/storeroom`,
        icon: Package,
        exact: true,
        roles: ['store_manager', 'admin'],
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

  const roleFilteredNavigationItems = useMemo(
    () =>
      (navigationItems && navigationItems.length ? navigationItems : defaultNavigationItems).filter((item) =>
        item.roles?.length ? item.roles.includes(role) : true,
      ),
    [defaultNavigationItems, navigationItems, role],
  );

  const visibleNavItems = useMemo(
    () =>
      roleFilteredNavigationItems.filter((item) => {
        const moduleKey = getNavigationModuleKey(item);
        return !moduleKey || enabledModules.includes(moduleKey);
      }),
    [enabledModules, roleFilteredNavigationItems],
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

          {deploymentMode && deploymentMode !== 'clinic' && (
            <div className="mx-3 mb-3 rounded-xl border border-[#3B9EFF]/20 bg-[#3B9EFF]/[0.07] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4A7AAA]">Deployment Mode</p>
              <p className="text-xs font-semibold text-[#C5D5EE] capitalize">{deploymentMode}</p>
            </div>
          )}

          <nav className="space-y-2">
            {visibleNavItems.map((item) => {
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
            {!onboardingVisible && (
              <button
                onClick={reopenOnboarding}
                className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-white/10 rounded-lg transition-colors text-sm"
              >
                <CheckCheck className="w-5 h-5" />
                <span>Getting started</span>
              </button>
            )}
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
              <LanguageSwitcher />
              {/* ── Notification Bell ── */}
              <div className="relative" ref={notifPanelRef}>
                <button
                  onClick={openNotifPanel}
                  className="p-2 hover:bg-white/20 rounded-lg relative transition-colors"
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                  <Bell className="w-5 h-5 text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifPanelOpen && (
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <span className="font-semibold text-slate-800 text-sm">Notifications</span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark all read
                          </button>
                        )}
                        <button onClick={() => setNotifPanelOpen(false)} className="p-1 hover:bg-slate-200 rounded">
                          <X className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    </div>

                    {/* Panel body */}
                    <div className="max-h-96 overflow-y-auto">
                      {notifLoading ? (
                        <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading…</div>
                      ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                          <Bell className="w-8 h-8 mb-2 opacity-30" />
                          <span className="text-sm">No notifications</span>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/60' : ''}`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium text-slate-800 ${n.read ? 'pl-4' : ''}`}>{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                <div className="flex items-center justify-between mt-1.5 gap-2">
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {n.actionUrl && (
                                      <a
                                        href={n.actionUrl}
                                        onClick={() => { markOneRead(n.id); setNotifPanelOpen(false); }}
                                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                      >
                                        {n.actionLabel || 'View'} <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {!n.read && (
                                      <button
                                        onClick={() => markOneRead(n.id)}
                                        className="text-[10px] text-slate-400 hover:text-slate-600"
                                      >
                                        Dismiss
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/15 rounded-lg">
                <User className="w-4 h-4 text-white" />
                <span className="text-sm text-white font-medium capitalize">{workspaceLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <main className={contentClassName}>
          <OnboardingChecklist role={role} />
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminNavigationShell;
