import {normalizeName} from './name-normalization';
import { randomUUID } from 'node:crypto';
import { withTenant } from './db';
import { customerSchema, canManageCustomers, countryCodes, countryOptions } from './validation';
import { normalizeCountryCode } from './record-details';
import type { Actor } from './auth';
export type Customer = {
  id: string; reference: string; name: string; entity_type: 'individual' | 'company';
  country: string; email: string | null; industry: string; notes: string;
  date_of_birth: string; identifier: string; nationality: string; delivery_channel: string;
  status: 'draft' | 'awaiting_information';
  screening_status: 'not_run' | 'no_match' | 'screened' | 'potential_match'; risk_level: 'unassessed';
  created_at: Date; updated_at: Date;
  created_by?: string | null;
  creator_name?: string | null;
  monitoring_enabled?: boolean;
  last_monitored_at?: string | null;
  monitoring_status?: 'clear' | 'flagged' | 'pending_review';
  monitoring_hit_count?: number;
  screening_band?: 'high' | 'medium' | 'low' | 'none';
  screening_relevant_count?: number;
  screening_flags?: Record<string, boolean>;
  confirmed_matches_count?: number;
  dismissed_matches_count?: number;
};
// Whitelisted sort orders (never interpolate user input into ORDER BY).
export const CUSTOMER_SORTS: Record<string, string> = {
  recent: 'c.created_at DESC, c.id DESC',
  oldest: 'c.created_at ASC, c.id ASC',
  name: 'c.name ASC',
  name_desc: 'c.name DESC',
  type: "c.entity_type ASC, c.name ASC",
  status: "c.status ASC, c.name ASC",
};
type CustomerListOptions = {
  limit?: number; offset?: number; sort?: string;
  status?: string; screening?: string;
  actorId?: string;
};

const customerStatuses = new Set<Customer['status']>(['draft', 'awaiting_information']);
const screeningStatuses = new Set<Customer['screening_status']>(['not_run', 'no_match', 'screened', 'potential_match']);

