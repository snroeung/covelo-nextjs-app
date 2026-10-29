import { describe, it, expect } from 'vitest';
import {
  parseMigrationList, pendingMigrations, remoteOnlyMigrations, outOfOrderMigrations, type MigrationRow,
} from '../scripts/db-push-dev/history';

const row = (local: string, remote: string): MigrationRow => ({ local, remote, time: local || remote });

describe('parseMigrationList — JSON (agent environments and --output-format json)', () => {
  it('finds the JSON line among CLI progress output', () => {
    const out = [
      'Initialising login role...',
      'Connecting to remote database...',
      '{"migrations":[{"local":"001","remote":"001","time":"001"},{"local":"002","remote":"","time":"002"}],"message":"Migrations listed"}',
      'A new version of Supabase CLI is available',
    ].join('\n');
    expect(parseMigrationList(out)).toEqual([row('001', '001'), row('002', '')]);
  });

  it('rejects a JSON object with the wrong shape', () => {
    expect(() => parseMigrationList('{"migrations":"nope"}')).toThrow(/Unexpected migration list shape/);
  });
});

describe('parseMigrationList — the table a normal terminal gets', () => {
  // Verbatim from `supabase migration list --linked` outside an agent environment —
  // note a missing side is a backticked space, not an empty cell
  const TABLE = [
    '',
    '  ',
    '   Local | Remote | Time (UTC) ',
    '  -------|--------|------------',
    '   `001` | `001`  | `001`      ',
    '   `028` | `028`  | `028`      ',
    '   `029` | ` `    | `029`      ',
    '   ` `   | `031`  | `031`      ',
    '',
  ].join('\n');

  it('reads synced, pending (local-only) and remote-only rows', () => {
    expect(parseMigrationList(TABLE)).toEqual([row('001', '001'), row('028', '028'), row('029', ''), row('', '031')]);
  });

  it('works end to end with the helpers', () => {
    const rows = parseMigrationList(TABLE);
    expect(pendingMigrations(rows)).toEqual(['029']);
    expect(remoteOnlyMigrations(rows)).toEqual(['031']);
  });

  it('skips the header, the rule and blank lines, and CLI chatter around the table', () => {
    const out = `Initialising login role...\nConnecting to remote database...\n${TABLE}\nA new version is available`;
    expect(parseMigrationList(out)).toHaveLength(4);
  });

  it('prefers JSON when both appear', () => {
    const out = `${TABLE}\n{"migrations":[{"local":"009","remote":"009","time":"009"}]}`;
    expect(parseMigrationList(out)).toEqual([row('009', '009')]);
  });
});

describe('parseMigrationList — when it cannot read the output', () => {
  it('shows what the CLI actually printed, so the next report is actionable', () => {
    expect(() => parseMigrationList('Error: you are not logged in\nRun supabase login')).toThrow(/first 600 characters[\s\S]*not logged in/);
    expect(() => parseMigrationList('')).toThrow(/Could not read the migration list/);
  });

  it('truncates a long dump', () => {
    const err = (() => { try { parseMigrationList('x'.repeat(5000)); } catch (e) { return e as Error; } })()!;
    expect(err.message.length).toBeLessThan(800);
  });
});

describe('pendingMigrations', () => {
  it('lists local files the remote has not recorded', () => {
    expect(pendingMigrations([row('001', '001'), row('002', ''), row('003', '')])).toEqual(['002', '003']);
  });

  it('is empty when history is in sync', () => {
    expect(pendingMigrations([row('001', '001'), row('002', '002')])).toEqual([]);
  });

  it('ignores remote-only entries', () => {
    expect(pendingMigrations([row('', '009'), row('010', '')])).toEqual(['010']);
  });
});

describe('remoteOnlyMigrations', () => {
  it('flags versions dev has that this branch lacks', () => {
    expect(remoteOnlyMigrations([row('001', '001'), row('', '030')])).toEqual(['030']);
    expect(remoteOnlyMigrations([row('001', '001')])).toEqual([]);
  });
});

describe('outOfOrderMigrations', () => {
  it('flags a pending version older than the newest remote one', () => {
    expect(outOfOrderMigrations([row('001', '001'), row('002', ''), row('003', '003')])).toEqual(['002']);
  });

  it('accepts pending versions newer than everything on the remote', () => {
    expect(outOfOrderMigrations([row('001', '001'), row('002', ''), row('003', '')])).toEqual([]);
  });

  it('is empty on a fresh database', () => {
    expect(outOfOrderMigrations([row('001', ''), row('002', '')])).toEqual([]);
  });
});
