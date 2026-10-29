// Picking a transfer partner and an issuer in either order. Partners are
// stored per issuer ("American AAdvantage" is a Bilt partner only), so a form
// that makes you choose the issuer first hides programs you came looking for.

import type { PortalId } from "./types";
import type { TransferPartnerConfig } from "./transferPartners";

export type PartnerMap = Partial<Record<PortalId, TransferPartnerConfig[]>>;

export interface PartnerOption extends TransferPartnerConfig {
  /** Issuers that transfer to this program, in the map's order */
  issuers: PortalId[];
}

/** Every program once, with the issuers that reach it. Sorted by name. */
export function allPartnerOptions(map: PartnerMap | undefined): PartnerOption[] {
  const byProgram = new Map<string, PartnerOption>();
  for (const [issuer, list] of Object.entries(map ?? {}) as Array<[PortalId, TransferPartnerConfig[]]>) {
    for (const p of list) {
      const hit = byProgram.get(p.program);
      if (hit) hit.issuers.push(issuer);
      else byProgram.set(p.program, { ...p, issuers: [issuer] });
    }
  }
  return [...byProgram.values()].sort((a, b) => a.program.localeCompare(b.program));
}

/** One issuer's partners; with no issuer, every partner. */
export function partnersForIssuer(map: PartnerMap | undefined, issuer: PortalId | ""): PartnerOption[] {
  const all = allPartnerOptions(map);
  if (!issuer) return all;
  return all.filter((p) => p.issuers.includes(issuer)).map((p) => ({ ...p, ...(map?.[issuer]?.find((q) => q.program === p.program) ?? {}) }));
}

/** Issuers that can be chosen alongside a partner; all of them when no partner is picked. */
export function issuersForPartner(map: PartnerMap | undefined, program: string, all: readonly PortalId[]): PortalId[] {
  if (!program) return [...all];
  const hit = allPartnerOptions(map).find((p) => p.program === program);
  return hit ? all.filter((i) => hit.issuers.includes(i)) : [...all];
}

/** The issuer to fill in once a partner is picked first: only when exactly one reaches it. */
export function soleIssuer(map: PartnerMap | undefined, program: string): PortalId | "" {
  const hit = allPartnerOptions(map).find((p) => p.program === program);
  return hit && hit.issuers.length === 1 ? hit.issuers[0] : "";
}

/** "[Airline] American AAdvantage (1:1)" for one issuer, "… · Bilt, Citi" across several. */
export function partnerLabel(p: PartnerOption, issuer: PortalId | "", issuerName: (i: PortalId) => string): string {
  const kind = p.type === "hotel" ? "Hotel" : "Airline";
  return issuer ? `[${kind}] ${p.program} (${p.ratio})` : `[${kind}] ${p.program} · ${p.issuers.map(issuerName).join(", ")}`;
}
