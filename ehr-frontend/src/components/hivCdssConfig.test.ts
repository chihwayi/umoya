import { getHivCdssConfig, hivCdssConfig } from './HIV/hivCdssConfig';

describe('hivCdssConfig', () => {
  it('exposes WHO-aligned default thresholds', () => {
    expect(hivCdssConfig.thresholds.highViralLoad).toBe(1000);
    expect(hivCdssConfig.thresholds.eacConsecutiveHighResults).toBe(2);
    expect(hivCdssConfig.thresholds.eacWindowMonthsMin).toBe(3);
    expect(hivCdssConfig.thresholds.eacWindowMonthsMax).toBe(6);
    expect(hivCdssConfig.thresholds.vlMonitoringStableMonths).toBe(6);
    expect(hivCdssConfig.thresholds.vlMonitoringUnstableMonths).toBe(3);
    expect(hivCdssConfig.thresholds.testingOverdueDaysGrace).toBe(0);
    expect(hivCdssConfig.thresholds.artInitiationMaxDays).toBe(7);
  });

  it('provides consistent configuration for any tenant slug', () => {
    const tenantA = getHivCdssConfig('tenant-a');
    const tenantB = getHivCdssConfig('tenant-b');
    const defaultConfig = getHivCdssConfig();

    expect(tenantA).toBe(hivCdssConfig);
    expect(tenantB).toBe(hivCdssConfig);
    expect(defaultConfig).toBe(hivCdssConfig);
  });

  it('includes key WHO-aligned CDSS messages', () => {
    expect(hivCdssConfig.messages.testingTimelinePositive.length).toBeGreaterThan(0);
    expect(hivCdssConfig.messages.testingTimelineOverduePrefix.length).toBeGreaterThan(0);
    expect(hivCdssConfig.messages.eacOverview.length).toBeGreaterThan(0);
    expect(hivCdssConfig.messages.eacCardListing.length).toBeGreaterThan(0);
    expect(hivCdssConfig.messages.highViralLoadVisit.length).toBeGreaterThan(0);
  });
});

