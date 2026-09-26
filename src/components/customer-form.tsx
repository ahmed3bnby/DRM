'use client';

import Link from 'next/link';
import { useActionState, useState, useEffect } from 'react';
import { Save, Info, LoaderCircle, Building2, UserRound, AlertTriangle } from 'lucide-react';
import { createCustomerAction, editCustomerAction, type FormState } from '@/app/actions';
import type { Customer } from '@/lib/customers';
import { flag } from '@/components/ui';
import { useLocale } from '@/components/locale-context';
import { UAE_DNFBP_SECTORS, isCashThresholdSector } from '@/lib/risk-rating';

export default function CustomerForm({
  customer,
  defaults,
  countryList
}: {
  customer?: Customer;
  defaults?: Partial<Customer>;
  countryList: [string, string][];
}) {
  const { m, locale } = useLocale();
  const editing = !!customer;
  const [state, action, pending] = useActionState(
    editing ? editCustomerAction : createCustomerAction,
    {} as FormState
  );
  const error = (name: string) => state.fields?.[name]?.[0];
  const v = (name: string, fallback: string | null | undefined) => state.values?.[name] ?? fallback ?? '';

  const [entityType, setEntityType] = useState<string>(v('entityType', customer?.entity_type ?? defaults?.entity_type ?? 'company'));
  const [industry, setIndustry] = useState<string>(v('industry', customer?.industry ?? defaults?.industry));
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !pending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, pending]);

  const isCompany = entityType === 'company';

  return (
    <form
      action={action}
      className="panel form-panel"
      onChange={() => setIsDirty(true)}
      onSubmit={() => setIsDirty(false)}
    >
      {editing && <input type="hidden" name="id" value={customer.id} />}
      
      <div className="customer-form-group-head form-step-first">
        <span className="form-step-badge">01</span>
        <div>
          <h2>{editing ? m.formSecEdit : m.formSecNew}</h2>
          <p>{editing ? m.formSecEditHint : m.formSecNewHint}</p>
        </div>
      </div>

      {state.error && <div role="alert" className="form-error">{state.error}</div>}

      <section className="customer-form-group" aria-labelledby="identity-section">
        <div className="customer-form-group-head">
          <span className="form-step-badge">02</span>
          <div>
            <h3 id="identity-section">{m.formIdentityTitle}</h3>
            <p>{m.formIdentitySub}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field full">
            <label id="entityType-label">{m.fEntityType} <em>*</em></label>
            <div className="entity-type-segmented" role="radiogroup" aria-labelledby="entityType-label">
              <button
                type="button"
                role="radio"
                aria-checked={isCompany}
                className={`entity-segment ${isCompany ? 'active' : ''}`}
                onClick={() => {
                  setEntityType('company');
                  setIsDirty(true);
                }}
              >
                <Building2 size={17} />
                <span>{m.entityCompanyFull}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!isCompany}
                className={`entity-segment ${!isCompany ? 'active' : ''}`}
                onClick={() => {
                  setEntityType('individual');
                  setIsDirty(true);
                }}
              >
                <UserRound size={17} />
                <span>{m.entityIndividual}</span>
              </button>
            </div>
            <input type="hidden" name="entityType" value={entityType} />
          </div>

          <div className="field">
            <label htmlFor="name">
              {isCompany ? (locale === 'en' ? 'Company / Entity Name' : 'اسم الشركة أو الكيان') : m.flName} <em>*</em>
            </label>
            <input
              id="name"
              name="name"
              placeholder={isCompany ? (locale === 'en' ? 'e.g. Acme Gulf Holding LLC' : 'مثال: شركة الخليج للتجارة ش.ذ.م.م') : m.flNamePh}
              required
              minLength={2}
              maxLength={160}
              defaultValue={v('name', customer?.name ?? defaults?.name)}
              aria-invalid={!!error('name')}
              aria-describedby={error('name') ? 'name-error' : undefined}
            />
            {error('name') && <small id="name-error" className="field-error">{error('name')}</small>}
          </div>

          <div className="field">
            <label htmlFor="country">{m.flCountry} <em>*</em></label>
            <select id="country" name="country" defaultValue={v('country', customer?.country ?? defaults?.country ?? 'AE')}>
              {countryList.map(([code, name]) => (
                <option key={code} value={code}>
                  {flag(code) ? `${flag(code)}  ${name}` : name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="nationality">
              {isCompany ? (locale === 'en' ? 'Jurisdiction of Registration' : 'دولة التسجيل / المقر') : m.flNationality}{' '}
              <span>{m.flStrengthens}</span>
            </label>
            <select id="nationality" name="nationality" defaultValue={v('nationality', customer?.nationality ?? defaults?.nationality)}>
              <option value="">{m.flUnspecified}</option>
              {countryList.filter(([code]) => code !== 'OTHER').map(([code, name]) => (
                <option key={code} value={code}>
                  {flag(code) ? `${flag(code)}  ${name}` : name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="customer-form-group" aria-labelledby="screening-section">
        <div className="customer-form-group-head">
          <span className="form-step-badge">03</span>
          <div>
            <h3 id="screening-section">{m.formScreeningTitle}</h3>
            <p>{m.formScreeningSub}</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="deliveryChannel">
              {m.flDelivery} <span>{m.flStrengthens}</span>
            </label>
            <select id="deliveryChannel" name="deliveryChannel" defaultValue={v('deliveryChannel', customer?.delivery_channel)}>
              <option value="">{m.flUnspecified}</option>
              <option value="face_to_face">{m.dcFaceToFace}</option>
              <option value="non_face_to_face">{m.dcNonFaceToFace}</option>
              <option value="online">{m.dcOnline}</option>
            </select>
          </div>

          <div className="field full industry-field-wrapper">
            <div className="field-label-row">
              <label htmlFor="industry">{m.flIndustry}</label>
              <select
                className="dnfbp-quick-select"
                aria-label={m.dnfbpQuickSelect}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setIndustry(e.target.value);
                    setIsDirty(true);
                  }
                }}
              >
                <option value="">⚡ {m.dnfbpQuickSelect}</option>
                {UAE_DNFBP_SECTORS.map((s) => (
                  <option key={s.id} value={locale === 'en' ? s.labelEn : s.labelAr}>
                    {locale === 'en' ? s.labelEn : s.labelAr}
                  </option>
                ))}
              </select>
            </div>
            <input
              id="industry"
              name="industry"
              maxLength={120}
              placeholder={m.flIndustryPh}
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setIsDirty(true);
              }}
            />
            {isCashThresholdSector(industry) && (
              <div className="dnfbp-cash-pill">
                <AlertTriangle size={14} />
                <span>{m.goAmlCashNoticeTitle} · {locale === 'en' ? 'Subject to AED 50k cash filing on goAML' : 'خاضع لإلزامية الإبلاغ عن الدفعات النقدية ≥ 50 ألف درهم عبر goAML'}</span>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="email">
              {m.fEmail} <span>{m.flEmailOpt}</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              dir="ltr"
              spellCheck={false}
              placeholder="name@example.com"
              defaultValue={v('email', customer?.email ?? defaults?.email)}
              aria-invalid={!!error('email')}
            />
            {error('email') && <small className="field-error">{error('email')}</small>}
          </div>

          <div className="field">
            <label htmlFor="dateOfBirth">
              {isCompany ? m.chipFoundingDate : m.flDobLabel}{' '}
              <span>{m.flStrengthens}</span>
            </label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              dir="ltr"
              maxLength={40}
              placeholder={isCompany ? (locale === 'en' ? 'YYYY-MM-DD (Incorporation)' : 'YYYY-MM-DD (تاريخ التأسيس)') : m.flDobPh}
              defaultValue={v('dateOfBirth', customer?.date_of_birth ?? defaults?.date_of_birth)}
              aria-invalid={!!error('dateOfBirth')}
            />
            {error('dateOfBirth') && <small className="field-error">{error('dateOfBirth')}</small>}
          </div>

          <div className="field">
            <label htmlFor="identifier">
              {isCompany ? m.chipCrNumber : m.flIdLabel}{' '}
              <span>{m.flStrengthens}</span>
            </label>
            <input
              id="identifier"
              name="identifier"
              dir="ltr"
              maxLength={80}
              placeholder={isCompany ? (locale === 'en' ? 'Commercial Registration or License No.' : 'رقم السجل التجاري أو الرخصة') : m.flIdPh}
              defaultValue={v('identifier', customer?.identifier ?? defaults?.identifier)}
              aria-invalid={!!error('identifier')}
            />
            {error('identifier') && <small className="field-error">{error('identifier')}</small>}
          </div>
        </div>
      </section>

      <section className="customer-form-group notes-group" aria-labelledby="notes-section">
        <div className="customer-form-group-head">
          <span className="form-step-badge">04</span>
          <div>
            <h3 id="notes-section">{m.formNotesTitle}</h3>
            <p>{m.formNotesSub}</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="notes">{m.flNotes}</label>
          <textarea
            id="notes"
            name="notes"
            maxLength={2000}
            rows={4}
            placeholder={m.flNotesPh}
            defaultValue={v('notes', customer?.notes ?? defaults?.notes)}
          />
        </div>
      </section>

      <div className="inline-info">
        <Info size={19} />
        <p>{editing ? m.formInfoEdit : m.formInfoNew}</p>
      </div>

      <div className="form-actions">
        <button disabled={pending} className="button primary" type="submit">
          {pending ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
          {pending ? m.saving : (editing ? m.saveEdits : m.saveCustomer)}
        </button>
        <Link href={editing ? `/profiles/${customer.reference}` : '/profiles'} className="button secondary">
          {m.cancel}
        </Link>
      </div>
    </form>
  );
}