export async function listCustomers(organizationId: string, query = '', type = '', opts?: CustomerListOptions): Promise<Customer[]> {
  return withTenant(organizationId, async db => {
    const normalized = normalizeName(query.slice(0,160)).replace(/[\\%_]/g, '\\$&');
    const escaped = query.slice(0, 160).replace(/[\\%_]/g, '\\$&');
    const limit = Math.min(100, Math.max(1, opts?.limit ?? 100));
    const offset = Math.max(0, opts?.offset ?? 0);
    const orderBy = CUSTOMER_SORTS[opts?.sort ?? ''] ?? CUSTOMER_SORTS.recent;
    const status = customerStatuses.has(opts?.status as Customer['status']) ? opts!.status! : '';
    const screening = screeningStatuses.has(opts?.screening as Customer['screening_status']) ? opts!.screening! : '';
    const creatorId = opts?.actorId ?? null;
    const result = await db.query(`SELECT 
      c.*, 
      u.display_name AS creator_name,
      s.overall_band AS screening_band,
      s.relevant_count AS screening_relevant_count,
      s.flags AS screening_flags,
      COALESCE(dec.confirmed_count, 0)::int AS confirmed_matches_count,
      COALESCE(dec.dismissed_count, 0)::int AS dismissed_matches_count
      FROM customers c
      LEFT JOIN users u ON u.id = c.created_by
      LEFT JOIN LATERAL (
        SELECT cs.overall_band, cs.relevant_count, cs.flags
        FROM customer_screenings cs
        WHERE cs.customer_id = c.id
        ORDER BY cs.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) FILTER (WHERE md.decision = 'confirmed') AS confirmed_count,
          COUNT(*) FILTER (WHERE md.decision = 'dismissed') AS dismissed_count
        FROM match_decisions md
        WHERE md.customer_id = c.id
      ) dec ON true
      WHERE c.organization_id=$1
      AND ($2='' OR ($4<>'' AND c.normalized_name LIKE '%' || $4 || '%') OR c.name ILIKE '%' || $2 || '%' OR c.reference ILIKE '%' || $2 || '%')
      AND ($3='' OR c.entity_type=$3)
      AND ($5='' OR c.status=$5)
      AND ($6='' OR c.screening_status=$6)
      AND ($9::uuid IS NULL OR c.created_by=$9)
      ORDER BY ${orderBy} LIMIT $7 OFFSET $8`, [organizationId, escaped, ['company', 'individual'].includes(type) ? type : '', normalized, status, screening, limit, offset, creatorId]);
    return result.rows;
  });
}
export async function countCustomers(organizationId: string, query = '', type = '', opts?: Pick<CustomerListOptions, 'status' | 'screening' | 'actorId'>): Promise<number> {
  return withTenant(organizationId, async db => {
    const normalized = normalizeName(query.slice(0,160)).replace(/[\\%_]/g, '\\$&');
    const escaped = query.slice(0, 160).replace(/[\\%_]/g, '\\$&');
    const status = customerStatuses.has(opts?.status as Customer['status']) ? opts!.status! : '';
    const screening = screeningStatuses.has(opts?.screening as Customer['screening_status']) ? opts!.screening! : '';
    const creatorId = opts?.actorId ?? null;
    const result = await db.query(`SELECT count(*)::int AS n FROM customers WHERE organization_id=$1
      AND ($2='' OR ($4<>'' AND normalized_name LIKE '%' || $4 || '%') OR name ILIKE '%' || $2 || '%' OR reference ILIKE '%' || $2 || '%')
      AND ($3='' OR entity_type=$3)
      AND ($5='' OR status=$5)
      AND ($6='' OR screening_status=$6)
      AND ($7::uuid IS NULL OR created_by=$7)`, [organizationId, escaped, ['company', 'individual'].includes(type) ? type : '', normalized, status, screening, creatorId]);
    return result.rows[0].n as number;
  });
}
export async function findMatchingExistingCustomer(organizationId: string, query: string): Promise<Customer | null> {
  const clean = query.trim();
  if (clean.length < 2) return null;
  const norm = normalizeName(clean);
  return withTenant(organizationId, async db => {
    // 1. Exact match on normalized_name, exact name, or reference
    const exact = await db.query(
      `SELECT c.*, u.display_name AS creator_name FROM customers c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.organization_id = $1
         AND (
           (c.normalized_name IS NOT NULL AND c.normalized_name <> '' AND c.normalized_name = $2)
           OR lower(c.name) = lower($3)
           OR lower(c.reference) = lower($3)
         )
       ORDER BY c.created_at DESC LIMIT 1`,
      [organizationId, norm, clean]
    );
    if (exact.rowCount && exact.rowCount > 0) return exact.rows[0];

    // 2. High similarity match (strictly >= 80% similarity between normalized names)
    if (norm.length >= 3) {
      const similar = await db.query(
        `SELECT c.*, u.display_name AS creator_name, similarity(c.normalized_name, $2) as sim FROM customers c
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.organization_id = $1
           AND c.normalized_name IS NOT NULL
           AND length(c.normalized_name) >= 3
           AND similarity(c.normalized_name, $2) >= 0.80
         ORDER BY similarity(c.normalized_name, $2) DESC, c.created_at DESC LIMIT 1`,
        [organizationId, norm]
      );
      if (similar.rowCount && similar.rowCount > 0) {
        const row = similar.rows[0];
        if (Number(row.sim) >= 0.80) {
          return row;
        }
      }
    }
    return null;
  });
}

