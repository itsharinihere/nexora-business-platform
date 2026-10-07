import {
  BarChart3,
  Bell,
  History,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Settings,
  Target,
  Users,
  Building2,
} from 'lucide-react';

/**
 * Sidebar navigation.
 *
 * `roles` is optional: an item with no `roles` is visible to everyone. All
 * routes in this list are readable by any authenticated user; destructive
 * actions are gated separately in the feature pages.
 */
export const NAV_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/leads', label: 'Leads', icon: Target },
  { to: '/app/customers', label: 'Customers', icon: Building2 },
  { to: '/app/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/app/support', label: 'Support', icon: LifeBuoy },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/team', label: 'Team', icon: Users },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/activity', label: 'Activity', icon: History },
];

export const NAV_FOOTER = [{ to: '/app/settings', label: 'Settings', icon: Settings }];

/** Nav items the current role is allowed to see. */
export function visibleNavItems(role) {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

/** Human-readable page title for the topbar, matched from the current path. */
export function pageTitleFor(pathname) {
  if (!pathname) return 'Dashboard';
  if (/\/app\/dashboard/.test(pathname)) return 'Dashboard';
  if (/\/app\/leads\/\d+/.test(pathname)) return 'Lead detail';
  if (/\/app\/leads/.test(pathname)) return 'Leads';
  if (/\/app\/customers\/\d+/.test(pathname)) return 'Customer detail';
  if (/\/app\/customers/.test(pathname)) return 'Customers';
  if (/\/app\/tasks\/\d+/.test(pathname)) return 'Task detail';
  if (/\/app\/tasks/.test(pathname)) return 'Tasks';
  if (/\/app\/support\/\d+/.test(pathname)) return 'Ticket detail';
  if (/\/app\/support/.test(pathname)) return 'Support';
  if (/\/app\/analytics/.test(pathname)) return 'Analytics';
  if (/\/app\/team\/\d+/.test(pathname)) return 'Member detail';
  if (/\/app\/team/.test(pathname)) return 'Team';
  if (/\/app\/notifications/.test(pathname)) return 'Notifications';
  if (/\/app\/activity/.test(pathname)) return 'Activity';
  if (/\/app\/settings/.test(pathname)) return 'Settings';
  if (/\/app\/profile/.test(pathname)) return 'Profile';
  return 'NEXORA';
}