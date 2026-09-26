'use client';

import { useActionState, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { loginAction, type LoginState } from '@/app/actions';
import { useLocale } from './locale-context';

export default function LoginForm() {
  const { m, locale } = useLocale();
  const [state, action, pending] = useActionState(loginAction, {} as LoginState);
  const [showPassword, setShowPassword] = useState(false);
  const isAr = locale === 'ar';

  return (
    <form action={action} className="login-form">
      <div className="field login-field">
        <label htmlFor="email">{m.emailLabel}</label>
        <div className="login-input">
          <Mail size={17} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            spellCheck={false}
            dir="ltr"
            placeholder={isAr ? 'name@company.ae' : 'name@company.com'}
          />
        </div>
      </div>

      <div className="field login-field">
        <label htmlFor="password">{m.passwordLabel}</label>
        <div className="login-input login-password-input">
          <LockKeyhole size={17} aria-hidden="true" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            dir="ltr"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            className="password-visibility"
            onClick={() => setShowPassword(value => !value)}
            aria-label={showPassword ? m.hidePassword : m.showPassword}
            aria-pressed={showPassword}
            title={showPassword ? m.hidePassword : m.showPassword}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      <label className="remember-control">
        <input type="checkbox" name="remember" />
        <span className="remember-box" aria-hidden="true" />
        <span>{m.rememberMe}</span>
      </label>

      {state.error && (
        <p className="form-error" role="alert" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.45' }}>
          {state.error}
        </p>
      )}

      <button disabled={pending} className="button primary login-submit">
        {pending && <LoaderCircle className="spin" size={18} />}
        <span>{pending ? m.loginPending : m.loginSubmit}</span>
        {isAr ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
      </button>
    </form>
  );
}
