import { withTenant } from './db';
import { getCustomer, enrichCustomerFromMatch } from './customers';
import { searchPublicSources, searchCoverage } from './search';
import { loadCategories, classifyMatch, assess, type ClassifiedMatch, type RiskBand } from './risk';
import { adverseMediaSearch, type AdverseArticle } from './adverse-media';
import { canManageCustomers } from './validation';
import type { Actor } from './auth';
import { extractRecordCountry, extractRecordDob, extractRecordIdentifier, extractRecordAliases } from './record-details';

const RANK: Record<RiskBand, number> = { high: 3, medium: 2, low: 1 };
const digitsOnly = (s: string) => (s || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
const yearOf = (s: string) => (s.match(/\d{4}/) || [])[0];

// A company foundation year is not a person's date of birth.  Identity evidence must
// only be compared against fields that describe the same type of customer.
function identityYears(details: unknown, entityType: 'individual'|'company'): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries((details ?? {}) as Record<string, unknown>)) {
    const matchesIdentityField = entityType === 'company'
      ? /incorporat|found|establish|formation|inception/i.test(k)
      : /birth|dob|born/i.test(k);
    if (!matchesIdentityField) continue;
    const arr = Array.isArray(v) ? v.map(String) : [String(v)];
    for (const s of arr) for (const y of s.match(/\d{4}/g) ?? []) out.push(y);
  }
  return out;
}
// Whole, normalised legal identifiers only.  List/programme IDs such as
// AE-UNSC1373 are deliberately excluded: they identify a sanctions listing, not a customer.
function idTokens(details: unknown): Set<string> {
  const out = new Set<string>();
  const legalKey = /identif|passport|document|uid|registrat|\blei\b|national|tax.?number|company.?number|id.?number/i;
  const excludedKey = /program|sanction|listing|authority|referent|entity/i;
  const add = (value: unknown) => {
    const values = Array.isArray(value) ? value : [value];
    for (const value of values) if (typeof value === 'string' || typeof value === 'number') {
      for (const token of String(value).split(/[;,\s/|]+/)) { const normal = digitsOnly(token); if (normal.length >= 5) out.add(normal); }
    }
  };
  const visit = (value: unknown, permitted = false) => {
    if (Array.isArray(value)) return value.forEach(item => visit(item, permitted));
    if (!value || typeof value !== 'object') { if (permitted) add(value); return; }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const allowed = !excludedKey.test(key) && (permitted || legalKey.test(key));
      if (child && typeof child === 'object') visit(child, allowed);
      else if (allowed) add(child);
    }
  };
  visit(details);
  return out;
}

// OpenSanctions records can represent the same real-world entity in several list
// exports.  The nested entity key lets us show one candidate with its source evidence,
// instead of presenting each list as a separate customer match.
function canonicalEntityKey(details: unknown, fallback: string): string {
  const sanctions = (details as Record<string, unknown> | null)?.sanctions;
  if (Array.isArray(sanctions)) for (const sanction of sanctions) {
    const entity = (sanction as {properties?: {entity?: unknown}})?.properties?.entity;
    const value = Array.isArray(entity) ? entity[0] : entity;
    if (typeof value === 'string' && value.trim()) return `entity:${value}`;
  }
  return `record:${fallback}`;
}

type SourceEvidence = { code:string; source:string; recordId:string };

export type ScreenedMatch = { r: import('./search').SearchResult; c: ClassifiedMatch; dobMatch: boolean; idMatch: boolean; dobConflict: boolean; entityKey:string; sources:SourceEvidence[] };
export type ScreeningResult = {
  customer: NonNullable<Awaited<ReturnType<typeof getCustomer>>>;
  matches: ScreenedMatch[];
  overall: ReturnType<typeof assess>;
  usedDob: boolean; usedIdentifier: boolean;
};