export async function getCustomer(organizationId: string, id: string, actorId?: string): Promise<Customer | null> {
  return withTenant(organizationId, async db => {
    const result = await db.query(`SELECT 
      c.*, 
      u.display_name AS creator_name,
      s.overall_band AS screening_band,
      s.relevant_count AS screening_relevant_count,
      s.flags AS screening_flags,
      COALESCE(dec.confirmed_count, 0)::int AS confirmed_matches_count,
      COALESCE(dec.dismissed_count, 0)::int AS dismissed_matches_count
      FROM customers c
      LEFT JOIN users u ON u.id = c.created_by
      LEFT JOIN LATERAL (
        SELECT cs.overall_band, cs.relevant_count, cs.flags
        FROM customer_screenings cs
        WHERE cs.customer_id = c.id
        ORDER BY cs.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) FILTER (WHERE md.decision = 'confirmed') AS confirmed_count,
          COUNT(*) FILTER (WHERE md.decision = 'dismissed') AS dismissed_count
        FROM match_decisions md
        WHERE md.customer_id = c.id
      ) dec ON true
      WHERE c.organization_id=$1 AND c.id=$2
      AND ($3::uuid IS NULL OR c.created_by=$3)`, [organizationId, id, actorId ?? null]);
    return result.rows[0] ?? null;
  });
}
// Resolve by the readable reference (KYC-XXXX) used in URLs, or by uuid for backward-compatible links.
export async function getCustomerByHandle(organizationId: string, handle: string, actorId?: string): Promise<Customer | null> {
  const byId = /^[0-9a-fA-F-]{36}$/.test(handle);
  return withTenant(organizationId, async db => {
    const result = byId
      ? await db.query(`SELECT 
          c.*, 
          u.display_name AS creator_name,
          s.overall_band AS screening_band,
          s.relevant_count AS screening_relevant_count,
          s.flags AS screening_flags,
          COALESCE(dec.confirmed_count, 0)::int AS confirmed_matches_count,
          COALESCE(dec.dismissed_count, 0)::int AS dismissed_matches_count
          FROM customers c
          LEFT JOIN users u ON u.id = c.created_by
          LEFT JOIN LATERAL (
            SELECT cs.overall_band, cs.relevant_count, cs.flags
            FROM customer_screenings cs
            WHERE cs.customer_id = c.id
            ORDER BY cs.created_at DESC
            LIMIT 1
          ) s ON true
          LEFT JOIN LATERAL (
            SELECT 
              COUNT(*) FILTER (WHERE md.decision = 'confirmed') AS confirmed_count,
              COUNT(*) FILTER (WHERE md.decision = 'dismissed') AS dismissed_count
            FROM match_decisions md
            WHERE md.customer_id = c.id
          ) dec ON true
          WHERE c.organization_id=$1 AND c.id=$2
          AND ($3::uuid IS NULL OR c.created_by=$3)`, [organizationId, handle, actorId ?? null])
      : await db.query(`SELECT 
          c.*, 
          u.display_name AS creator_name,
          s.overall_band AS screening_band,
          s.relevant_count AS screening_relevant_count,
          s.flags AS screening_flags,
          COALESCE(dec.confirmed_count, 0)::int AS confirmed_matches_count,
          COALESCE(dec.dismissed_count, 0)::int AS dismissed_matches_count
          FROM customers c
          LEFT JOIN users u ON u.id = c.created_by
          LEFT JOIN LATERAL (
            SELECT cs.overall_band, cs.relevant_count, cs.flags
            FROM customer_screenings cs
            WHERE cs.customer_id = c.id
            ORDER BY cs.created_at DESC
            LIMIT 1
          ) s ON true
          LEFT JOIN LATERAL (
            SELECT 
              COUNT(*) FILTER (WHERE md.decision = 'confirmed') AS confirmed_count,
              COUNT(*) FILTER (WHERE md.decision = 'dismissed') AS dismissed_count
            FROM match_decisions md
            WHERE md.customer_id = c.id
          ) dec ON true
          WHERE c.organization_id=$1 AND c.reference=$2
          AND ($3::uuid IS NULL OR c.created_by=$3)`, [organizationId, handle.toUpperCase(), actorId ?? null]);
    return result.rows[0] ?? null;
  });
}
export async function createCustomer(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, raw: unknown) {
  if (!canManageCustomers(actor.role)) throw new Error('FORBIDDEN');
  const input = customerSchema.parse(raw);
  return withTenant(actor.organizationId, async db => {
    const reference = `KYC-${randomUUID().slice(0,8).toUpperCase()}`;
    const result = await db.query(`INSERT INTO customers
      (organization_id,reference,name,entity_type,country,email,industry,notes,date_of_birth,identifier,nationality,delivery_channel,created_by,normalized_name)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [actor.organizationId, reference, input.name, input.entityType, input.country, input.email || null, input.industry, input.notes, input.dateOfBirth, input.identifier, input.nationality, input.deliveryChannel, actor.id, normalizeName(input.name)]);
    const id = result.rows[0].id as string;
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary)
      VALUES ($1,$2,$3,'customer.created','تم إنشاء ملف العميل كمسودة؛ لم يُنفذ فحص بعد')`, [actor.organizationId, actor.id, id]);
    return { id, reference };
  });
}
export async function updateCustomer(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, id: string, raw: unknown) {
  if (!canManageCustomers(actor.role)) throw new Error('FORBIDDEN');
  const input = customerSchema.parse(raw);
  return withTenant(actor.organizationId, async db => {
    const before = (await db.query('SELECT reference,name,entity_type,country,email,industry,date_of_birth,identifier,notes,created_by FROM customers WHERE organization_id=$1 AND id=$2', [actor.organizationId, id])).rows[0];
    if (!before) throw new Error('NOT_FOUND');
    if (actor.role !== 'admin' && before.created_by && before.created_by !== actor.id) {
      throw new Error('FORBIDDEN_NOT_CREATOR');
    }
    await db.query(`UPDATE customers SET name=$3,entity_type=$4,country=$5,email=$6,industry=$7,date_of_birth=$8,identifier=$9,notes=$10,nationality=$12,delivery_channel=$13,normalized_name=$11,updated_at=now() WHERE organization_id=$1 AND id=$2`,
      [actor.organizationId, id, input.name, input.entityType, input.country, input.email || null, input.industry, input.dateOfBirth, input.identifier, input.notes, normalizeName(input.name), input.nationality, input.deliveryChannel]);
    // Log exactly what changed; flag identity changes so the analyst knows to re-screen.
    const cmp: [string, string, string][] = [['الاسم', before.name, input.name], ['النوع', before.entity_type, input.entityType], ['الدولة', before.country, input.country], ['البريد', before.email || '', input.email || ''], ['النشاط', before.industry, input.industry], ['تاريخ الميلاد', before.date_of_birth, input.dateOfBirth], ['المعرّف', before.identifier, input.identifier], ['الملاحظات', before.notes, input.notes]];
    const changed = cmp.filter(([, a, b]) => (a || '') !== (b || '')).map(([label]) => label);
    const identityChanged = before.name !== input.name || (before.date_of_birth || '') !== input.dateOfBirth || (before.identifier || '') !== input.identifier;
    await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary) VALUES ($1,$2,$3,'customer.updated',$4)`,
      [actor.organizationId, actor.id, id, changed.length ? `عُدّل الملف — ${changed.join('، ')}${identityChanged ? ' · تغيّرت بيانات الهوية؛ يُنصح بإعادة الفحص' : ''}` : 'حُفظ الملف دون تغييرات']);
    return before.reference as string;
  });
}
export async function deleteCustomer(actor: Pick<Actor, 'id' | 'organizationId' | 'role'>, customerId: string) {
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  return withTenant(actor.organizationId, async db => {
    const customer = (await db.query('SELECT reference, name FROM customers WHERE organization_id=$1 AND id=$2', [actor.organizationId, customerId])).rows[0];
    if (!customer) throw new Error('NOT_FOUND');

    await db.query('DELETE FROM match_decisions WHERE organization_id=$1 AND customer_id=$2', [actor.organizationId, customerId]);
    await db.query('DELETE FROM review_cases WHERE organization_id=$1 AND customer_id=$2', [actor.organizationId, customerId]);
    await db.query('DELETE FROM customer_screenings WHERE organization_id=$1 AND customer_id=$2', [actor.organizationId, customerId]);
    await db.query('DELETE FROM customers WHERE organization_id=$1 AND id=$2', [actor.organizationId, customerId]);

    await db.query(`INSERT INTO audit_events(organization_id,actor_id,customer_id,action,summary)
      VALUES ($1,$2,NULL,'customer.deleted',$3)`,
      [actor.organizationId, actor.id, `حذف المدير ملف العميل: ${customer.name} (${customer.reference})`]);

    return { reference: customer.reference as string, name: customer.name as string };
  });
}
export async function getStats(organizationId: string, actorId?: string) {
  return withTenant(organizationId, async db => {
    const result = await db.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE entity_type='company')::int AS companies,
      count(*) FILTER (WHERE entity_type='individual')::int AS individuals,
      count(*) FILTER (WHERE status='awaiting_information')::int AS awaiting,
      count(*) FILTER (WHERE screening_status<>'not_run')::int AS screened,
      count(*) FILTER (WHERE screening_status='potential_match')::int AS potential
      FROM customers WHERE organization_id=$1
      AND ($2::uuid IS NULL OR created_by=$2)`, [organizationId, actorId ?? null]);
    return result.rows[0] as {total: number; companies: number; individuals: number; awaiting: number; screened: number; potential: number};
  });
}
export type Activity = {id: string; summary: string; action: string; customer_id: string | null; created_at: Date; actor_id?: string; actor_name?: string};
export async function getActivity(organizationId: string, customerId?: string, actorId?: string): Promise<Activity[]> {
  return withTenant(organizationId, async db => {
    const result = await db.query(`SELECT a.*, u.display_name AS actor_name FROM audit_events a
      LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.organization_id=$1
      AND ($2::uuid IS NULL OR a.customer_id=$2)
      AND ($3::uuid IS NULL OR a.actor_id=$3)
      ORDER BY a.created_at DESC LIMIT 12`, [organizationId, customerId ?? null, actorId ?? null]);
    return result.rows;
  });
}

