import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Info, ShieldAlert, User, Languages, FileCode, Building2, UserPlus } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { getSourceRecord } from '@/lib/search';
import { loadCategories, categoryOf } from '@/lib/risk';
import { uuidSchema, canManageCustomers } from '@/lib/validation';
import { getMessages, getLocale } from '@/lib/i18n';
import { extractRecordCountry } from '@/lib/record-details';
import { createCustomerFromSourceRecordAction } from '@/app/actions';
import { SourceRecordDetails } from '@/components/source-record-details';

export default async function SourceDetail({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const actor = await requireActor();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(id).success) notFound();
  const r = await getSourceRecord(id);
  if (!r) notFound();

  const [catMap, m, locale] = await Promise.all([loadCategories(), getMessages(), getLocale()]);
  const category = categoryOf(r.code, catMap);
  const isAdmin = actor.role === 'admin';
  const catLabel = ({
    sanctions: m.catSanctions,
    pep: m.catPep,
    crime: m.catCrime,
    debarment: m.catDebarment,
    regulatory: m.catRegulatory,
    other: m.catOther
  } as Record<string, string>)[category] ?? category;

  const returnTo = search.returnTo && search.returnTo.startsWith('/') && !search.returnTo.startsWith('//') && !search.returnTo.startsWith('/\\') ? search.returnTo : '/search';
  const returnLabel = returnTo.startsWith('/profiles') ? m.backToProfile : m.recBackSearch;

  // Determine entity icon based on schema or category
  const schemaType = String(r.details?.schema || (r.details?._provenance as Record<string, unknown> | undefined)?.schema || '');
  const isCompany = /company|organization|legalentity/i.test(schemaType);
  const primaryAlias = Array.isArray(r.aliases) && r.aliases.length > 0 ? r.aliases[0] : null;

  return (
    <div className="source-record-page">
      {/* Back navigation */}
      <div className="source-back-bar">
        <Link href={returnTo} className="back-nav-btn">
          <ArrowRight size={16} aria-hidden="true" />
          <span>{returnLabel}</span>
        </Link>
      </div>

      {/* Entity Hero Card */}
      <div className="source-hero-card">
        <div className="source-hero-top">
          <div className={`source-entity-avatar ${category}`} aria-hidden="true">
            {category === 'sanctions' ? (
              <ShieldAlert size={26} />
            ) : isCompany ? (
              <Building2 size={26} />
            ) : (
              <User size={26} />
            )}
          </div>
          <div className="source-hero-main">
            <div className="source-hero-chips">
              <span className="dataset-chip mono">{r.code}</span>
              <span className="source-ref-chip mono" title={r.source_record_id}>
                {r.source_record_id}
              </span>
              <span className={`cat-badge ${category}`}>
                {catLabel}
              </span>
            </div>
            <h1 className="source-hero-title" dir="auto">{r.name}</h1>
            {primaryAlias && primaryAlias !== r.name && (
              <div className="source-hero-alias" dir="auto">
                <Languages size={15} aria-hidden="true" />
                <span>{primaryAlias}</span>
              </div>
            )}
            <p className="source-hero-disclaimer">
              <Info size={14} aria-hidden="true" />
              <span>{m.recFromSource}</span>
            </p>
          </div>
          <div className="source-hero-actions">
            {canManageCustomers(actor.role) ? (
              <>
                <form action={createCustomerFromSourceRecordAction} className="inline-form">
                  <input type="hidden" name="recordId" value={r.id} />
                  <button type="submit" className="button primary source-add-btn">
                    <UserPlus size={16} aria-hidden="true" />
                    <span>{locale === 'en' ? 'Add to My Customers' : '➕ إضافة إلى ملفات عملائي'}</span>
                  </button>
                </form>
                <Link
                  href={`/profiles/new?name=${encodeURIComponent(r.name)}&type=${isCompany ? 'company' : 'individual'}&country=${extractRecordCountry(r.details) || ''}&sourceRecordId=${encodeURIComponent(r.code + ':' + r.source_record_id)}`}
                  className="button secondary"
                  title={locale === 'en' ? 'Customize data before adding' : 'تخصيص البيانات قبل الإضافة'}
                >
                  <span>{locale === 'en' ? 'Customize & Add' : 'تخصيص قبل الإضافة'}</span>
                </Link>
              </>
            ) : (
              <span className="small-tag text-muted">{locale === 'en' ? 'View-only mode' : 'للاطلاع فقط'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Advisory Notice Banner */}
      <div className="source-advisory-banner">
        <Info size={19} className="advisory-icon" aria-hidden="true" />
        <p className="advisory-text">{m.recInfo}</p>
      </div>

      {/* Structured Details Sections */}
      <SourceRecordDetails details={r.details || {}} aliases={r.aliases || []} isAdmin={isAdmin} m={m} locale={locale} />

      {/* Technical Reference (Admin Only) */}
      {isAdmin && (
        <section className="panel source-section-panel tech-ref-panel">
          <details className="collapsible">
            <summary>
              <span className="summary-title-with-icon">
                <FileCode size={17} aria-hidden="true" />
                <span>{m.recTechRef}</span>
              </span>
            </summary>
            <div className="collapsible-body">
              <div className="tech-meta-grid">
                <div className="tech-meta-item">
                  <span className="tech-meta-label">{m.recImportTime}</span>
                  <span className="tech-meta-value mono">{r.retrieved_at ? new Date(r.retrieved_at).toISOString() : '—'}</span>
                </div>
                <div className="tech-meta-item">
                  <span className="tech-meta-label">{m.recReaderVer}</span>
                  <span className="tech-meta-value mono">{r.parser_version}</span>
                </div>
                <div className="tech-meta-item full">
                  <span className="tech-meta-label">SHA-256</span>
                  <span dir="ltr" className="tech-meta-value mono sha-box">{r.sha256}</span>
                </div>
              </div>
              <p className="tech-note">{m.recSourceUpdateNote}</p>
              <small className="tech-local-note">{m.recLocalNote}</small>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
