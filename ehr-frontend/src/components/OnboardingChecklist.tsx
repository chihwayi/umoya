import React from "react";
import { useOnboarding } from "../hooks/useOnboarding";

interface Props {
  role?: string;
}

export function OnboardingChecklist({ role }: Props) {
  const { checklist, isVisible, completedStepIds, dismiss, completeStep } = useOnboarding(role);

  if (!isVisible) return null;

  const doneCount = completedStepIds.length;
  const totalCount = checklist.steps.length;

  return (
    <div className="rounded-2xl border border-[#00C896]/20 bg-gradient-to-br from-[#00C896]/[0.06] to-[#2B7FFF]/[0.04] p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4A7A5A]">Getting Started</p>
          <h2 className="mt-0.5 text-sm font-bold text-white">{checklist.title}</h2>
          <p className="mt-0.5 text-[11px] text-[#7A9AB8]">{doneCount}/{totalCount} steps complete</p>
        </div>
        <button
          onClick={dismiss}
          className="text-[#7A9AB8] hover:text-white transition text-lg leading-none mt-0.5"
          aria-label="Dismiss onboarding"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {checklist.steps.map(step => {
          const done = completedStepIds.includes(step.id);
          return (
            <li key={step.id} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <input
                type="checkbox"
                checked={done}
                onChange={() => completeStep(step.id)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-[#4A6A8A] bg-transparent accent-[#00C896] cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${done ? "line-through text-[#4A6A8A]" : "text-[#C5D5EE]"}`}>
                  {step.label}
                </span>
                {!done && (
                  <p className="text-[11px] text-[#7A9AB8] mt-0.5 leading-snug">{step.description}</p>
                )}
                {!done && step.linkPath && (
                  <a href={step.linkPath} className="text-[11px] text-[#00C896] hover:underline mt-0.5 block">
                    {step.linkLabel ?? "Open"}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}