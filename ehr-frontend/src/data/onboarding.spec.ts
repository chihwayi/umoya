import { getChecklist, ROLE_CHECKLISTS } from "./onboarding";

describe("getChecklist", () => {
  it("returns doctor checklist", () => {
    const c = getChecklist("doctor");
    expect(c.role).toBe("doctor");
    expect(c.steps.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    expect(getChecklist("NURSE").role).toBe("nurse");
  });

  it("returns default for unknown role", () => {
    expect(getChecklist("spaceship").role).toBe("default");
  });

  it("returns default for null", () => {
    expect(getChecklist(null).role).toBe("default");
  });

  it("all role checklists have at least one step", () => {
    for (const [role, checklist] of Object.entries(ROLE_CHECKLISTS)) {
      expect(checklist.steps.length).toBeGreaterThan(0);
    }
  });
});