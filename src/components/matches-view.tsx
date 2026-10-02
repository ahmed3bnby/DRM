'use client';

import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, Clock3, AlertTriangle, Search,
  ExternalLink, ArrowUpLeft, X, ChevronRight, ChevronLeft,
  FileCheck2, ShieldAlert, ArrowRight, UserCheck, ShieldQuestion,
  Sparkles, Zap
} from 'lucide-react';
import { useLocale } from './locale-context';
import { useToast } from './toast';
import { saveMatchDecisionAction } from '@/app/actions';
import type { DecisionRow } from '@/lib/decisions';
import { countryName, flag, number, DateText, DateTimeText } from './ui';
import { analyzeMatchForDecision, type AiDecisionRecommendation } from '@/lib/ai-compliance-assistant';

export type ScreeningMatchItem = {
  name: string;
  code?: string;
  source: string;
  category: string;
  categoryLabel?: string;
  band: string;
  bandLabel?: string;
  percent: number;
  recordId: string;
  dobMatch?: boolean;
  idMatch?: boolean;
  dobConflict?: boolean;
  sourceCount?: number;
  relatedSources?: { recordId: string; source: string; code?: string }[];
  sourceRecordId?: string;
  recordCountry?: string | null;
  recordDob?: string | null;
  recordIdNumber?: string | null;
  recordAliases?: string[];
};

type MatchesViewProps = {
  matches: ScreeningMatchItem[];
  decisions: Record<string, DecisionRow>;
  decisionHistory: DecisionRow[];
  customer: {
    id: string;
    reference: string;
    name: string;
    country: string;
    nationality: string | null;
    date_of_birth: string | null;
    identifier: string | null;
    entity_type: string;
  };
  canManage: boolean;
  relevantCount: number;
  screenDate: Date | string;
  initialFilter?: string;
};

