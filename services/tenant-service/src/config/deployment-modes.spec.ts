import { getModeDefinition, DEPLOYMENT_MODES } from './deployment-modes';

describe('getModeDefinition', () => {
  it('returns clinic mode by default', () => {
    expect(getModeDefinition(null).mode).toBe('clinic');
    expect(getModeDefinition(undefined).mode).toBe('clinic');
  });

  it('returns hospital mode', () => {
    const def = getModeDefinition('hospital');
    expect(def.mode).toBe('hospital');
    expect(def.visibleModules).toContain('operating_room');
    expect(def.visibleModules).toContain('emergency');
  });

  it('clinic mode hides operating_room', () => {
    const def = getModeDefinition('clinic');
    expect(def.hiddenModules).toContain('operating_room');
  });

  it('ministry mode is defined', () => {
    expect(DEPLOYMENT_MODES.ministry.mode).toBe('ministry');
  });
});
