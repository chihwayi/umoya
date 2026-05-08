import { useState, useCallback } from "react";
import { getChecklist, RoleChecklist } from "../data/onboarding";

const STORAGE_KEY_PREFIX = "medicore_onboarding_";

function getStorageKey(role: string): string {
  return `${STORAGE_KEY_PREFIX}${role}`;
}

function loadState(role: string): { dismissed: boolean; completed: string[] } {
  try {
    const raw = localStorage.getItem(getStorageKey(role));
    if (!raw) return { dismissed: false, completed: [] };
    return JSON.parse(raw);
  } catch {
    return { dismissed: false, completed: [] };
  }
}

function saveState(role: string, state: { dismissed: boolean; completed: string[] }): void {
  try {
    localStorage.setItem(getStorageKey(role), JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export interface UseOnboardingReturn {
  checklist: RoleChecklist;
  isVisible: boolean;
  completedStepIds: string[];
  dismiss: () => void;
  reopen: () => void;
  completeStep: (stepId: string) => void;
}

export function useOnboarding(role?: string | null): UseOnboardingReturn {
  const normalizedRole = role?.toLowerCase() ?? "default";
  const checklist = getChecklist(normalizedRole);
  const initial = loadState(normalizedRole);

  const [dismissed, setDismissed] = useState(initial.dismissed);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(initial.completed);

  const isVisible = !dismissed;

  const dismiss = useCallback(() => {
    setDismissed(true);
    saveState(normalizedRole, { dismissed: true, completed: completedStepIds });
  }, [normalizedRole, completedStepIds]);

  const reopen = useCallback(() => {
    setDismissed(false);
    saveState(normalizedRole, { dismissed: false, completed: completedStepIds });
  }, [normalizedRole, completedStepIds]);

  const completeStep = useCallback((stepId: string) => {
    setCompletedStepIds(prev => {
      if (prev.includes(stepId)) return prev;
      const next = [...prev, stepId];
      saveState(normalizedRole, { dismissed, completed: next });
      return next;
    });
  }, [normalizedRole, dismissed]);

  return { checklist, isVisible, completedStepIds, dismiss, reopen, completeStep };
}