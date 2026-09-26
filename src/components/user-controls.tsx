'use client';

import { useActionState, useEffect, useState } from 'react';
import { Eye, KeyRound, SearchCheck, ShieldCheck, UserPen } from 'lucide-react';
import { manageUserAction, type UserControlState } from '@/app/actions';
import { useToast } from '@/components/toast';
import { useLocale } from '@/components/locale-context';

export default function UserControls({
  userId,
  displayName,
  email,
  role,
  quota,
  disabled,
  isSelf,
}: {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  quota: number | null;
  disabled: boolean;
  isSelf: boolean;
}) {
  const { m, locale } = useLocale();
  const toast = useToast();
  const [state, action, pending] = useActionState(manageUserAction, {} as UserControlState);
  const [nameVal, setNameVal] = useState(displayName);
  const [emailVal, setEmailVal] = useState(email);
  const [nextRole, setNextRole] = useState(role);
  const [quotaValue, setQuotaValue] = useState(String(quota ?? 50));

  useEffect(() => {
    if (state.ok === 'profile') toast(m.teamProfileSaved, 'success');
    else if (state.ok === 'role') toast(m.teamRoleSaved, 'success');
    else if (state.ok === 'password') toast(m.teamPasswordSaved, 'success');
    else if (state.ok === 'disabled') toast(m.teamDisabledSaved, 'success');
    else if (state.ok === 'enabled') toast(m.teamEnabledSaved, 'success');
    else if (state.error === 'EMAIL_TAKEN') toast(m.teamErrEmailTaken, 'error');
    else if (state.error === 'NAME_SHORT') toast(m.teamErrNameShort, 'error');
    else if (state.error === 'INVALID_EMAIL') toast(m.teamErrInvalidEmail, 'error');
    else if (state.error === 'SELF') toast(m.teamErrSelf, 'error');
    else if (state.error === 'LAST_ADMIN') toast(m.teamErrLastAdmin, 'error');
    else if (state.error === 'HAS_HISTORY') toast(m.teamErrHistory, 'error');
    else if (state.error === 'PASSWORD') toast(m.teamFPasswordHint, 'error');
    else if (state.error) toast(m.teamErrGeneric, 'error');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const roles = [
    { value: 'viewer', label: m.roleViewerOpt, hint: m.teamRoleViewerHint, icon: Eye },
    { value: 'analyst', label: m.roleAnalystOpt, hint: m.teamRoleAnalystHint, icon: SearchCheck },
    { value: 'admin', label: m.roleAdminOpt, hint: m.teamRoleAdminHint, icon: ShieldCheck },
  ] as const;
  const presets = [25, 50, 100, 250];
  const isArabic = locale === 'ar';

  return (
    <div className="user-controls">
      {/* 1. Edit Profile: Name and Email */}
      <section className="user-control-section profile-control">
        <div className="user-control-head">
          <div>
            <h3>
              <UserPen size={17} style={{ verticalAlign: 'middle', marginInlineEnd: '6px' }} />
              {m.teamEditProfileTitle}
            </h3>
            <p>{m.teamEditProfileHint}</p>
          </div>
        </div>
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="intent" value="profile" />
          <div className="field">
            <label htmlFor="user-displayName">
              {locale === 'en' ? 'Full Display Name' : 'الاسم الكامل المعروض'}
            </label>
            <input
              id="user-displayName"
              name="displayName"
              type="text"
              dir="auto"
              required
              minLength={2}
              maxLength={80}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              placeholder={locale === 'en' ? 'e.g. Sarah Ahmed' : 'مثال: سارة أحمد'}
            />
          </div>
          <div className="field" style={{ marginTop: '10px' }}>
            <label htmlFor="user-email">
              {locale === 'en' ? 'Email Address' : 'البريد الإلكتروني'}
            </label>
            <input
              id="user-email"
              name="email"
              type="email"
              dir="ltr"
              required
              value={emailVal}
              onChange={e => setEmailVal(e.target.value)}
              placeholder="user@drm.ae"
            />
          </div>
          <button className="button primary sm" style={{ marginTop: '12px' }} disabled={pending}>
            {m.teamSaveProfile}
          </button>
        </form>
      </section>

      {/* If looking at self: show note for role/delete restrictions */}
      {isSelf ? (
        <div className="user-self-note">
          <ShieldCheck size={18} />
          <p>{m.teamSelfNote}</p>
        </div>
      ) : (
        /* 2. Access and Quota (for other users) */
        <section className="user-control-section access-control">
          <div className="user-control-head">
            <div>
              <h3>{m.teamAccessTitle}</h3>
              <p>{m.teamAccessHint}</p>
            </div>
            <span className={`role-badge role-${nextRole}`}>
              {roles.find(item => item.value === nextRole)?.label}
            </span>
          </div>
          <form action={action}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="intent" value="role" />
            <input type="hidden" name="role" value={nextRole} />
            <div className="role-picker" role="radiogroup" aria-label={m.teamFRole}>
              {roles.map(item => {
                const Icon = item.icon;
                const selected = nextRole === item.value;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setNextRole(item.value)}
                    className={`role-option ${item.value}${selected ? ' selected' : ''}`}
                    key={item.value}
                  >
                    <Icon size={17} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {nextRole !== 'admin' ? (
              <div className="quota-editor">
                <div className="field">
                  <label htmlFor="quota">{m.teamFQuota}</label>
                  <input
                    id="quota"
                    name="quota"
                    type="number"
                    dir="ltr"
                    min={0}
                    max={1000000}
                    value={quotaValue}
                    onChange={event => setQuotaValue(event.target.value)}
                    title={m.teamFQuotaHint}
                  />
                </div>
                <div className="quota-presets">
                  <span>{m.teamQuotaPresets}</span>
                  <div>
                    {presets.map(value => (
                      <button
                        type="button"
                        key={value}
                        className={quotaValue === String(value) ? 'selected' : ''}
                        onClick={() => setQuotaValue(String(value))}
                      >
                        {isArabic ? new Intl.NumberFormat('ar-EG').format(value) : value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="unlimited-role-note">
                <ShieldCheck size={17} />
                {m.teamUnlimitedHint}
              </div>
            )}
            <button className="button primary sm" disabled={pending}>
              {m.teamSaveRole}
            </button>
          </form>
        </section>
      )}

      {/* 3. Password Reset */}
      {!isSelf && (
        <details className="user-control-section security-control">
          <summary>
            <span>
              <KeyRound size={17} />
              {m.teamSecurityTitle}
            </span>
            <span>⌄</span>
          </summary>
          <form action={action}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="intent" value="password" />
            <p>{m.teamSecurityHint}</p>
            <div className="field">
              <label htmlFor="password">{m.teamNewPassword}</label>
              <input
                id="password"
                name="password"
                type="password"
                dir="ltr"
                minLength={12}
                maxLength={200}
                autoComplete="new-password"
                required
              />
            </div>
            <button className="button secondary sm" disabled={pending}>
              {m.teamResetPassword}
            </button>
          </form>
        </details>
      )}

      {/* 4. Disable / Enable Account */}
      {!isSelf && (
        <section className="user-control-section account-access-control">
          <div className="user-control-head">
            <div>
              <h3>{m.teamAccessActions}</h3>
              <p>{disabled ? m.teamEnableHint : m.teamDisableHint}</p>
            </div>
            <span className={`status ${disabled ? 'amber' : 'neutral'}`}>
              <span className="status-mark" />
              {disabled ? m.teamDisabled : m.teamActive}
            </span>
          </div>
          <form
            action={action}
            onSubmit={e => {
              if (disabled) return;
              if (!confirm(m.teamDisableConfirm)) e.preventDefault();
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="intent" value={disabled ? 'enable' : 'disable'} />
            <button className="button secondary sm" disabled={pending}>
              {disabled ? m.teamEnable : m.teamDisable}
            </button>
          </form>
        </section>
      )}

      {/* 5. Danger: Delete User */}
      {!isSelf && (
        <details className="user-control-section danger-control">
          <summary>
            <span>{m.teamDangerTitle}</span>
            <span>⌄</span>
          </summary>
          <p>{m.teamDangerHint}</p>
          <form
            action={action}
            onSubmit={e => {
              if (!confirm(m.teamDeleteConfirm)) e.preventDefault();
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="intent" value="delete" />
            <button className="button danger sm" disabled={pending}>
              {m.teamDelete}
            </button>
          </form>
        </details>
      )}

      <p className="user-controls-note">{m.teamHistoryNote}</p>
    </div>
  );
}
