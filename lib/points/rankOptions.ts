import type { PointsResult, PortalGroup, TransferResult } from './types';

export type RankedOption =
  | { kind: 'portal'; key: string; cpp: number; group: PortalGroup }
  | { kind: 'transfer'; key: string; cpp: number; transfer: TransferResult };

/** Merges portal groups + transfer alternatives into one list, ranked by ¢/pt (best first). */
export function rankOptions(result: PointsResult): RankedOption[] {
  const portalRows: RankedOption[] = result.portalGroups
    .filter(g => g.results[0])
    .map(g => ({ kind: 'portal', key: g.portalId, cpp: g.results[0].centsPerPoint, group: g }));
  const transferRows: RankedOption[] = result.transferAlternatives.map((t, i) => ({
    kind: 'transfer',
    key: `${t.sourcePortalId}-${t.partnerProgram}-${i}`,
    cpp: t.transferCpp ?? -Infinity,
    transfer: t,
  }));
  return [...portalRows, ...transferRows].sort((a, b) => b.cpp - a.cpp);
}

export function getBestOption(result: PointsResult | null | undefined): RankedOption | null {
  return result ? (rankOptions(result)[0] ?? null) : null;
}