export default function MatchesView({
  matches,
  decisions: initialDecisions,
  decisionHistory: initialHistory,
  customer,
  canManage,
  relevantCount,
  screenDate,
  initialFilter = 'all',
}: MatchesViewProps) {
  const { m, locale } = useLocale();
  const toast = useToast();

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<ScreeningMatchItem | null>(null);

  // Local state for instant feedback without waiting for reload
  const [decisions, setDecisions] = useState<Record<string, DecisionRow>>(initialDecisions);
  const [history, setHistory] = useState<DecisionRow[]>(initialHistory);

  // Decision Form State in Drawer
  const [selectedDecision, setSelectedDecision] = useState<'confirmed' | 'dismissed' | 'needs_info'>('confirmed');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // AI recommendations map for all matches
  const aiRecommendations = useMemo(() => {
    const map: Record<string, AiDecisionRecommendation> = {};
    for (const item of matches) {
      map[item.recordId] = analyzeMatchForDecision(customer, item, locale as 'ar' | 'en');
    }
    return map;
  }, [matches, customer, locale]);

  // AI recommendation for current selected match in drawer
  const aiRec = useMemo(() => {
    if (!selectedMatch) return null;
    return aiRecommendations[selectedMatch.recordId] || analyzeMatchForDecision(customer, selectedMatch, locale as 'ar' | 'en');
  }, [selectedMatch, aiRecommendations, customer, locale]);

  const handleApplyAiRecommendation = () => {
    if (!aiRec) return;
    setSelectedDecision(aiRec.recommendation);
    const text = locale === 'en' ? aiRec.auditRationaleEn : aiRec.auditRationaleAr;
    setReason(text);
    setFormError(null);
    toast(
      locale === 'en'
        ? 'Automated compliance recommendation applied and audit rationale documented.'
        : 'تم تطبيق التوصية الآلية وتوثيق السبب آلياً.',
      'success'
    );
  };

  // Drawer accessibility & focus management
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Sync initial decisions
  useEffect(() => { setDecisions(initialDecisions); }, [initialDecisions]);
  useEffect(() => { setHistory(initialHistory); }, [initialHistory]);

  // When selected match changes, pre-populate existing decision if available
  useEffect(() => {
    if (selectedMatch) {
      const existing = decisions[selectedMatch.recordId];
      if (existing) {
        setSelectedDecision(existing.decision);
        setReason(existing.reason || '');
      } else {
        setSelectedDecision('confirmed');
        setReason('');
      }
      setFormError(null);
    }
  }, [selectedMatch, decisions]);

  // Trap focus and support Escape
  useEffect(() => {
    if (!selectedMatch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedMatch]);

  const openDrawer = (match: ScreeningMatchItem, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) triggerRef.current = e.currentTarget;
    setSelectedMatch(match);
  };

  const closeDrawer = () => {
    setSelectedMatch(null);
    triggerRef.current?.focus();
  };

  // Translations
  const catLabel = (c: string) =>
    ({
      sanctions: m.catSanctions,
      pep: m.catPep,
      crime: m.catCrime,
      debarment: m.catDebarment,
      regulatory: m.catRegulatory || (locale === 'en' ? 'Regulatory Alert' : 'إجراء رقابي'),
      maritime: locale === 'en' ? 'Sanctioned Vessel' : 'حظر سفن وملاحة',
      corporate_ubo: locale === 'en' ? 'Corporate & UBO' : 'سجل شركات / UBO',
      offshore: locale === 'en' ? 'Offshore Leaks' : 'تسريبات ملاذات ضريبية',
      other: m.catOther
    } as Record<string, string>)[c] ?? c;
  const bandLabel = (b: string) =>
    ({ none: m.bandNone, low: m.bandLow, medium: m.bandMedium, high: m.bandHigh } as Record<string, string>)[b] ?? b;
  const decLabel = (d: string) =>
    ({ confirmed: m.decConfirmed, dismissed: m.decDismissed, needs_info: m.decNeedsInfo } as Record<string, string>)[d] ?? d;

  // Decision counts
  const counts = useMemo(() => {
    let unreviewed = 0;
    let confirmed = 0;
    let dismissed = 0;
    let needsInfo = 0;
    let belowThreshold = 0;
    for (const match of matches) {
      const d = decisions[match.recordId]?.decision;
      const requiresDecision = (match.percent ?? 100) >= 80;
      if (!d) {
        if (requiresDecision) unreviewed++;
        else belowThreshold++;
      } else if (d === 'confirmed') confirmed++;
      else if (d === 'dismissed') dismissed++;
      else if (d === 'needs_info') needsInfo++;
    }
    return {
      all: matches.length,
      unreviewed,
      confirmed,
      dismissed,
      needs_info: needsInfo,
      pending: unreviewed + needsInfo,
      belowThreshold,
    };
  }, [matches, decisions]);

  // Filtered & searched matches
  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter(match => {
      const dec = decisions[match.recordId]?.decision;
      const requiresDecision = (match.percent ?? 100) >= 80;
      // Filter tab
      if (activeFilter === 'pending') {
        if (dec === 'confirmed' || dec === 'dismissed') return false;
        if (!dec && !requiresDecision) return false;
      }
      if (activeFilter === 'unreviewed') {
        if (dec || !requiresDecision) return false;
      }
      if (activeFilter === 'needs_info' && dec !== 'needs_info') return false;
      if (activeFilter === 'confirmed' && dec !== 'confirmed') return false;
      if (activeFilter === 'dismissed' && dec !== 'dismissed') return false;
      if (activeFilter === 'below_threshold') {
        if (requiresDecision) return false;
      }

      // Text query
      if (q) {
        const text = `${match.name} ${match.source} ${match.category} ${catLabel(match.category)}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [matches, decisions, activeFilter, searchQuery]);

  // Find next match index for "Save & Next"
  const getNextMatch = (currentRecordId: string) => {
    const currentIndex = filteredMatches.findIndex(m => m.recordId === currentRecordId);
    if (currentIndex >= 0 && currentIndex < filteredMatches.length - 1) {
      return filteredMatches[currentIndex + 1];
    }
    return null;
  };

  // Submit decision
  const handleSaveDecision = (andNext = false) => {
    if (!selectedMatch) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setFormError(m.decisionReasonHint || 'السبب إلزامي');
      return;
    }
    setFormError(null);

    const formData = new FormData();
    formData.set('customerId', customer.id);
    formData.set('recordId', selectedMatch.recordId);
    formData.set('decision', selectedDecision);
    formData.set('reason', trimmed);

    startTransition(async () => {
      const res = await saveMatchDecisionAction({}, formData);
      if (res.ok) {
        const newRow: DecisionRow = {
          record_id: selectedMatch.recordId,
          decision: selectedDecision,
          reason: trimmed,
          created_at: new Date(),
          decided_by_name: m.teamYou || 'أنت',
        };
        setDecisions(prev => ({ ...prev, [selectedMatch.recordId]: newRow }));
        setHistory(prev => [newRow, ...prev]);
        toast(m.decisionSaved, 'success');

        if (andNext) {
          const next = getNextMatch(selectedMatch.recordId);
          if (next) {
            setSelectedMatch(next);
            return;
          }
        }
        closeDrawer();
      } else {
        setFormError(m.decisionError);
        toast(m.decisionError, 'error');
      }
    });
  };

  // History for current selected match
  const selectedMatchHistory = useMemo(() => {
    if (!selectedMatch) return [];
    return history.filter(h => h.record_id === selectedMatch.recordId);
  }, [selectedMatch, history]);

  const displayedCount = matches.length;
  const undisplayedCount = Math.max(0, relevantCount - displayedCount);

  return (
    <div className="matches-workspace">
      {/* Top Controls: Filter Pills & Search */}
      <div className="matches-toolbar">
        <div className="matches-filter-pills" role="tablist" aria-label={m.matchesTitle}>
          <button
            type="button"
            className={`pill-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            {m.matchesAll} <span className="pill-count">{number(counts.all)}</span>
          </button>
          <button
            type="button"
            className={`pill-btn pending ${activeFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveFilter('pending')}
          >
            {m.matchesNeedsReview} <span className="pill-count">{number(counts.pending)}</span>
          </button>
          <button
            type="button"
            className={`pill-btn confirmed ${activeFilter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('confirmed')}
          >
            {m.filterConfirmed} <span className="pill-count">{number(counts.confirmed)}</span>
          </button>
          <button
            type="button"
            className={`pill-btn dismissed ${activeFilter === 'dismissed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('dismissed')}
          >
            {m.filterDismissed} <span className="pill-count">{number(counts.dismissed)}</span>
          </button>
          {counts.needs_info > 0 && (
            <button
              type="button"
              className={`pill-btn needs-info ${activeFilter === 'needs_info' ? 'active' : ''}`}
              onClick={() => setActiveFilter('needs_info')}
            >
              {m.filterNeedsInfo} <span className="pill-count">{number(counts.needs_info)}</span>
            </button>
          )}
          {counts.belowThreshold > 0 && (
            <button
              type="button"
              className={`pill-btn below-threshold ${activeFilter === 'below_threshold' ? 'active' : ''}`}
              onClick={() => setActiveFilter('below_threshold')}
            >
              {locale === 'en' ? 'Below 80% (Auto-excluded)' : 'أقل من ٨٠٪ (مستبعد تلقائياً)'} <span className="pill-count">{number(counts.belowThreshold)}</span>
            </button>
          )}
        </div>

        <div className="matches-search">
          <Search size={15} aria-hidden />
          <input
            type="text"
            placeholder={m.searchMatchesPh || 'ابحث في المطابقات…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label={m.searchMatchesPh || 'ابحث في المطابقات'}
          />
          {searchQuery && (
            <button type="button" className="clear-search" onClick={() => setSearchQuery('')} aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {undisplayedCount > 0 && (
        <div className="matches-cap-notice">
          <AlertTriangle size={15} />
          <span>
            {m.matchesStoredOnly} {number(displayedCount)} {m.gOf} {number(relevantCount)}.
          </span>
        </div>
      )}

      {/* Desktop Compact Table */}
      <div className="table-scroll matches-table-wrap">
        <table className="matches-table" dir={locale === 'en' ? 'ltr' : 'rtl'}>
          <thead>
            <tr>
              <th scope="col" style={{ width: '28%' }}>{m.rptName}</th>
              <th scope="col" style={{ width: '13%' }}>{m.rthCat}</th>
              <th scope="col" style={{ width: '21%' }}>{m.rthList}</th>
              <th scope="col" style={{ width: '13%' }}>{m.rthSeverity}</th>
              <th scope="col" style={{ width: '15%' }}>{m.rthDecision}</th>
              <th scope="col" style={{ width: '10%', textAlign: 'center' }}>{m.btnReview || (locale === 'en' ? 'Review' : 'المراجعة')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.map(match => {
              const dec = decisions[match.recordId];
              const extraSources = (match.sourceCount ?? 1) - 1;
              const isResolved = dec && dec.decision !== 'needs_info';

              return (
                <tr key={match.recordId} className={`match-row-item ${dec?.decision || 'unreviewed'}`}>
                  {/* Name & Reference */}
                  <td className="match-cell-name">
                    <strong dir="auto">{match.name}</strong>
                    <div className="match-cell-meta">
                      <span className="meta-code" dir="ltr">{match.code}</span>
                      {match.idMatch && <span className="cat-badge sanctions">{m.idMatched}</span>}
                      {match.dobMatch && <span className="cat-badge pep">{m.dobMatched}</span>}
                      {match.dobConflict && <span className="cat-badge conflict">{m.dobConflictL}</span>}
                    </div>
                    {!dec && match.percent >= 80 && aiRecommendations[match.recordId] && (
                      <button
                        type="button"
                        className={`ai-table-tag ${aiRecommendations[match.recordId].recommendation}`}
                        onClick={(e) => openDrawer(match, e)}
                        title={locale === 'en' ? aiRecommendations[match.recordId].headlineEn : aiRecommendations[match.recordId].headlineAr}
                      >
                        <Sparkles size={10} />
                        <span>
                          {aiRecommendations[match.recordId].recommendation === 'dismissed'
                            ? (locale === 'en' ? 'AI: False Positive' : 'توصية ذكية: استبعاد (تشابه سطحي)')
                            : aiRecommendations[match.recordId].recommendation === 'confirmed'
                            ? (locale === 'en' ? 'AI: True Positive' : 'توصية ذكية: اشتباه مؤكد')
                            : (locale === 'en' ? 'AI: Needs Info' : 'توصية ذكية: استيفاء بيانات')}
                        </span>
                      </button>
                    )}
                  </td>

                  {/* Category */}
                  <td>
                    <span className={`cat-badge ${match.category}`}>
                      {catLabel(match.category)}
                    </span>
                  </td>

                  {/* Source + Extra Sources */}
                  <td className="match-cell-source">
                    <span className="source-title" dir="auto">{match.source}</span>
                    {extraSources > 0 && (
                      <span className="extra-sources-badge">
                        +{number(extraSources)} {m.relatedLists}
                      </span>
                    )}
                  </td>

                  {/* Similarity & Severity */}
                  <td>
                    <div className="similarity-cell">
                      <span className={`risk-badge ${match.band}`}>
                        {bandLabel(match.band)}
                      </span>
                      <strong dir="ltr">{match.percent}%</strong>
                    </div>
                  </td>

                  {/* Review Status */}
                  <td>
                    {dec ? (
                      <div className="status-with-author">
                        <span className={`decision-badge ${dec.decision}`}>
                          {decLabel(dec.decision)}
                        </span>
                        {dec.decided_by_name && (
                          <small className="muted">{m.decidedByPrefix || 'بواسطة'} {dec.decided_by_name}</small>
                        )}
                      </div>
                    ) : match.percent < 80 ? (
                      <span className="not-run auto-excluded-badge" style={{ opacity: 0.8, fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                        {locale === 'en' ? 'Auto-excluded (< 80%)' : 'مستبعد تلقائياً (< ٨٠٪)'}
                      </span>
                    ) : (
                      <span className="not-run">{m.notReviewed}</span>
                    )}
                  </td>

                  {/* Action Button */}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className={`button ${isResolved ? 'secondary' : match.percent < 80 ? 'secondary' : 'primary'} compact-action-btn`}
                      onClick={e => openDrawer(match, e)}
                    >
                      {isResolved ? (m.btnEditDecision || 'تعديل القرار') : match.percent < 80 ? (locale === 'en' ? 'Review (Opt)' : 'مراجعة (اختياري)') : (m.btnReview || 'مراجعة')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Compact Cards View */}
      <div className="matches-cards-mobile">
        {filteredMatches.map(match => {
          const dec = decisions[match.recordId];
          const extraSources = (match.sourceCount ?? 1) - 1;
          const isResolved = dec && dec.decision !== 'needs_info';

          return (
            <article key={match.recordId} className={`match-mobile-card ${dec?.decision || 'unreviewed'}`}>
              <div className="card-top">
                <span className={`cat-badge ${match.category}`}>{catLabel(match.category)}</span>
                <span className={`risk-badge ${match.band}`}>{bandLabel(match.band)} {match.percent}%</span>
              </div>
              <h3 dir="auto">{match.name}</h3>
              <p className="source-line" dir="auto">
                {match.source}
                {extraSources > 0 && <small className="extra-count"> +{number(extraSources)} {m.relatedLists}</small>}
              </p>
              <div className="card-proofs">
                {match.idMatch && <span className="cat-badge sanctions">{m.idMatched}</span>}
                {match.dobMatch && <span className="cat-badge pep">{m.dobMatched}</span>}
                {match.dobConflict && <span className="cat-badge conflict">{m.dobConflictL}</span>}
                {!dec && match.percent >= 80 && aiRecommendations[match.recordId] && (
                  <button
                    type="button"
                    className={`ai-table-tag ${aiRecommendations[match.recordId].recommendation}`}
                    onClick={(e) => openDrawer(match, e)}
                  >
                    <Sparkles size={10} />
                    <span>
                      {aiRecommendations[match.recordId].recommendation === 'dismissed'
                        ? (locale === 'en' ? 'AI: False Positive' : 'توصية ذكية: استبعاد')
                        : aiRecommendations[match.recordId].recommendation === 'confirmed'
                        ? (locale === 'en' ? 'AI: True Positive' : 'توصية ذكية: تأكيد')
                        : (locale === 'en' ? 'AI: Needs Info' : 'توصية ذكية: استيفاء')}
                    </span>
                  </button>
                )}
              </div>
              <div className="card-footer">
                <div className="card-status">
                  {dec ? (
                    <span className={`decision-badge ${dec.decision}`}>{decLabel(dec.decision)}</span>
                  ) : match.percent < 80 ? (
                    <span className="not-run auto-excluded-badge" style={{ opacity: 0.8, fontSize: '0.8rem', color: 'var(--muted, #64748b)' }}>
                      {locale === 'en' ? 'Auto-excluded (< 80%)' : 'مستبعد تلقائياً (< ٨٠٪)'}
                    </span>
                  ) : (
                    <span className="not-run">{m.notReviewed}</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`button ${isResolved ? 'secondary' : match.percent < 80 ? 'secondary' : 'primary'} compact-action-btn`}
                  onClick={e => openDrawer(match, e)}
                >
                  {isResolved ? (m.btnEditDecision || 'تعديل') : match.percent < 80 ? (locale === 'en' ? 'Review (Opt)' : 'مراجعة (اختياري)') : (m.btnReview || 'مراجعة')}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredMatches.length === 0 && (
        <div className="empty matches-empty">
          <ShieldQuestion size={32} />
          <h3>{m.matchesNoResults}</h3>
        </div>
      )}

      {/* SLIDE-OVER REVIEW DRAWER */}
      {selectedMatch && (
        <div className="drawer-overlay" onClick={closeDrawer} role="dialog" aria-modal="true" aria-label={m.reviewDrawerTitle || 'مراجعة المطابقة'}>
          <div
            ref={drawerRef}
            className="review-drawer"
            dir={locale === 'en' ? 'ltr' : 'rtl'}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="drawer-head">
              <div className="drawer-title-group">
                <span className="drawer-eyebrow">
                  <span className={`cat-badge ${selectedMatch.category}`}>{catLabel(selectedMatch.category)}</span>
                  <span className={`risk-badge ${selectedMatch.band}`}>{bandLabel(selectedMatch.band)} · {selectedMatch.percent}%</span>
                </span>
                <h2 dir="auto">{selectedMatch.name}</h2>
                <small className="muted" dir="auto">{selectedMatch.source}</small>
              </div>
              <button type="button" className="drawer-close" onClick={closeDrawer} aria-label={m.cancel}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="drawer-body">
              {/* 1. Comparison Grid: Client vs Source Record */}
              <section className="drawer-section">
                <div className="section-head">
                  <UserCheck size={17} />
                  <h3>{m.fieldClientData || 'مقارنة البيانات'}</h3>
                </div>
                <div className="comparison-table">
                  <div className="comp-row head">
                    <span className="comp-col">{m.riskFactorCol || 'الحقل'}</span>
                    <span className="comp-col">{m.fieldClientData || 'بيانات العميل'}</span>
                    <span className="comp-col">{m.fieldRecordData || 'بيانات السجل'}</span>
                  </div>
                  <div className="comp-row">
                    <span className="comp-col label">{m.rptName}</span>
                    <span className="comp-col client" dir="auto"><strong>{customer.name}</strong></span>
                    <span className="comp-col record" dir="auto">
                      <strong>{selectedMatch.name}</strong>
                      {selectedMatch.recordAliases && selectedMatch.recordAliases.length > 0 && (
                        <div className="comp-subtext" dir="auto">
                          <span className="muted">{m.recAliases || 'الأسماء البديلة'}: </span>
                          <bdi>{selectedMatch.recordAliases.slice(0, 3).join(' • ')}</bdi>
                        </div>
                      )}
                    </span>
                  </div>
                  <div className="comp-row">
                    <span className="comp-col label">{m.fCountry}</span>
                    <span className="comp-col client">
                      <span className="flag">{flag(customer.country) || '🌐'}</span> {countryName(customer.country, locale)}
                    </span>
                    <span className="comp-col record">
                      {selectedMatch.recordCountry ? (
                        <span className="comp-country-display">
                          <span className="flag">{flag(selectedMatch.recordCountry) || '🌐'}</span>{' '}
                          <span>{countryName(selectedMatch.recordCountry, locale)}</span>
                          {selectedMatch.code && <span className="meta-code" dir="ltr">{selectedMatch.code}</span>}
                        </span>
                      ) : (
                        <span className="meta-code" dir="ltr">{selectedMatch.code}</span>
                      )}
                    </span>
                  </div>
                  <div className="comp-row">
                    <span className="comp-col label">{customer.entity_type === 'company' ? (locale === 'en' ? 'Incorporation' : 'التأسيس') : (m.chipDob || 'الميلاد')}</span>
                    <span className="comp-col client" dir="ltr"><bdi>{customer.date_of_birth || m.notAddedM}</bdi></span>
                    <span className="comp-col record">
                      <div className="comp-match-val-group">
                        {selectedMatch.recordDob && (
                          <span className="comp-date-val" dir="ltr"><bdi>{selectedMatch.recordDob}</bdi></span>
                        )}
                        {selectedMatch.dobMatch ? (
                          <span className="cat-badge pep">{m.dobMatched}</span>
                        ) : selectedMatch.dobConflict ? (
                          <span className="cat-badge conflict">{m.dobConflictL}</span>
                        ) : !selectedMatch.recordDob ? (
                          <span className="muted">—</span>
                        ) : null}
                      </div>
                    </span>
                  </div>
                  <div className="comp-row">
                    <span className="comp-col label">{m.chipId || 'المعرف'}</span>
                    <span className="comp-col client" dir="ltr"><bdi>{customer.identifier || m.notAddedM}</bdi></span>
                    <span className="comp-col record">
                      <div className="comp-match-val-group">
                        {selectedMatch.recordIdNumber ? (
                          <span className="comp-id-val" dir="ltr"><bdi>{selectedMatch.recordIdNumber}</bdi></span>
                        ) : selectedMatch.sourceRecordId ? (
                          <span className="comp-id-val" dir="ltr"><bdi>{selectedMatch.sourceRecordId}</bdi></span>
                        ) : (
                          <span className="meta-code" dir="ltr">{selectedMatch.recordId.slice(0, 16)}</span>
                        )}
                        {selectedMatch.idMatch && (
                          <span className="cat-badge sanctions">{m.idMatched}</span>
                        )}
                      </div>
                    </span>
                  </div>
                </div>
              </section>

              {/* 2. Evidence & Related Sources */}
              <section className="drawer-section">
                <div className="section-head">
                  <ShieldAlert size={17} />
                  <h3>{m.matchSources || 'الأدلة والمصادر'}</h3>
                </div>
                <div className="evidence-box">
                  <div className="primary-source-item">
                    <div>
                      <strong dir="auto">{selectedMatch.source}</strong>
                      <small dir="ltr" className="muted">ID: {selectedMatch.recordId}</small>
                    </div>
                    <Link
                      href={`/search/${selectedMatch.recordId}?returnTo=/profiles/${customer.reference}`}
                      className="text-link"
                    >
                      {m.openRecord} <ArrowUpLeft size={14} />
                    </Link>
                  </div>

                  {selectedMatch.relatedSources && selectedMatch.relatedSources.length > 0 && (
                    <div className="related-sources-list">
                      <span className="related-sources-title">{m.relatedLists}:</span>
                      <ul>
                        {selectedMatch.relatedSources.map((s, idx) => (
                          <li key={s.recordId + idx}>
                            <span dir="auto">{s.source}</span>
                            <Link
                              href={`/search/${s.recordId}?returnTo=/profiles/${customer.reference}`}
                              className="text-link"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* 3. Decision Form */}
              {canManage && (
                <section className="drawer-section decision-box">
                  <div className="section-head">
                    <FileCheck2 size={17} />
                    <h3>{m.decisionTitle}</h3>
                  </div>

                  {/* AI False Positive Assistant & Compliance Copilot */}
                  {aiRec && (
                    <div className={`ai-assistant-card ${aiRec.recommendation}`}>
                      <div className="ai-assistant-header">
                        <div className="ai-assistant-title-group">
                          <span className="ai-assistant-tag">
                            <Sparkles size={13} className="ai-sparkle-icon" />
                            <span>{locale === 'en' ? 'AI False Positive Assistant' : 'محلل قرارات الامتثال الذكي'}</span>
                          </span>
                          <span className={`ai-conf-badge ${aiRec.recommendation}`}>
                            {locale === 'en' ? `Confidence: ${aiRec.confidence}%` : `دقة التوصية: ${aiRec.confidence}%`}
                          </span>
                        </div>
                        <div className={`ai-rec-chip ${aiRec.recommendation}`}>
                          {aiRec.recommendation === 'confirmed' ? (
                            <CheckCircle2 size={15} />
                          ) : aiRec.recommendation === 'needs_info' ? (
                            <Clock3 size={15} />
                          ) : (
                            <XCircle size={15} />
                          )}
                          <span>{locale === 'en' ? aiRec.recommendationBadgeEn : aiRec.recommendationBadgeAr}</span>
                        </div>
                      </div>

                      {/* Highlighted System Quote */}
                      <div className="ai-assistant-quote-box">
                        <p className="ai-assistant-quote-text" dir="auto">
                          «{locale === 'en' ? aiRec.summaryEn : aiRec.summaryAr}»
                        </p>
                      </div>

                      {/* Factor Comparison Grid */}
                      <div className="ai-factors-grid">
                        {aiRec.factors.map(f => (
                          <div key={f.key} className={`ai-factor-item ${f.status}`}>
                            <div className="ai-factor-top">
                              <span className="ai-factor-icon">
                                {f.status === 'match' ? '✅' : f.status === 'conflict' ? '❌' : f.status === 'partial' ? '⚠️' : '⚪'}
                              </span>
                              <span className="ai-factor-label">{locale === 'en' ? f.labelEn : f.labelAr}</span>
                            </div>
                            <p className="ai-factor-detail" dir="auto">
                              {locale === 'en' ? f.detailEn : f.detailAr}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* 1-Click Action to Auto-Fill Decision and Reason */}
                      <div className="ai-assistant-action-bar">
                        <button
                          type="button"
                          className={`button ai-apply-btn ${aiRec.recommendation}`}
                          onClick={handleApplyAiRecommendation}
                        >
                          <Zap size={15} />
                          <span>
                            {locale === 'en'
                              ? '⚡ Auto-Apply Recommendation & Document Audit Reason'
                              : '⚡ تطبيق التوصية الآلية وتوثيق السبب آلياً'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div role="alert" className="form-error">
                      {formError}
                    </div>
                  )}

                  <div className="decision-radios-group">
                    <label className={`decision-radio-card confirmed ${selectedDecision === 'confirmed' ? 'checked' : ''}`}>
                      <input
                        type="radio"
                        name="drawerDecision"
                        value="confirmed"
                        checked={selectedDecision === 'confirmed'}
                        onChange={() => setSelectedDecision('confirmed')}
                      />
                      <span className="radio-visual">
                        <CheckCircle2 size={18} />
                        <span>
                          <strong>{m.decConfirmed}</strong>
                          <small>{m.decisionConfirmHint}</small>
                        </span>
                      </span>
                    </label>

                    <label className={`decision-radio-card dismissed ${selectedDecision === 'dismissed' ? 'checked' : ''}`}>
                      <input
                        type="radio"
                        name="drawerDecision"
                        value="dismissed"
                        checked={selectedDecision === 'dismissed'}
                        onChange={() => setSelectedDecision('dismissed')}
                      />
                      <span className="radio-visual">
                        <XCircle size={18} />
                        <span>
                          <strong>{m.decDismissed}</strong>
                          <small>{m.decisionDismissHint}</small>
                        </span>
                      </span>
                    </label>

                    <label className={`decision-radio-card needs-info ${selectedDecision === 'needs_info' ? 'checked' : ''}`}>
                      <input
                        type="radio"
                        name="drawerDecision"
                        value="needs_info"
                        checked={selectedDecision === 'needs_info'}
                        onChange={() => setSelectedDecision('needs_info')}
                      />
                      <span className="radio-visual">
                        <Clock3 size={18} />
                        <span>
                          <strong>{m.decNeedsInfo}</strong>
                          <small>{m.decisionNeedInfoHint}</small>
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="decision-reason-field">
                    <label htmlFor="drawer-reason">
                      {m.decisionReasonLabel} <em>*</em>
                    </label>
                    <textarea
                      id="drawer-reason"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder={m.decisionReasonHint}
                      rows={3}
                      maxLength={500}
                      required
                    />
                    <div className="textarea-footer">
                      <small className="muted">{m.decisionSaveHint}</small>
                      <small className="char-count" dir="ltr">{reason.length} / 500</small>
                    </div>
                  </div>
                </section>
              )}

              {/* 4. Decision History for this Match */}
              <section className="drawer-section history-section">
                <div className="section-head">
                  <Clock3 size={16} />
                  <h3>{m.matchHistoryTitle || 'سجل القرارات السابق'}</h3>
                </div>
                {selectedMatchHistory.length > 0 ? (
                  <div className="match-history-timeline">
                    {selectedMatchHistory.map((item, idx) => (
                      <div className="history-timeline-item" key={item.id || idx}>
                        <span className={`timeline-dot ${item.decision}`} />
                        <div className="history-content">
                          <div className="history-top">
                            <span className={`decision-badge ${item.decision}`}>
                              {decLabel(item.decision)}
                            </span>
                            <span className="history-author">
                              {item.decided_by_name || 'مراجع الامتثال'}
                            </span>
                            <small className="history-time">
                              <DateTimeText value={item.created_at} locale={locale} />
                            </small>
                          </div>
                          <p className="history-reason" dir="auto">{item.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted empty-history">
                    {m.noPriorDecisions || 'لا توجد قرارات سابقة مسجلة لهذه المطابقة.'}
                  </p>
                )}
              </section>
            </div>

            {/* Footer Actions */}
            <div className="drawer-foot">
              {canManage && (
                <>
                  <button
                    type="button"
                    className="button primary"
                    disabled={isPending}
                    onClick={() => handleSaveDecision(false)}
                  >
                    {isPending ? m.saving : m.saveDecision}
                  </button>
                  {getNextMatch(selectedMatch.recordId) && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={isPending}
                      onClick={() => handleSaveDecision(true)}
                    >
                      {m.btnSaveAndNext || 'حفظ والانتقال للتالي'}
                      {locale === 'en' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                  )}
                </>
              )}
              <button type="button" className="button secondary close-btn" onClick={closeDrawer}>
                {m.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
