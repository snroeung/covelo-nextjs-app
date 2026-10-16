import { describe, it, expect } from 'vitest';
import {
  parseMigrationList, pendingMigrations, remoteOnlyMigrations, outOfOrderMigrations, type MigrationRow,
} from '../scripts/db-push-dev/history';

const row = (local: string, remote: string): MigrationRow => ({ local, remote, time: local || remote });

describe('parseMigrationList', () => {
  it('finds the JSON line among CLI progress output', () => {
    const out = [
      'Initialising login role...',
      'Connecting to remote database...',
      '{"migrations":[{"local":"001","remote":"001","time":"001"},{"local":"002","remote":"","time":"002"}],"message":"Migrations listed"}',
      'A new version of Supabase CLI is available',
    ].join('\n');
    expect(parseMigrationList(out)).toEqual([row('001', '001'), row('002', '')]);
  });

  it('throws a clear error when there is no migration list', () => {
    expect(() => parseMigrationList('Connecting…\nError: not logged in')).toThrow(/migration list JSON/);
    expect(() => parseMigrationList('{"migrations":"nope"}')).toThrow(/Unexpected migration list shape/);
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