// Screen by name, with entity-appropriate identity evidence when it is available.
export async function screenCustomer(actor: Pick<Actor, 'organizationId'> & Partial<Pick<Actor, 'id' | 'role'>>, customerId: string): Promise<ScreeningResult> {
  if (actor.role && !canManageCustomers(actor.role)) throw new Error('FORBIDDEN');
  const actorId = actor.role === 'admin' ? undefined : actor.id;
  const customer = await getCustomer(actor.organizationId, customerId, actorId);
  if (!customer) throw new Error('NOT_FOUND');
  // Evaluate a wide candidate set (not the UI's 51-row display cap) so a real hit is never cut off.
  const [results, catMap] = await Promise.all([searchPublicSources(customer.name, 300), loadCategories()]);
  const custYear = yearOf(customer.date_of_birth || '');
  const custId = digitsOnly(customer.identifier || '');
  const usedIdentifier = custId.length >= 5;
  const candidates = results.map(r => {
    const years = custYear ? identityYears(r.details, customer.entity_type) : [];
    const dobMatch = !!custYear && years.includes(custYear);
    const dobConflict = !!custYear && years.length > 0 && !dobMatch;     // record has a birth year, none match
    const idMatch = usedIdentifier && idTokens(r.details).has(custId);
    const demote = dobConflict && !idMatch;                             // contradicting DOB, no identifier support
    const c = classifyMatch(r.code, r.match_kind, r.name_similarity, catMap, { strongId: idMatch || dobMatch, demote, details: r.details });
    return { r, c, dobMatch, idMatch, dobConflict, entityKey: canonicalEntityKey(r.details, r.id), sources:[{code:r.code, source:c.sourceTitle, recordId:r.id}] };
  }).sort((a, b) => RANK[b.c.band] - RANK[a.c.band] || b.c.percent - a.c.percent);
  const grouped = new Map<string, ScreenedMatch>();
  for (const candidate of candidates) {
    const current = grouped.get(candidate.entityKey);
    if (!current) { grouped.set(candidate.entityKey, candidate); continue; }
    const sources = [...current.sources, ...candidate.sources];
    const candidateWins = RANK[candidate.c.band] > RANK[current.c.band] || (candidate.c.band === current.c.band && candidate.c.percent > current.c.percent);
    if (candidateWins) grouped.set(candidate.entityKey, {...candidate, sources});
    else current.sources = sources;
  }
  const matches = [...grouped.values()].sort((a, b) => RANK[b.c.band] - RANK[a.c.band] || b.c.percent - a.c.percent);
  const overall = assess(matches.map(m => m.c));
  return { customer, matches, overall, usedDob: !!custYear, usedIdentifier };
}

const STATUS_BY_BAND: Record<string, string> = { none: 'no_match', low: 'screened', medium: 'potential_match', high: 'potential_match' };

