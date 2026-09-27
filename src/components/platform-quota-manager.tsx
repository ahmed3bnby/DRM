'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Plus,
  History,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sliders,
  X,
  Building2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Infinity as InfinityIcon,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { PlatformChecksSummary, AccountQuotaItem, PlatformQuotaHistoryItem } from '@/lib/platform';
import { DateTimeText, number } from '@/components/ui';
import { superAdminCreditQuotaAction } from '@/app/actions';

export default function PlatformQuotaManager({
  summary,
  accounts,
  history,
  locale,
}: {
  summary: PlatformChecksSummary;
  accounts: AccountQuotaItem[];
  history: PlatformQuotaHistoryItem[];
  locale: string;
}) {
  const isAr = locale === 'ar';
  const [activeTab, setActiveTab] = useState<'accounts' | 'history'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');

  // Top-up Modal State
  const [selectedUser, setSelectedUser] = useState<AccountQuotaItem | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'set' | 'unlimited'>('add');
  const [addAmount, setAddAmount] = useState<number>(100);
  const [setAmount, setSetAmount] = useState<number>(500);
  const [resetAnchor, setResetAnchor] = useState<boolean>(true);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      a.displayName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.organizationName.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    );
  }, [accounts, searchQuery]);

  // Filter history
  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) =>
      h.userDisplayName.toLowerCase().includes(q) ||
      h.userEmail.toLowerCase().includes(q) ||
      h.organizationName.toLowerCase().includes(q) ||
      h.actorName.toLowerCase().includes(q) ||
      (h.note && h.note.toLowerCase().includes(q)) ||
      h.actionType.toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

  const handleOpenModal = (user: AccountQuotaItem) => {
    setSelectedUser(user);
    setModalMode('add');
    setAddAmount(100);
    setSetAmount(user.searchQuota ?? 500);
    setResetAnchor(true);
    setNote('');
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setIsSubmitting(false);
  };

  const handleFormSubmit = () => {
    setIsSubmitting(true);
  };

  return (
    <section className="panel platform-quota-section">
      {/* Header with Title & Tabs */}
      <div className="platform-quota-header">
        <div className="platform-quota-title-wrap">
          <div className="platform-quota-badge-icon">
            <Activity size={20} />
          </div>
          <div>
            <h2>
              {isAr ? 'إحصائيات الفحص والحصص وسجل الشحن' : 'Platform Screening Checks & Quota Management'}
            </h2>
            <p>
              {isAr
                ? 'متابعة إجمالي الفحوصات المنفذة عبر المنظومة، تفاصيل استهلاك ورصيد كل حساب، وسجل تدقيق عمليات الشحن والتحديثات الدورية.'
                : 'Monitor platform-wide screening checks, individual account allowances and consumption, and full credit audit history.'}
            </p>
          </div>
        </div>

        <div className="platform-quota-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'accounts'}
            onClick={() => setActiveTab('accounts')}
            className={`platform-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          >
            <Users size={16} />
            <span>{isAr ? 'حسابات المستخدمين والرصيد' : 'Accounts & Quota'}</span>
            <span className="platform-tab-counter">{accounts.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`platform-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          >
            <History size={16} />
            <span>{isAr ? 'سجل عمليات الشحن والتحديث' : 'Credit & Update Audit Log'}</span>
            <span className="platform-tab-counter">{history.length}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="platform-stats-grid platform-checks-summary-grid">
        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-emerald">
            <ShieldCheck size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'إجمالي الفحوصات المنفذة في المنظومة' : 'Total Platform Checks Executed'}
            </span>
            <strong className="platform-stat-val text-emerald">
              {number(summary.totalChecks)}
            </strong>
            <span className="platform-stat-sub">
              {isAr
                ? `اليوم: ${number(summary.todayChecks)} تشييكة · آخر 7 أيام: ${number(summary.weekChecks)}`
                : `Today: ${number(summary.todayChecks)} · Last 7 days: ${number(summary.weekChecks)}`}
            </span>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon">
            <Users size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'الحسابات النشطة بالفحص' : 'Active Screening Accounts'}
            </span>
            <strong className="platform-stat-val">
              {number(summary.activeAccounts)}{' '}
              <span className="platform-stat-val-sub">/ {number(accounts.length)}</span>
            </strong>
            <span className="platform-stat-sub">
              {isAr
                ? `${summary.unlimitedAccounts} حساب غير محدود · ${summary.totalAccountsWithQuota} بحصة محددة`
                : `${summary.unlimitedAccounts} unlimited accounts · ${summary.totalAccountsWithQuota} with quota`}
            </span>
          </div>
        </div>

        <div className="platform-stat-card">
          <div className="platform-stat-icon tint-gold">
            <TrendingUp size={22} />
          </div>
          <div className="platform-stat-content">
            <span className="platform-stat-label">
              {isAr ? 'إجمالي الحصص المشحونة والمخصصة' : 'Total Quota Checks Allocated'}
            </span>
            <strong className="platform-stat-val text-gold">
              {number(summary.totalAllocatedQuota)}
            </strong>
            <span className="platform-stat-sub">
              {isAr
                ? 'مجموع الحصص المخصصة لحسابات المحللين بالمنظومة'
                : 'Sum of allocated checks across analyst accounts'}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="platform-quota-toolbar">
        <div className="platform-search-wrap">
          <Search size={16} className="platform-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'accounts'
                ? (isAr ? 'ابحث باسم الحساب، البريد، المؤسسة أو الدور...' : 'Filter accounts by name, email, org, or role...')
                : (isAr ? 'ابحث في سجل الشحن بالمستخدم، المؤسسة، المسؤول أو الملاحظة...' : 'Filter history by user, organization, admin, or note...')
            }
            className="platform-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="platform-search-clear"
              aria-label={isAr ? 'مسح البحث' : 'Clear search'}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: ACCOUNTS & QUOTA BREAKDOWN */}
      {activeTab === 'accounts' && (
        <div className="platform-table-wrapper">
          <table className="platform-quota-table">
            <thead>
              <tr>
                <th>{isAr ? 'المستخدم والحساب' : 'User Account'}</th>
                <th>{isAr ? 'المؤسسة' : 'Organization'}</th>
                <th>{isAr ? 'الحصة المضافة (اتضافله كام)' : 'Allocated Quota'}</th>
                <th>{isAr ? 'المستهلك حالياً (خلص كام)' : 'Current Used'}</th>
                <th>{isAr ? 'الرصيد المتبقي' : 'Remaining Balance'}</th>
                <th>{isAr ? 'إجمالي الفحوصات' : 'Lifetime Checks'}</th>
                <th>{isAr ? 'آخر شحن / تعديل' : 'Last Top-Up / Credit'}</th>
                <th style={{ textAlign: 'center' }}>{isAr ? 'إجراء المشرف العام' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="platform-table-empty">
                    {isAr ? 'لا توجد حسابات مطابقة لبحثك' : 'No accounts found matching your query.'}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isUnlimited = acc.searchQuota === null;
                  const isDepleted = !isUnlimited && acc.remaining !== null && acc.remaining <= 0;
                  const isLow = !isUnlimited && acc.remaining !== null && acc.remaining > 0 && acc.remaining <= 15;

                  return (
                    <tr key={acc.id} className={acc.disabledAt ? 'row-disabled' : ''}>
                      <td>
                        <div className="account-user-cell">
                          <strong>{acc.displayName}</strong>
                          <span className="account-email-sub">{acc.email}</span>
                          <span className={`role-pill role-${acc.role}`}>
                            {acc.role === 'admin'
                              ? (isAr ? 'مدير' : 'Admin')
                              : acc.role === 'analyst'
                              ? (isAr ? 'محلل' : 'Analyst')
                              : (isAr ? 'مراجع' : 'Viewer')}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="account-org-cell">
                          <Building2 size={14} />
                          <span>{acc.organizationName}</span>
                        </div>
                      </td>

                      <td>
                        {isUnlimited ? (
                          <span className="quota-badge quota-unlimited">
                            <InfinityIcon size={14} /> {isAr ? 'غير محدود' : 'Unlimited'}
                          </span>
                        ) : (
                          <span className="quota-badge quota-count">
                            {number(acc.searchQuota!)} {isAr ? 'تشييكة' : 'checks'}
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="usage-cell">
                          <strong>{number(acc.usedInCycle)}</strong> {isAr ? 'تشييكة' : 'checks'}
                          {!isUnlimited && acc.searchQuota! > 0 && (
                            <div className="mini-progress-bar">
                              <div
                                className={`mini-progress-fill ${isDepleted ? 'fill-red' : isLow ? 'fill-amber' : 'fill-green'}`}
                                style={{
                                  width: `${Math.min(100, Math.round((acc.usedInCycle / acc.searchQuota!) * 100))}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        {isUnlimited ? (
                          <span className="status-badge badge-green">
                            <CheckCircle2 size={13} /> {isAr ? 'متاح بلا حدود' : 'Unlimited'}
                          </span>
                        ) : isDepleted ? (
                          <span className="status-badge badge-red">
                            <AlertCircle size={13} /> {isAr ? 'نفد الرصيد (0)' : 'Depleted (0)'}
                          </span>
                        ) : isLow ? (
                          <span className="status-badge badge-amber">
                            <AlertCircle size={13} /> {acc.remaining} {isAr ? 'متبقية (منخفض)' : 'remaining'}
                          </span>
                        ) : (
                          <span className="status-badge badge-green">
                            <CheckCircle2 size={13} /> {acc.remaining} {isAr ? 'تشييكة متبقية' : 'remaining'}
                          </span>
                        )}
                      </td>

                      <td>
                        <span className="account-lifetime-checks">
                          {number(acc.lifetimeChecks)} {isAr ? 'فحص' : 'checks'}
                        </span>
                      </td>

                      <td>
                        {acc.lastCreditAt ? (
                          <div className="account-last-credit-cell">
                            {acc.lastCreditDelta !== null && (
                              <span className={`credit-delta-chip ${acc.lastCreditDelta >= 0 ? 'plus' : 'minus'}`}>
                                {acc.lastCreditDelta >= 0 ? `+${number(acc.lastCreditDelta)}` : number(acc.lastCreditDelta)}
                              </span>
                            )}
                            <DateTimeText value={acc.lastCreditAt} locale={isAr ? 'ar' : 'en'} />
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(acc)}
                          className="button button-secondary button-sm action-topup-btn"
                          title={isAr ? 'شحن رصيد إضافي أو تعديل الحصة' : 'Credit checks or adjust quota'}
                        >
                          <Plus size={14} />
                          <span>{isAr ? 'شحن / تعديل' : 'Credit / Edit'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: QUOTA AUDIT TRAIL & CREDIT HISTORY */}
      {activeTab === 'history' && (
        <div className="platform-table-wrapper">
          <table className="platform-quota-table">
            <thead>
              <tr>
                <th>{isAr ? 'تاريخ ووقت العملية (يوم كام وساعة كام)' : 'Date & Time'}</th>
                <th>{isAr ? 'المستخدم المستفيد' : 'Target Account'}</th>
                <th>{isAr ? 'المؤسسة' : 'Organization'}</th>
                <th>{isAr ? 'المقدار المضاف ("زود كام واحدة")' : 'Checks Added / Delta'}</th>
                <th>{isAr ? 'تفاصيل الحصة (قبل ← بعد)' : 'Quota Shift'}</th>
                <th>{isAr ? 'نوع العملية' : 'Action Type'}</th>
                <th>{isAr ? 'القائم بالعملية' : 'Executed By'}</th>
                <th>{isAr ? 'البيان والملاحظة' : 'Note / Reason'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="platform-table-empty">
                    {isAr
                      ? 'لا توجد حركات شحن أو تعديل حصص مسجلة حتى الآن'
                      : 'No quota credit or adjustment events found.'}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const isPlus = item.delta !== null && item.delta > 0;
                  const isMinus = item.delta !== null && item.delta < 0;

                  return (
                    <tr key={item.id}>
                      <td className="history-date-cell">
                        <div className="history-date-wrap">
                          <Calendar size={14} className="text-muted" />
                          <DateTimeText value={item.createdAt} locale={isAr ? 'ar' : 'en'} />
                        </div>
                      </td>

                      <td>
                        <div className="account-user-cell">
                          <strong>{item.userDisplayName}</strong>
                          <span className="account-email-sub">{item.userEmail}</span>
                        </div>
                      </td>

                      <td>
                        <div className="account-org-cell">
                          <Building2 size={13} />
                          <span>{item.organizationName}</span>
                        </div>
                      </td>

                      <td>
                        {item.delta !== null ? (
                          <span className={`quota-delta-badge ${isPlus ? 'plus' : isMinus ? 'minus' : 'neutral'}`}>
                            {isPlus ? `+${number(item.delta)}` : number(item.delta)} {isAr ? 'تشييكة' : 'checks'}
                          </span>
                        ) : item.newQuota === null ? (
                          <span className="quota-delta-badge unlimited">
                            <InfinityIcon size={12} /> {isAr ? 'غير محدود' : 'Unlimited'}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td>
                        <div className="history-shift-cell" dir="ltr">
                          <span className="shift-from">{item.previousQuota ?? '∞'}</span>
                          <ArrowRight size={13} className="shift-arrow" />
                          <span className="shift-to">{item.newQuota ?? '∞'}</span>
                        </div>
                      </td>

                      <td>
                        <span className={`history-type-pill type-${item.actionType}`}>
                          {item.actionType === 'quota_credited'
                            ? (isAr ? 'شحن رصيد إضافي' : 'Credit Top-up')
                            : item.actionType === 'user_created'
                            ? (isAr ? 'إنشاء حساب جديد' : 'User Created')
                            : item.actionType === 'role_changed'
                            ? (isAr ? 'تغيير الدور' : 'Role Changed')
                            : (isAr ? 'تعديل الحصة' : 'Quota Updated')}
                        </span>
                      </td>

                      <td>
                        <div className="history-actor-cell">
                          <span className="actor-name">{item.actorName}</span>
                        </div>
                      </td>

                      <td className="history-note-cell">
                        {item.note ? (
                          <span className="history-note-text" title={item.note}>
                            {item.note}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUPER ADMIN TOP-UP / CREDIT MODAL */}
      {selectedUser && (
        <div className="platform-modal-overlay" onClick={handleCloseModal}>
          <div className="platform-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="platform-modal-header">
              <div className="platform-modal-title">
                <Sliders size={20} className="text-emerald" />
                <div>
                  <h3>
                    {isAr ? 'شحن وتعديل رصيد الفحص' : 'Credit & Adjust Screening Quota'}
                  </h3>
                  <p>
                    {isAr
                      ? `للمستخدم: ${selectedUser.displayName} (${selectedUser.organizationName})`
                      : `For: ${selectedUser.displayName} (${selectedUser.organizationName})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="platform-modal-close"
                onClick={handleCloseModal}
                aria-label={isAr ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Account Status Box */}
            <div className="account-current-status-box">
              <div className="status-box-item">
                <span className="status-box-label">{isAr ? 'الحصة الحالية' : 'Current Quota'}</span>
                <strong className="status-box-val">
                  {selectedUser.searchQuota !== null
                    ? `${number(selectedUser.searchQuota)} ${isAr ? 'تشييكة' : 'checks'}`
                    : (isAr ? '∞ غير محدود' : '∞ Unlimited')}
                </strong>
              </div>
              <div className="status-box-item">
                <span className="status-box-label">{isAr ? 'المستهلك حالياً' : 'Current Used'}</span>
                <strong className="status-box-val text-amber">
                  {number(selectedUser.usedInCycle)} {isAr ? 'تشييكة' : 'checks'}
                </strong>
              </div>
              <div className="status-box-item">
                <span className="status-box-label">{isAr ? 'الرصيد المتبقي' : 'Remaining'}</span>
                <strong className="status-box-val text-emerald">
                  {selectedUser.remaining !== null
                    ? `${number(selectedUser.remaining)} ${isAr ? 'تشييكة' : 'checks'}`
                    : (isAr ? '∞ غير محدود' : '∞ Unlimited')}
                </strong>
              </div>
            </div>

            <form action={superAdminCreditQuotaAction} onSubmit={handleFormSubmit} className="platform-modal-form">
              <input type="hidden" name="userId" value={selectedUser.id} />
              <input type="hidden" name="mode" value={modalMode} />

              {/* Mode Selection Tabs */}
              <div className="modal-mode-selector">
                <button
                  type="button"
                  className={`mode-btn ${modalMode === 'add' ? 'selected' : ''}`}
                  onClick={() => setModalMode('add')}
                >
                  <Plus size={15} />
                  <span>{isAr ? 'إضافة رصيد سريع (+N)' : 'Add Checks (+N)'}</span>
                </button>
                <button
                  type="button"
                  className={`mode-btn ${modalMode === 'set' ? 'selected' : ''}`}
                  onClick={() => setModalMode('set')}
                >
                  <Sliders size={15} />
                  <span>{isAr ? 'تحديد سقف جديد للحصة' : 'Set Exact Limit'}</span>
                </button>
                <button
                  type="button"
                  className={`mode-btn ${modalMode === 'unlimited' ? 'selected' : ''}`}
                  onClick={() => setModalMode('unlimited')}
                >
                  <InfinityIcon size={15} />
                  <span>{isAr ? 'حصة غير محدودة (∞)' : 'Unlimited (∞)'}</span>
                </button>
              </div>

              {/* MODE 1: ADD CHECKS */}
              {modalMode === 'add' && (
                <div className="modal-fields-group">
                  <label className="platform-field-label">
                    {isAr ? 'اختر الكمية الإضافية للشحن السريع:' : 'Quick credit preset:'}
                  </label>
                  <div className="quick-amount-chips">
                    {[50, 100, 250, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAddAmount(preset)}
                        className={`preset-chip ${addAmount === preset ? 'active' : ''}`}
                      >
                        +{number(preset)} {isAr ? 'تشييكة' : ''}
                      </button>
                    ))}
                  </div>

                  <div className="platform-input-wrap">
                    <label htmlFor="custom-add-amount" className="platform-field-label">
                      {isAr ? 'أو أدخل كمية مخصصة للإضافة:' : 'Or enter custom amount to add:'}
                    </label>
                    <input
                      id="custom-add-amount"
                      type="number"
                      name="amount"
                      min={1}
                      max={1000000}
                      value={addAmount}
                      onChange={(e) => setAddAmount(Math.max(1, Number(e.target.value)))}
                      className="platform-input"
                      required
                    />
                  </div>

                  <div className="credit-preview-box">
                    <Sparkles size={16} className="text-emerald" />
                    <span>
                      {isAr
                        ? `النتيجة بعد الشحن: ستتم إضافة +${number(addAmount)} تشييكة لتصبح الحصة الإجمالية ${
                            selectedUser.searchQuota !== null ? number(selectedUser.searchQuota + addAmount) : number(addAmount)
                          } تشييكة.`
                        : `After credit: +${number(addAmount)} checks will be added, making the total allowance ${
                            selectedUser.searchQuota !== null ? number(selectedUser.searchQuota + addAmount) : number(addAmount)
                          }.`}
                    </span>
                  </div>
                </div>
              )}

              {/* MODE 2: SET EXACT LIMIT */}
              {modalMode === 'set' && (
                <div className="modal-fields-group">
                  <div className="platform-input-wrap">
                    <label htmlFor="exact-quota-input" className="platform-field-label">
                      {isAr ? 'حدد سقف الحصة الإجمالية (عدد الفحوصات):' : 'Set exact total quota limit (number of checks):'}
                    </label>
                    <input
                      id="exact-quota-input"
                      type="number"
                      name="amount"
                      min={0}
                      max={1000000}
                      value={setAmount}
                      onChange={(e) => setSetAmount(Math.max(0, Number(e.target.value)))}
                      className="platform-input"
                      required
                    />
                  </div>

                  <label className="platform-checkbox-label">
                    <input
                      type="checkbox"
                      name="resetAnchor"
                      value="true"
                      checked={resetAnchor}
                      onChange={(e) => setResetAnchor(e.target.checked)}
                    />
                    <span>
                      {isAr
                        ? 'تصفير عداد الاستهلاك الحالي للدورة (منح الحصة كاملة كدورة جديدة تبدأ من الآن)'
                        : 'Reset current cycle usage counter (start fresh with 0 used for this new quota)'}
                    </span>
                  </label>
                </div>
              )}

              {/* MODE 3: UNLIMITED */}
              {modalMode === 'unlimited' && (
                <div className="modal-fields-group">
                  <div className="unlimited-notice-box">
                    <InfinityIcon size={24} className="text-emerald" />
                    <div>
                      <strong>{isAr ? 'إلغاء قيود الحصة الشهرية' : 'Remove Quota Limits'}</strong>
                      <p>
                        {isAr
                          ? 'سيتمكن هذا الحساب من إجراء الفحوصات والتحريات بدون أي حد أقصى للعمليات.'
                          : 'This user account will be able to perform unlimited searches and screenings.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Note / Reason Field */}
              <div className="platform-input-wrap">
                <label htmlFor="quota-note-input" className="platform-field-label">
                  {isAr ? 'ملاحظة أو سبب الشحن (تُحفظ في سجل التدقيق):' : 'Note or top-up reason (recorded in audit trail):'}
                </label>
                <input
                  id="quota-note-input"
                  type="text"
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: شحن باقة إضافية للعميل، تمديد تجريبي، ترقية دورية...'
                      : 'e.g. Additional bundle credit, trial extension, custom top-up...'
                  }
                  className="platform-input"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="platform-modal-actions">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="button button-secondary"
                  disabled={isSubmitting}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="button button-primary action-confirm-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{isAr ? 'تأكيد الشحن والتحديث' : 'Confirm Credit & Save'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
