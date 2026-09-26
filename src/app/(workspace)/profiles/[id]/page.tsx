import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight, CheckCircle2, XCircle, MinusCircle, ShieldQuestion,
  ShieldAlert, ScanSearch, Clock3, FileText, LockKeyhole, ArrowUpLeft,
  Pencil, Newspaper, ExternalLink, Info, Activity as ActivityIcon, AlertCircle, Sparkles,
  AlertOctagon, CheckCheck
} from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { hasFeature } from '@/lib/features';
import { getCustomerByHandle, getActivity, enrichCustomerFromMatch, type EnrichedFields } from '@/lib/customers';
import { getLastScreening, runAndSaveScreening } from '@/lib/screening';
import { getSourceRecordsMap } from '@/lib/search';
import { extractRecordCountry, extractRecordDob, extractRecordIdentifier, extractRecordAliases } from '@/lib/record-details';
import { getMatchDecisions, getMatchDecisionHistory } from '@/lib/decisions';
import { computeRiskRating, reviewImpact, isSanctionedCountry, evaluateRiskAssessment, getFatfStatus, isCashThresholdSector } from '@/lib/risk-rating';
import ScreenCustomerButton from '@/components/screen-customer-button';
import { canManageCustomers } from '@/lib/validation';
import { EntityIcon, Status, RiskPill, countryName, DateText, number, flag } from '@/components/ui';
import { getMessages, getLocale } from '@/lib/i18n';
import MatchesView from '@/components/matches-view';
import ProfileTabsView from '@/components/profile-tabs-view';
import DeleteCustomerButton from '@/components/delete-customer-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Profile({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    decision?: string;
    match?: string;
    tab?: string;
    screen?: string;
    from_record?: string;
  }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  if (!/^[\w-]{4,60}$/.test(id)) notFound();

  const customer = await getCustomerByHandle(actor.organizationId, id);
  if (!customer) notFound();
  if (actor.role === 'analyst' && customer.created_by && customer.created_by !== actor.id) {
    notFound();
  }

  const [activity, initialLast, decisions, decisionHistory, search, m, locale] = await Promise.all([
    getActivity(actor.organizationId, customer.id),
    getLastScreening(actor.organizationId, customer.id),
    getMatchDecisions(actor.organizationId, customer.id),
    getMatchDecisionHistory(actor.organizationId, customer.id),
    searchParams,
    getMessages(),
    getLocale(),
  ]);

  let last = initialLast;
  if (!last && canManageCustomers(actor.role)) {
    try {
      await runAndSaveScreening(actor, customer.id);
      last = await getLastScreening(actor.organizationId, customer.id);
    } catch (err) {
      console.error('Failed auto-screening customer on view:', err);
    }
  }

  const matchRecordIds = (last?.top_matches ?? []).map(m => m.recordId).filter(Boolean);
  const sourceRecordsMap = await getSourceRecordsMap(matchRecordIds);

  const missingCountry = !customer.country || ['OTHER', 'XX', 'ZZ', 'OT'].includes(String(customer.country).toUpperCase());
  const missingNat = !customer.nationality;
  const missingDob = !customer.date_of_birth || customer.date_of_birth === 'لم يُضَف';
  const missingId = !customer.identifier || customer.identifier === 'لم يُضَف';

  let wasAutoEnriched = false;
  if ((missingCountry || missingNat || missingDob || missingId) && (last?.top_matches ?? []).length > 0) {
    const confirmedMatch = (last?.top_matches ?? []).find(mt => decisions[mt.recordId]?.decision === 'confirmed');
    const firstMatch = (last?.top_matches ?? [])[0];
    const candidateMatch = confirmedMatch || ((firstMatch?.percent ?? 0) >= 80 ? firstMatch : null);
    if (candidateMatch) {
      const srcRecord = sourceRecordsMap.get(candidateMatch.recordId);
      const details = srcRecord?.details;
      const recCountry = candidateMatch.recordCountry ?? (details ? extractRecordCountry(details) : null);
      const recDob = candidateMatch.recordDob ?? (details ? extractRecordDob(details) : null);
      const recIdentifier = candidateMatch.recordIdNumber ?? (details ? extractRecordIdentifier(details, srcRecord?.source_record_id) : candidateMatch.sourceRecordId ?? null);

      if (recCountry || recDob || recIdentifier) {
        const enrichment = await enrichCustomerFromMatch(actor.organizationId, actor.id, customer.id, {
          country: recCountry,
          dob: recDob,
          identifier: recIdentifier,
          sourceName: candidateMatch.name || candidateMatch.source,
        }).catch((): { enriched: boolean; fields: EnrichedFields } => ({ enriched: false, fields: {} }));

        if (enrichment.enriched) {
          wasAutoEnriched = true;
          if (enrichment.fields.country) customer.country = enrichment.fields.country;
          if (enrichment.fields.nationality) customer.nationality = enrichment.fields.nationality;
          if (enrichment.fields.date_of_birth) customer.date_of_birth = enrichment.fields.date_of_birth;
          if (enrichment.fields.identifier) customer.identifier = enrichment.fields.identifier;
        }
      }
    }
  }

  const canManage = canManageCustomers(actor.role);
  const isOwner = !customer.created_by || customer.created_by === actor.id;
  const canEdit = actor.role === 'admin' || (canManage && isOwner);
  const bandLabel = (b: string) => ({ none: m.bandNone, low: m.bandLow, medium: m.bandMedium, high: m.bandHigh } as Record<string, string>)[b] ?? b;
  const catLabel = (c: string) => ({ sanctions: m.catSanctions, pep: m.catPep, crime: m.catCrime, debarment: m.catDebarment, regulatory: m.catRegulatory, other: m.catOther } as Record<string, string>)[c] ?? c;
  const dcLabel = (c: string) => ({ face_to_face: m.dcFaceToFace, non_face_to_face: m.dcNonFaceToFace, online: m.dcOnline } as Record<string, string>)[c] ?? '';

  const resFatf = getFatfStatus(customer.country);
  const natFatf = getFatfStatus(customer.nationality);

  const fields: [string, string | Date][] = [
    [m.fEntityType, customer.entity_type === 'company' ? m.entityCompanyFull : m.entityIndividual],
    [m.fCountry, `${flag(customer.country) || '🌐'} ${countryName(customer.country, locale)}${resFatf ? ` · [${resFatf === 'blacklist' ? m.fatfBlacklistShort : m.fatfGreylistShort}]` : ''}`],
    [m.flNationality, customer.nationality ? `${flag(customer.nationality) || '🌐'} ${countryName(customer.nationality, locale)}${natFatf ? ` · [${natFatf === 'blacklist' ? m.fatfBlacklistShort : m.fatfGreylistShort}]` : ''}` : m.notAddedM],
    [m.flDelivery, customer.delivery_channel ? dcLabel(customer.delivery_channel) : m.notAddedM],
    [m.fIndustry, customer.industry ? `${customer.industry}${isCashThresholdSector(customer.industry) ? ` · [${m.dnfbpBadge}]` : ''}` : m.notAdded],
    [m.fDob, customer.date_of_birth || m.notAddedM],
    [m.fIdentifier, customer.identifier || m.notAddedM],
    [m.fEmail, customer.email || m.notAddedM],
    [locale === 'en' ? 'Created By' : 'سُجّل بواسطة', customer.creator_name || (locale === 'en' ? 'System / Unassigned' : 'النظام / غير محدد')],
    [m.fCreated, customer.created_at],
    [m.fUpdated, customer.updated_at],
  ];

  const band = last?.overall_band ?? 'none';
  const adverseHit = !!last?.adverse_media && last.adverse_media.status === 'searched' && last.adverse_media.count > 0;
  const riskAssessment = evaluateRiskAssessment(customer, last?.top_matches ?? [], decisions, !!last, adverseHit);
  const rating = riskAssessment.rating;
  const review = riskAssessment.review;
  const reviewPending = riskAssessment.isPending;
  const goAml = riskAssessment.goAml;

  const resSanctioned = isSanctionedCountry(customer.country);
  const natSanctioned = isSanctionedCountry(customer.nationality);
  const special = !!(review.flags.crime || review.flags.debarment);

  const overrides: [string, string, string][] = [
    [m.rfoStr, m.rfoNA, 'low'],
    [m.rfoResSanctioned, resSanctioned ? bandLabel('high') : m.rfoNA, resSanctioned ? 'high' : 'low'],
    [m.rfoNatSanctioned, natSanctioned ? bandLabel('high') : m.rfoNA, natSanctioned ? 'high' : 'low'],
    [m.rfoSanctionHit, review.flags.sanctions ? bandLabel('high') : reviewPending && last?.flags.sanctions ? m.riskPendingValue : m.rfoNA, review.flags.sanctions ? 'high' : reviewPending && last?.flags.sanctions ? 'pending' : 'low'],
    [m.catPep, review.flags.pep ? bandLabel('medium') : reviewPending && last?.flags.pep ? m.riskPendingValue : m.rfoNA, review.flags.pep ? 'medium' : reviewPending && last?.flags.pep ? 'pending' : 'low'],
    [m.rfoSpecial, special ? bandLabel('high') : reviewPending && (last?.flags.crime || last?.flags.debarment) ? m.riskPendingValue : m.rfoNA, special ? 'high' : reviewPending && (last?.flags.crime || last?.flags.debarment) ? 'pending' : 'low'],
    [m.rfoAdverse, adverseHit ? bandLabel('medium') : m.rfoNA, adverseHit ? 'medium' : 'low'],
  ];

  const factorLabel = (k: string) => ({ residence: m.rfResidence, nationality: m.rfNationality, industry: m.rfIndustry, delivery: m.rfDelivery } as Record<string, string>)[k] ?? k;
  const driverLabel = (d: string) => ({
    sanction: m.catSanctions,
    crime: m.catCrime,
    debarment: m.catDebarment,
    pep: m.catPep,
    regulatory: m.catRegulatory,
    adverse: m.advHitLabel,
    fatf_blacklist: m.driverFatfBlacklist,
    sanctioned_country: m.driverSanctionedCountry,
  } as Record<string, string>)[d] ?? d;
  const advCatLabel = (c: string) => ({ sanctions: m.catSanctions, laundering: locale === 'en' ? 'Money laundering' : 'غسل أموال', fraud: locale === 'en' ? 'Fraud' : 'احتيال', corruption: locale === 'en' ? 'Bribery / corruption' : 'رشوة / فساد', terrorism: locale === 'en' ? 'Terrorism' : 'إرهاب', crime: m.catCrime, other: locale === 'en' ? 'Adverse' : 'خبر سلبي' } as Record<string, string>)[c] ?? c;
  const factorValue = (f: { key: string; value: string }) => {
    if (f.key === 'delivery') return f.value ? dcLabel(f.value) : m.notAddedM;
    if (f.key === 'industry') return f.value || m.notAdded;
    if (!f.value) return m.notAddedM;
    return (
      <span className="risk-country-val">
        <span className="flag" aria-hidden="true">{flag(f.value) || '🌐'}</span>
        <span>{countryName(f.value, locale)}</span>
      </span>
    );
  };

  const checkList = [[m.catSanctions, 'sanctions'], [m.catPep, 'pep'], [m.catCrime, 'crime'], [m.catDebarment, 'debarment'], [m.catRegulatory, 'regulatory']] as const;
  const checkState = (key: string) => {
    const categoryMatches = last?.top_matches.filter(match => match.category === key) ?? [];
    const categoryDecisions = categoryMatches.map(match => decisions[match.recordId]?.decision);
    if (categoryDecisions.includes('confirmed')) return { state: 'confirmed', label: m.checkConfirmed, Icon: ShieldAlert };
    if (last?.flags[key] && (categoryMatches.length === 0 || categoryDecisions.some(decision => !decision || decision === 'needs_info'))) return { state: 'pending', label: m.checkPending, Icon: Clock3 };
    if (categoryMatches.length > 0 && categoryDecisions.every(decision => decision === 'dismissed')) return { state: 'dismissed', label: m.checkDismissed, Icon: CheckCircle2 };
    return { state: 'neutral', label: m.checkNoSignal, Icon: MinusCircle };
  };

  const screenButton = canManage && (
    <ScreenCustomerButton
      customerId={customer.id}
      reference={customer.reference}
      label={last ? m.rescreenBtn : m.screenBtn}
      pendingLabel={m.screenPending}
    />
  );
  const editedAfterScreening = last && new Date(customer.updated_at).getTime() > new Date(last.created_at).getTime();
  const ltrField = (label: string) => ((label === m.fEmail && customer.email) || (label === m.fIdentifier && customer.identifier) || (label === m.fDob && customer.date_of_birth) || label === m.fCreated || label === m.fUpdated) ? 'ltr' : undefined;
  const fieldValue = (value: string | Date) => value instanceof Date ? <DateText value={value} locale={locale} /> : value;

  const matchItems = (last?.top_matches ?? []).map(mt => {
    const srcRecord = sourceRecordsMap.get(mt.recordId);
    const details = srcRecord?.details;
    const recordCountry = mt.recordCountry ?? (details ? extractRecordCountry(details) : null);
    const recordDob = mt.recordDob ?? (details ? extractRecordDob(details) : null);
    const recordIdNumber = mt.recordIdNumber ?? (details ? extractRecordIdentifier(details, srcRecord?.source_record_id) : mt.sourceRecordId ?? null);
    const recordAliases = (mt.recordAliases && mt.recordAliases.length > 0)
      ? mt.recordAliases
      : srcRecord ? extractRecordAliases(srcRecord) : [];

    return {
      name: mt.name,
      code: mt.code,
      source: mt.source,
      category: mt.category,
      categoryLabel: catLabel(mt.category),
      band: mt.band,
      bandLabel: bandLabel(mt.band),
      percent: mt.percent,
      recordId: mt.recordId,
      dobMatch: mt.dobMatch,
      idMatch: mt.idMatch,
      dobConflict: mt.dobConflict,
      sourceCount: mt.sourceCount,
      relatedSources: mt.relatedSources,
      sourceRecordId: mt.sourceRecordId ?? srcRecord?.source_record_id,
      recordCountry,
      recordDob,
      recordIdNumber,
      recordAliases,
    };
  });

  const reviewStatusLabel = m[riskAssessment.statusLabelKey];

  return (
    <>
      <Link href="/profiles" className="back-link">
        <ArrowRight size={17} />
        {m.navCustomers}
      </Link>

      {search.from_record === '1' && (
        <div role="status" className="success-message">
          <CheckCircle2 size={18} />
          {locale === 'en'
            ? 'Customer profile successfully created from source record, registered to your account, and screened.'
            : 'تم إنشاء ملف العميل وإضافته إلى حسابك بنجاح من واقع سجل المصادر، وتم تشغيل الفحص الآلي وربط المطابقات.'}
        </div>
      )}
      {search.created === '1' && !search.from_record && (
        <div role="status" className="success-message">
          <CheckCircle2 size={18} />
          {m.savedDraft}
        </div>
      )}
      {search.updated === '1' && (
        <div role="status" className="success-message">
          <CheckCircle2 size={18} />
          {m.savedEdits}
        </div>
      )}
      {search.decision === 'saved' && (
        <div role="status" className="success-message">
          <CheckCircle2 size={18} />
          {m.decisionSaved}
        </div>
      )}
      {search.decision === 'error' && (
        <div role="alert" className="error-message">
          <XCircle size={18} />
          {m.decisionError}
        </div>
      )}
      {search.screen === 'quota' && (
        <div role="alert" className="error-message">
          <AlertCircle size={18} />
          {m.quotaBlockedBody}
        </div>
      )}
      {search.screen === 'error' && (
        <div role="alert" className="error-message">
          <XCircle size={18} />
          {m.decisionError}
        </div>
      )}
      {search.screen === 'success' && (
        <div role="status" className="success-message screen-success-banner">
          <CheckCircle2 size={18} />
          <span>{locale === 'en' ? 'Automated screening completed successfully against international watchlists & sanction databases.' : 'اكتمل الفحص التلقائي بنجاح ومطابقة العميل مع قوائم العقوبات والمراقبة الدولية.'}</span>
        </div>
      )}
      {wasAutoEnriched && (
        <div role="status" className="success-message enriched-notice">
          <Sparkles size={18} />
          <span>{locale === 'en' ? '✨ Customer profile attributes were automatically enriched from the matching source record.' : '✨ تم استكمال وتوثيق بيانات العميل تلقائيًا استنادًا إلى سجل المطابقة.'}</span>
        </div>
      )}

      <div className="profile-heading">
        <div className="profile-main-meta">
          <EntityIcon type={customer.entity_type} />
          <div className="profile-title-block">
            <span className="eyebrow" dir="ltr">{customer.reference}</span>
            <h1>{customer.name}</h1>
          </div>
          <div className="profile-status-inline">
            <Status status={customer.status} m={m} />
          </div>
        </div>
        <div className="id-chips">
          <span className="id-chip">
            {customer.entity_type === 'company' ? m.entityCompany : m.entityIndividual}
          </span>
          <span className="id-chip">
            <span className="flag" aria-hidden>{flag(customer.country) || '🌐'}</span>
            {countryName(customer.country, locale)}
          </span>
          {resFatf && (
            <span className={`id-chip fatf-chip ${resFatf}`}>
              <AlertOctagon size={13} />
              {resFatf === 'blacklist' ? m.fatfBlacklistShort : m.fatfGreylistShort}
            </span>
          )}
          {customer.nationality && natFatf && natFatf !== resFatf && (
            <span className={`id-chip fatf-chip ${natFatf}`}>
              <AlertOctagon size={13} />
              {countryName(customer.nationality, locale)}: {natFatf === 'blacklist' ? m.fatfBlacklistShort : m.fatfGreylistShort}
            </span>
          )}
          {isCashThresholdSector(customer.industry) && (
            <span className="id-chip dnfbp-chip">
              <Sparkles size={13} />
              {m.dnfbpBadge}
            </span>
          )}
          {customer.date_of_birth && (
            <span className="id-chip">
              {customer.entity_type === 'company' ? m.chipFoundingDate : m.chipDob} · <span dir="ltr">{customer.date_of_birth}</span>
            </span>
          )}
          {customer.identifier && (
            <span className="id-chip">
              {customer.entity_type === 'company' ? m.chipCrNumber : m.chipId} · <span dir="ltr">{customer.identifier}</span>
            </span>
          )}
        </div>
        <div className="profile-head-actions">
          {canEdit && (
            <Link href={`/profiles/${customer.reference}/edit`} className="button secondary">
              <Pencil size={16} />
              {m.edit}
            </Link>
          )}
          {actor.role === 'admin' && (
            <DeleteCustomerButton
              customerId={customer.id}
              customerName={customer.name}
              isArabic={locale === 'ar'}
            />
          )}
          <div className="profile-status-desktop">
            <Status status={customer.status} m={m} />
          </div>
        </div>
      </div>

      {editedAfterScreening && (
        <div className="inline-info rescreen-note">
          <ScanSearch size={19} />
          <p>
            {m.rescreenNoteA}
            <DateText value={last!.created_at} locale={locale} />
            {m.rescreenNoteB}
          </p>
        </div>
      )}

      <ProfileTabsView
        defaultTab={search.tab || (search.match ? 'matches' : 'summary')}
        tabs={[
          {
            id: 'summary',
            label: m.tabSummary,
            iconName: 'summary',
            content: (
              <div className="profile-grid" id="profile-summary">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{m.customerData}</h2>
                    <FileText size={20} />
                  </div>
                  <dl className="detail-grid">
                    {fields.map(([label, value]) => (
                      <div key={label} className="detail-item">
                        <dt>{label}</dt>
                        <dd dir={ltrField(label)}>{fieldValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="notes">
                    <h3>{m.internalNotes}</h3>
                    <p>{customer.notes || m.noNotes}</p>
                  </div>
                </section>

                <aside className="profile-side">
                  {last ? (
                    <div className={`panel assessment screen-result band-${band}`}>
                      <div className="screen-result-top">
                        <span className="screen-result-icon">
                          {band === 'none' ? <ShieldQuestion size={25} /> : <ShieldAlert size={25} />}
                        </span>
                        <div>
                          <span className="assess-eyebrow">{m.matchSeverity}</span>
                          <strong className={`assess-band ${band}`}>{bandLabel(band)}</strong>
                        </div>
                        <span className={`screen-review-badge ${riskAssessment.isPending ? 'pending' : (last.top_matches.length ? 'complete' : 'neutral')}`}>
                          {riskAssessment.isPending ? <Clock3 size={13} /> : (last.top_matches.length ? <CheckCircle2 size={13} /> : <MinusCircle size={13} />)} {reviewStatusLabel}
                        </span>
                      </div>
                      <div className="screen-checks" aria-label={m.screenChecksTitle}>
                        {checkList.map(([label, key]) => {
                          const { state, label: statusLabel, Icon } = checkState(key);
                          return (
                            <div key={key} className={`screen-check ${state}`} title={statusLabel}>
                              <span className="screen-check-icon"><Icon size={15} /></span>
                              <span><strong>{label}</strong><small>{statusLabel}</small></span>
                            </div>
                          );
                        })}
                      </div>
                      <p className={`screen-risk-note ${riskAssessment.isPending ? 'pending' : 'complete'}`}>
                        <Info size={14} />
                        {riskAssessment.isPending ? m.pendingSignalRiskNote : m.confirmedSignalRiskNote}
                      </p>
                      <p className="muted">{m.neutralNote}</p>
                      <p>
                        {number(last.relevant_count)} {m.relevantOf} {number(last.match_count)} · {m.screenedByName}
                        {last.used_dob ? m.plusDob : ''}
                        {last.used_identifier ? m.plusId : ''}.
                      </p>
                      <p className="muted coverage-line">
                        {last.source_versions.length > 0
                          ? `${m.coverageLineA} ${number(last.source_versions.length)} ${m.coverageLineB}`
                          : m.coverageLineNoV} · {m.coverageLineC}
                      </p>
                      <div className="profile-side-risk-pill">
                        <span className={`status ${riskAssessment.isPending ? 'amber' : 'neutral'}`}>
                          {riskAssessment.isPending
                            ? m.riskPendingValue
                            : (last ? `${m.riskModelTitle}: ${bandLabel(rating.band)}` : m.riskUnassessed)}
                        </span>
                      </div>
                      <div className={`goaml-side-tag ${goAml.requiresImmediateAction ? 'critical' : goAml.requiresEdd ? 'warning' : 'standard'}`}>
                        <ShieldAlert size={14} />
                        <span>{goAml.requiresImmediateAction ? m.goAmlImmediateAction : goAml.requiresEdd ? m.goAmlEddRequired : m.goAmlStandardCdd}</span>
                      </div>
                      <small className="muted">{m.lastScreen} <DateText value={last.created_at} locale={locale} /></small>
                      {screenButton}
                      <Link href={`/profiles/${customer.reference}/report`} className="text-link">
                        {m.viewReport} <ArrowUpLeft size={14} />
                      </Link>
                    </div>
                  ) : (
                    <div className="panel assessment">
                      <ShieldQuestion size={27} />
                      <h2>{m.notScreenedTitle}</h2>
                      <p>{m.notScreenedBody}</p>
                      {screenButton}
                      {!canManage && <span className="status neutral">{m.readOnly}</span>}
                    </div>
                  )}
                  <div className="private-note">
                    <LockKeyhole size={18} />
                    <span>{m.privateNoteA} {actor.organizationName} {m.privateNoteB}</span>
                  </div>
                </aside>
              </div>
            ),
          },
          {
            id: 'matches',
            label: m.tabMatches,
            iconName: 'matches',
            badge: riskAssessment.unresolvedCount > 0 ? riskAssessment.unresolvedCount : (last?.top_matches.length ? last.top_matches.length : undefined),
            badgeType: riskAssessment.unresolvedCount > 0 ? 'amber' : 'neutral',
            content: (
              <div className="profile-matches-tab" id="profile-matches">
                {last ? (
                  <>
                    <MatchesView
                      matches={matchItems}
                      decisions={decisions}
                      decisionHistory={decisionHistory}
                      customer={{
                        id: customer.id,
                        reference: customer.reference,
                        name: customer.name,
                        country: customer.country,
                        nationality: customer.nationality,
                        date_of_birth: customer.date_of_birth,
                        identifier: customer.identifier,
                        entity_type: customer.entity_type,
                      }}
                      canManage={canManage}
                      relevantCount={last.relevant_count}
                      screenDate={last.created_at}
                      initialFilter={search.match || 'all'}
                    />

                    {hasFeature(actor, 'adverse_media') && last.adverse_media && (
                      <section className="panel search-results adverse-media-section" style={{ marginTop: '24px' }}>
                        <div className="panel-heading">
                          <div>
                            <h2><Newspaper size={18} /> {m.advTitle}</h2>
                            <p>{m.advSub}</p>
                          </div>
                          <span className={`status ${adverseHit ? 'amber' : 'neutral'}`}>
                            <span className="status-mark" />
                            {last.adverse_media.status === 'searched'
                              ? (adverseHit ? `${number(last.adverse_media.count)} ${m.advCount}` : m.advNone)
                              : m.advFailed}
                          </span>
                        </div>
                        {adverseHit && (
                          <>
                            <div className="result-list">
                              {last.adverse_media.articles.map((a, i) => {
                                const cls = a.category === 'sanctions'
                                  ? 'sanctions'
                                  : (a.category === 'crime' || a.category === 'terrorism')
                                  ? 'crime'
                                  : a.category === 'corruption'
                                  ? 'pep'
                                  : (a.category === 'laundering' || a.category === 'fraud')
                                  ? 'debarment'
                                  : 'other';
                                return (
                                  <a className="search-result" href={a.url} target="_blank" rel="noopener noreferrer" key={a.url + i}>
                                    <div>
                                      <h3 dir="auto">{a.title}</h3>
                                      <p>
                                        <span className={`cat-badge ${cls}`}>{advCatLabel(a.category)}</span>{' '}
                                        <span className="src-title" dir="ltr">{a.domain}{a.date ? ` · ${a.date}` : ''}</span>
                                      </p>
                                    </div>
                                    <ExternalLink size={19} />
                                  </a>
                                );
                              })}
                            </div>
                            <div className="panel-footnote">
                              <Info size={15} />
                              <span>{m.advDisclaimer}</span>
                            </div>
                          </>
                        )}
                      </section>
                    )}
                  </>
                ) : (
                  <div className="panel empty-matches-panel">
                    <ShieldQuestion size={40} className="muted-icon" />
                    <h3>{m.notScreenedTitle}</h3>
                    <p>{m.notScreenedBody}</p>
                    <div style={{ marginTop: '16px' }}>{screenButton}</div>
                  </div>
                )}
              </div>
            ),
          },
          {
            id: 'risk',
            label: m.tabRisk,
            iconName: 'risk',
            badge: riskAssessment.isPending
              ? m.riskPendingValue
              : (goAml.requiresImmediateAction ? (locale === 'en' ? 'goAML Action' : 'إجراء goAML') : undefined),
            badgeType: riskAssessment.isPending ? 'amber' : (goAml.requiresImmediateAction ? 'amber' : 'neutral'),
            content: (
              <div className="profile-risk-tab-content">
                <section className="panel risk-model" id="profile-risk">
                  <div className="panel-heading">
                    <h2>{m.riskModelTitle}</h2>
                    <RiskPill band={riskAssessment.isPending ? 'pending' : rating.band} m={m} />
                  </div>
                  {reviewPending && (
                    <p className="risk-pending-note"><Info size={16} />{m.riskPendingModel}</p>
                  )}
                  <div className="risk-tables">
                    <table className="risk-matrix">
                      <thead>
                        <tr>
                          <th>{m.riskFactorCol}</th>
                          <th>{m.riskValueCol}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {rating.factors.map(f => (
                          <tr key={f.key}>
                            <td>{factorLabel(f.key)}</td>
                            <td className="risk-factor-val">{factorValue(f)}</td>
                            <td><RiskPill band={f.band} m={m} /></td>
                          </tr>
                        ))}
                        <tr className="risk-base">
                          <td>{m.riskBase}</td>
                          <td>{number(rating.base)}</td>
                          <td><RiskPill band={rating.baseBand} m={m} /></td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="risk-matrix override-matrix">
                      <thead>
                        <tr>
                          <th>{m.rfoTitle}</th>
                          <th>{m.rfoOverrideTo}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {overrides.map(([label, to, ob], i) => (
                          <tr key={i}>
                            <td dir="auto">{label}</td>
                            <td>{to}</td>
                            <td><RiskPill band={ob} m={m} /></td>
                          </tr>
                        ))}
                        <tr className="risk-base">
                          <td>{m.rfoOverall}</td>
                          <td>{riskAssessment.isPending ? m.riskPendingValue : bandLabel(rating.band)}</td>
                          <td><RiskPill band={riskAssessment.isPending ? 'pending' : rating.band} m={m} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {rating.drivers[0] !== 'base' && (
                    <p className="risk-drivers-line">
                      {m.riskDrivers}: {rating.drivers.map(driverLabel).join(' · ')}
                    </p>
                  )}
                  <p className="risk-review-line">
                    {m.riskReviewImpact}: {m.resGenuine} {number(review.confirmed)} · {m.resNotGenuine} {number(review.dismissed)} · {m.resUnresolved} {number(review.unreviewed + review.needsInfo)}
                  </p>
                  <p className="risk-model-note">{m.riskModelNote}</p>
                </section>

                <section className="panel goaml-advice-panel" id="profile-goaml">
                  <div className="panel-heading">
                    <div className="goaml-head-info">
                      <div className="goaml-title-row">
                        <h2>
                          <ShieldAlert size={20} className="goaml-title-icon" />
                          {m.goAmlBoxTitle}
                        </h2>
                        <span className={`goaml-status-pill ${goAml.requiresImmediateAction ? 'critical' : goAml.requiresEdd ? 'warning' : 'standard'}`}>
                          {goAml.requiresImmediateAction ? m.goAmlImmediateAction : goAml.requiresEdd ? m.goAmlEddRequired : m.goAmlStandardCdd}
                        </span>
                      </div>
                      <p className="goaml-subtext">{m.goAmlBoxSub}</p>
                    </div>
                  </div>

                  <div className={`goaml-summary-callout ${goAml.requiresImmediateAction ? 'critical' : goAml.requiresEdd ? 'warning' : 'standard'}`}>
                    <p>{locale === 'en' ? goAml.summaryEn : goAml.summaryAr}</p>
                  </div>

                  {goAml.cashThresholdAlert && (
                    <div className="goaml-cash-alert">
                      <AlertCircle size={20} />
                      <div>
                        <strong>{m.goAmlCashNoticeTitle}</strong>
                        <p>{locale === 'en' ? goAml.cashThresholdNote.en : goAml.cashThresholdNote.ar}</p>
                      </div>
                    </div>
                  )}

                  <div className="goaml-reports-section">
                    <h3>{m.goAmlRequiredReports}</h3>
                    {goAml.reports.length === 0 ? (
                      <div className="goaml-empty-notice">
                        <CheckCheck size={20} />
                        <span>{m.goAmlNoReportsNeeded}</span>
                      </div>
                    ) : (
                      <div className="goaml-cards-grid">
                        {goAml.reports.map((item, idx) => (
                          <div key={idx} className={`goaml-card severity-${item.severity}`}>
                            <div className="goaml-card-head">
                              <span className={`goaml-type-badge type-${item.type}`}>{item.type}</span>
                              <h4>{locale === 'en' ? item.titleEn : item.titleAr}</h4>
                              <span className={`goaml-mandate-badge ${item.mandatory ? 'mandatory' : 'advisory'}`}>
                                {item.mandatory ? m.goAmlMandatory : m.goAmlAdvisory}
                              </span>
                            </div>

                            <div className="goaml-card-body">
                              <div className="goaml-row">
                                <span className="goaml-row-label">{m.goAmlTrigger}:</span>
                                <p>{locale === 'en' ? item.triggerEn : item.triggerAr}</p>
                              </div>
                              <div className="goaml-row goaml-action-row">
                                <span className="goaml-row-label">{m.goAmlRequiredAction}:</span>
                                <p>{locale === 'en' ? item.actionEn : item.actionAr}</p>
                              </div>
                              <div className="goaml-row goaml-legal-row">
                                <span className="goaml-row-label">{m.goAmlLegalBasis}:</span>
                                <small>{locale === 'en' ? item.legalBasisEn : item.legalBasisAr}</small>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ),
          },
          {
            id: 'activity',
            label: m.tabActivity,
            iconName: 'activity',
            badge: activity.length,
            badgeType: 'neutral',
            content: (
              <section className="panel timeline-panel" id="profile-activity">
                <div className="panel-heading">
                  <h2><Clock3 size={19} />{m.timelineTitle}</h2>
                </div>
                <div className="activity-list">
                  {activity.map(a => (
                    <div className="activity-item" key={a.id}>
                      <span className="activity-dot" />
                      <div>
                        <p>{a.summary}</p>
                        <small><DateText value={a.created_at} locale={locale} /></small>
                      </div>
                    </div>
                  ))}
                  {!activity.length && <p>{m.noEvents}</p>}
                </div>
              </section>
            ),
          },
        ]}
      />
    </>
  );
}
