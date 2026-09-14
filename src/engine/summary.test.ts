import { describe, it, expect } from 'vitest';
import { buildSummary } from './summary';
import { calculate, DEFAULT_CONFIG } from './index';
import { STANDARD_300 } from './presets';

describe('buildSummary', () => {
  it('renders a cash game a friend can read in a group chat', () => {
    const r = calculate(STANDARD_300, DEFAULT_CONFIG);
    const text = buildSummary(r, DEFAULT_CONFIG);
    expect(text).toContain('5 players, cash game');
    expect(text).toContain('Buy-in: $20 each');
    expect(text).toContain('White (10¢ each)');
    expect(text).toContain('Blinds: 10¢ / 20¢');
    expect(text).toContain('chipratio.pages.dev');
    expect(text).not.toMatch(/\$\d+\.\d{3,}/); // no long decimals, ever
  });

  it('renders a tournament with its schedule', () => {
    const config = { ...DEFAULT_CONFIG, game: 'tournament' as const, startingStack: 500 };
    const text = buildSummary(calculate(STANDARD_300, config), config);
    expect(text).toContain('Starting stack: 500');
    expect(text).toContain('Blinds start at');
    expect(text).not.toContain('$');
  });

  it('renders warnings without a stack and never crashes', () => {
    const r = calculate({ denominations: [] }, DEFAULT_CONFIG);
    const text = buildSummary(r, DEFAULT_CONFIG);
    expect(text).toContain('!');
    expect(text).not.toContain('Everyone gets');
  });

  it('never uses an em or en dash (house style)', () => {
    const r = calculate(STANDARD_300, { ...DEFAULT_CONFIG, players: 5 });
    expect(buildSummary(r, DEFAULT_CONFIG)).not.toMatch(/[\u2013\u2014]/);
  });
});