// Run the screening and persist the outcome onto the customer profile (risk_level stays unassessed).
export async function runAndSaveScreening(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, customerId: string) {
  if (!canManageCustomers(actor.role)) throw new Error('FORBIDDEN');
  const { customer, matches, overall, usedDob, usedIdentifier } = await screenCustomer(actor, customerId);
  // Capture an adverse-media scan at screening time (stored with the run). Never fails the screening.
  const adverse = await adverseMediaSearch(customer.name).catch(() => ({ status: 'failed' as const, articles: [] as never[], retrievedAt: undefined }));
  const adverseStore = { status: adverse.status, count: adverse.articles.length, articles: adverse.articles.slice(0, 10), retrievedAt: adverse.retrievedAt };
  const status = STATUS_BY_BAND[overall.band] ?? 'screened';
  const top = matches.slice(0, 100).map(({ r, c, dobMatch, idMatch, dobConflict, sources }) => ({
    name: r.name, code: r.code, source: c.sourceTitle, category: c.category,
    categoryLabel: c.categoryLabel, band: c.band, bandLabel: c.bandLabel, percent: c.percent,
    recordId: r.id, dobMatch, idMatch, dobConflict, sourceCount: sources.length, relatedSources: sources,
    sourceRecordId: r.source_record_id,
    recordCountry: extractRecordCountry(r.details),
    recordDob: extractRecordDob(r.details),
    recordIdNumber: extractRecordIdentifier(r.details, r.source_record_id),
    recordAliases: extractRecordAliases(r),
  }));
  // Fingerprint the source lists in effect now, so the report can be reproduced later.
  const versions = (await searchCoverage()).map(v => ({ code: v.code, sha256: v.sha256, retrieved_at: v.retrieved_at, record_count: v.record_count }));
  await withTenant(actor.organizationId, async db => {
    const screening = await db.query(`INSERT INTO customer_screenings
      (organization_id,customer_id,run_by,overall_band,flags,match_count,relevant_count,used_dob,used_identifier,top_matches,source_versions,adverse_media)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [actor.organizationId, customerId, actor.id, overall.band, JSON.stringify(overall.flags),
       overall.total, overall.relevant, usedDob, usedIdentifier, JSON.stringify(top), JSON.stringify(versions), JSON.stringify(adverseStore)]);
    if (overall.relevant > 0) {
      const priority = overall.band === 'high' ? 'high' : overall.band === 'medium' ? 'medium' : 'low';
      // Keep one active case per customer: re-point the open/in-review case at the
      // latest screening (preserving its owner) instead of stacking a duplicate.
      const reopened = await db.query(`UPDATE review_cases SET screening_id=$3, priority=$4, updated_at=now()
        WHERE organization_id=$1 AND customer_id=$2 AND status<>'resolved' RETURNING id`,
        [actor.organizationId, customerId, screening.rows[0].id, priority]);
      if (!reopened.rowCount) await db.query(`INSERT INTO review_cases
        (organization_id,customer_id,screening_id,priority) VALUES ($1,$2,$3,$4)`,
        [actor.organizationId, customerId, screening.rows[0].id, priority]);
    }
    await db.query('UPDATE customers SET screening_status=$2, updated_at=now() WHERE id=$1', [customerId, status]);
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary)
      VALUES ($1,$2,$3,'customer.screened',$4)`,
      [actor.organizationId, actor.id, customerId, `فُحص العميل — ${overall.determination}`]);
  });
  if (top.length > 0) {
    const topCandidate = top[0];
    if (topCandidate.band === 'high' || topCandidate.percent >= 80) {
      await enrichCustomerFromMatch(actor.organizationId, actor.id, customerId, {
        country: topCandidate.recordCountry,
        dob: topCandidate.recordDob,
        identifier: topCandidate.recordIdNumber,
        sourceName: topCandidate.name || topCandidate.source,
      }).catch(() => null);
    }
  }
  return status;
}

export type ScreeningMatchItem = {
  name: string; code?: string; source: string; category: string; categoryLabel: string;
  band: string; bandLabel: string; percent: number; recordId: string;
  dobMatch: boolean; idMatch: boolean; dobConflict: boolean;
  sourceCount?: number; relatedSources?: SourceEvidence[];
  sourceRecordId?: string;
  recordCountry?: string | null;
  recordDob?: string | null;
  recordIdNumber?: string | null;
  recordAliases?: string[];
};

export type ScreeningRow = {
  id: string; overall_band: string; flags: Record<string, boolean>;
  match_count: number; relevant_count: number; used_dob: boolean; used_identifier: boolean;
  top_matches: ScreeningMatchItem[];
  source_versions: { code: string; sha256: string; retrieved_at: Date; record_count: number }[];
  adverse_media: { status: string; count: number; articles: AdverseArticle[]; retrievedAt?: string } | null;
  created_at: Date;
};
export async function getLastScreening(organizationId: string, customerId: string): Promise<ScreeningRow | null> {
  return withTenant(organizationId, async db => {
    const r = await db.query('SELECT * FROM customer_screenings WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 1', [customerId]);
    return r.rows[0] ?? null;
  });
}