export type EnrichedFields = {
  country?: string;
  nationality?: string;
  date_of_birth?: string;
  identifier?: string;
};

export async function enrichCustomerFromMatch(
  organizationId: string,
  actorId: string,
  customerId: string,
  matchData: {
    country?: string | null;
    dob?: string | null;
    identifier?: string | null;
    sourceName?: string | null;
  }
): Promise<{ enriched: boolean; fields: EnrichedFields }> {
  return withTenant(organizationId, async db => {
    const custRes = await db.query(
      `SELECT id, reference, name, country, nationality, date_of_birth, identifier
       FROM customers WHERE organization_id = $1 AND id = $2`,
      [organizationId, customerId]
    );
    const customer = custRes.rows[0];
    if (!customer) return { enriched: false, fields: {} };

    const updates: Record<string, string> = {};
    const auditChanges: string[] = [];

    // 1. Country: only fill if empty or placeholder
    const isPlaceholderCountry = !customer.country || ['OTHER', 'XX', 'ZZ', 'OT'].includes(String(customer.country).toUpperCase());
    if (isPlaceholderCountry && matchData.country) {
      const code = normalizeCountryCode(matchData.country) || matchData.country.trim().toUpperCase();
      if ((countryOptions as readonly string[]).includes(code)) {
        updates.country = code;
        auditChanges.push(`الدولة (${code})`);
      }
    }

    // 2. Nationality: only fill if empty or placeholder (individuals only)
    const hasNationality = !!(customer.nationality && customer.nationality.trim());
    if (customer.entity_type !== 'company' && !hasNationality && (matchData.country || updates.country)) {
      const natCandidate = updates.country || matchData.country;
      const natCode = normalizeCountryCode(natCandidate) || natCandidate?.trim().toUpperCase();
      if (natCode && (countryCodes as readonly string[]).includes(natCode)) {
        updates.nationality = natCode;
        auditChanges.push(`الجنسية (${natCode})`);
      }
    }

    // 3. Date of birth: only fill if empty
    const hasDob = !!(customer.date_of_birth && customer.date_of_birth.trim() && customer.date_of_birth !== 'لم يُضَف');
    if (!hasDob && matchData.dob && matchData.dob.trim()) {
      const cleanDob = matchData.dob.trim().slice(0, 40);
      updates.date_of_birth = cleanDob;
      auditChanges.push(`تاريخ الميلاد (${cleanDob})`);
    }

    // 4. Identifier: only fill if empty
    const hasId = !!(customer.identifier && customer.identifier.trim() && customer.identifier !== 'لم يُضَف');
    if (!hasId && matchData.identifier && matchData.identifier.trim()) {
      const cleanId = matchData.identifier.trim().slice(0, 80);
      updates.identifier = cleanId;
      auditChanges.push(`المعرّف (${cleanId})`);
    }

    if (Object.keys(updates).length === 0) {
      return { enriched: false, fields: {} };
    }

    const setClauses: string[] = ['updated_at = now()'];
    const values: unknown[] = [organizationId, customerId];
    let idx = 3;

    for (const [col, val] of Object.entries(updates)) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(val);
    }

    await db.query(
      `UPDATE customers SET ${setClauses.join(', ')} WHERE organization_id = $1 AND id = $2`,
      values
    );

    const sourceContext = matchData.sourceName ? ` استنادًا إلى سجل «${matchData.sourceName}»` : '';
    await db.query(
      `INSERT INTO audit_events(organization_id, actor_id, customer_id, action, summary)
       VALUES ($1, $2, $3, 'customer.enriched', $4)`,
      [
        organizationId,
        actorId,
        customerId,
        `تم استكمال بيانات العميل تلقائيًا${sourceContext}: ${auditChanges.join('، ')}`
      ]
    );

    return { enriched: true, fields: updates };
  });
}

