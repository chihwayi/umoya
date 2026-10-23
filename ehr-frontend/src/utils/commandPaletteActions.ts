/**
 * Command Palette Actions Registry
 * Centralized definition of all available commands and their handlers
 */

import { NavigateFunction } from 'react-router-dom';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  category: 'navigation' | 'search' | 'action' | 'help';
  keywords: string[];
  icon?: string;
  requiresAuth?: boolean;
  isMutating?: boolean; // Requires confirmation before execution
  handler: (params: {
    navigate: NavigateFunction;
    tenantSlug?: string;
    token?: string;
    payload?: any;
  }) => void | Promise<void>;
}

/**
 * Build the command palette action registry dynamically based on available data
 */
export function buildCommandRegistry(tenantSlug: string, userRole: string): CommandAction[] {
  const baseActions: CommandAction[] = [
    // Navigation: Dashboard
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      description: 'Go to main dashboard',
      category: 'navigation',
      keywords: ['dashboard', 'home', 'main'],
      icon: 'home',
      handler: ({ navigate }) => {
        navigate(`/ehr/${tenantSlug}/dashboard`);
      },
    },

    // Navigation: Patients
    {
      id: 'nav-patients',
      label: 'Patients',
      description: 'View patient management',
      category: 'navigation',
      keywords: ['patient', 'patients', 'search patient'],
      icon: 'users',
      handler: ({ navigate }) => {
        navigate(`/ehr/${tenantSlug}/patients`);
      },
    },

    // Navigation: Appointments
    {
      id: 'nav-appointments',
      label: 'Appointments',
      description: 'View and manage appointments',
      category: 'navigation',
      keywords: ['appointment', 'appointments', 'schedule'],
      icon: 'calendar',
      handler: ({ navigate }) => {
        navigate(`/ehr/${tenantSlug}/appointments`);
      },
    },

    // Navigation: Profile
    {
      id: 'nav-profile',
      label: 'Profile Settings',
      description: 'View and edit your profile',
      category: 'navigation',
      keywords: ['profile', 'settings', 'account', 'preferences'],
      icon: 'user',
      handler: ({ navigate }) => {
        navigate(`/ehr/${tenantSlug}/profile`);
      },
    },

    // Navigation: Notifications
    {
      id: 'nav-notifications',
      label: 'Notifications',
      description: 'View notification center',
      category: 'navigation',
      keywords: ['notification', 'notifications', 'alerts'],
      icon: 'bell',
      handler: ({ navigate }) => {
        navigate(`/ehr/${tenantSlug}/notifications`);
      },
    },

    // Search: Clinical Guidelines
    {
      id: 'search-guidelines',
      label: 'Search Clinical Guidelines',
      description: 'Query the clinical decision support system',
      category: 'search',
      keywords: ['clinical', 'guidelines', 'cdss', 'decision', 'evidence'],
      icon: 'book',
      handler: () => {
        // This is a special action: it opens the clinical-question mode
        // Handled by the CommandPalette component itself
      },
    },

    // Help
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'Learn keyboard shortcuts',
      category: 'help',
      keywords: ['help', 'shortcuts', 'keys', 'keyboard'],
      icon: 'help-circle',
      handler: () => {
        // Handled by CommandPalette component (show shortcuts modal)
      },
    },
  ];

  // Role-specific actions
  const roleSpecificActions: CommandAction[] = [];

  if (userRole === 'doctor') {
    roleSpecificActions.push(
      {
        id: 'nav-doctor-dashboard',
        label: 'Doctor Dashboard',
        description: 'View doctor workspace',
        category: 'navigation',
        keywords: ['doctor', 'workspace', 'my patients'],
        icon: 'stethoscope',
        handler: ({ navigate }) => {
          navigate(`/ehr/${tenantSlug}/doctor`);
        },
      },
      {
        id: 'nav-post-visit',
        label: 'Post-Visit Workspace',
        description: 'Post-visit care and AI companion',
        category: 'navigation',
        keywords: ['post-visit', 'post visit', 'companion', 'care'],
        icon: 'message',
        handler: ({ navigate }) => {
          navigate(`/ehr/${tenantSlug}/post-visit/doctor`);
        },
      }
    );
  }

  if (userRole === 'nurse') {
    roleSpecificActions.push(
      {
        id: 'nav-nurse-dashboard',
        label: 'Nurse Dashboard',
        description: 'View nurse workspace',
        category: 'navigation',
        keywords: ['nurse', 'workspace', 'queue', 'vitals'],
        icon: 'heart',
        handler: ({ navigate }) => {
          navigate(`/ehr/${tenantSlug}/nurse`);
        },
      },
      {
        id: 'nav-triage',
        label: 'Triage',
        description: 'Patient triage workflow',
        category: 'navigation',
        keywords: ['triage', 'assessment', 'intake'],
        icon: 'alert-circle',
        handler: ({ navigate }) => {
          navigate(`/ehr/${tenantSlug}/nurse/triage`);
        },
      }
    );
  }

  if (userRole === 'admin') {
    roleSpecificActions.push(
      {
        id: 'nav-users',
        label: 'User Management',
        description: 'Manage system users',
        category: 'navigation',
        keywords: ['user', 'users', 'admin', 'manage'],
        icon: 'settings',
        requiresAuth: true,
        handler: ({ navigate }) => {
          navigate(`/ehr/${tenantSlug}/users`);
        },
      },
      {
        id: 'nav-sessions',
        label: 'Staff Sessions',
        description: 'View active user sessions',
        category: 'navigation',
        keywords: ['session', 'sessions', 'users online'],
        icon: 'monitor',
        requiresAuth: true,
        handler: ({ navigate }) => {
          navigate(`/ehr/${tenantSlug}/sessions`);
        },
      }
    );
  }

  return [...baseActions, ...roleSpecificActions];
}

/**
 * Allowlist of actions that require confirmation before execution
 * (e.g., actions that modify state or delete data)
 */
export const MUTATING_ACTION_ALLOWLIST = new Set<string>([
  // Currently, most actions are navigation-safe.
  // Add IDs here if we add mutating operations (e.g., "delete-patient", "archive-record").
]);

/**
 * Check if an action requires confirmation before execution
 */
export function requiresConfirmation(actionId: string): boolean {
  return MUTATING_ACTION_ALLOWLIST.has(actionId);
}
