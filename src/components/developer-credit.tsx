'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, ExternalLink, Lock } from 'lucide-react';

export const EXPECTED_NAME = 'Ahmed Abdelnaby';
export const EXPECTED_URL = 'https://linktr.ee/ahmedabdelnaby';

interface DeveloperCreditProps {
  as?: 'span' | 'footer' | 'div';
  className?: string;
  style?: React.CSSProperties;
  linkClassName?: string;
}

/**
 * Developer Credit Component with Active Tamper-Resistant Protection.
 * Renders official copyright signature matching intellectual property requirements.
 */
export function DeveloperCredit({
  as: Component = 'span',
  className = '',
  style,
  linkClassName = 'developer-link',
}: DeveloperCreditProps) {
  const Tag = Component;
  return (
    <Tag
      className={`drm-dev-signature-container ${className}`}
      dir="ltr"
      data-signature="ahmed-abdelnaby"
      style={style}
    >
      <bdi dir="ltr">
        Developed by{' '}
        <a
          href={EXPECTED_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          data-owner={EXPECTED_NAME}
        >
          {EXPECTED_NAME}
        </a>
      </bdi>
    </Tag>
  );
}

/**
 * Active Integrity Guard.
 * Monitors DOM mutations, style manipulation, and attribute tampering.
 * If developer copyright is deleted, modified, or hidden, immediately locks down the application.
 */
export function DeveloperIntegrityGuard() {
  const [tampered, setTampered] = useState(false);
  const guardRef = useRef(false);

  useEffect(() => {
    function verifyIntegrity(): boolean {
      if (typeof window === 'undefined') return true;

      const containers = document.querySelectorAll('[data-signature="ahmed-abdelnaby"]');
      if (containers.length === 0) {
        return false;
      }

      let validVisibleFound = false;

      for (const container of Array.from(containers)) {
        const link = container.querySelector<HTMLAnchorElement>(`a[data-owner="${EXPECTED_NAME}"]`);
        if (!link) continue;

        // Check URL
        const href = (link.getAttribute('href') || '').trim();
        if (href !== EXPECTED_URL && href !== `${EXPECTED_URL}/`) {
          continue;
        }

        // Check Link Text
        const linkText = (link.textContent || '').trim();
        if (!linkText.includes(EXPECTED_NAME)) {
          continue;
        }

        // Check Container Text
        const containerText = (container.textContent || '').trim();
        if (!containerText.includes('Developed by') || !containerText.includes(EXPECTED_NAME)) {
          continue;
        }

        // Check CSS Computed Styles (Anti-hiding)
        const cStyle = window.getComputedStyle(container);
        const lStyle = window.getComputedStyle(link);

        if (
          cStyle.display === 'none' ||
          lStyle.display === 'none' ||
          cStyle.visibility === 'hidden' ||
          lStyle.visibility === 'hidden' ||
          parseFloat(cStyle.opacity || '1') < 0.05 ||
          parseFloat(lStyle.opacity || '1') < 0.05 ||
          cStyle.fontSize === '0px' ||
          lStyle.fontSize === '0px'
        ) {
          continue;
        }

        // Check Geometry (Anti-offscreen positioning)
        const rect = container.getBoundingClientRect();
        if (rect.right < -100 || rect.bottom < -100 || (rect.left > window.innerWidth + 200 && window.innerWidth > 0)) {
          continue;
        }

        validVisibleFound = true;
        break;
      }

      return validVisibleFound;
    }

    let checkTimeout: ReturnType<typeof setTimeout> | null = null;

    function runCheck() {
      if (guardRef.current) return;

      const isValid = verifyIntegrity();
      if (!isValid) {
        // Confirmation window (300ms) to ensure it's not a transient React hydration or route navigation tick
        if (!checkTimeout) {
          checkTimeout = setTimeout(() => {
            checkTimeout = null;
            if (!verifyIntegrity()) {
              setTampered(true);
              guardRef.current = true;
            }
          }, 300);
        }
      } else {
        if (checkTimeout) {
          clearTimeout(checkTimeout);
          checkTimeout = null;
        }
      }
    }

    // Run initial check
    runCheck();

    // Observe DOM mutations, attribute manipulations, class/style overrides
    const observer = new MutationObserver(() => {
      runCheck();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'href', 'hidden', 'id'],
      characterData: true,
    });

    // Periodic heartbeat check every 1000ms
    const interval = setInterval(() => {
      runCheck();
    }, 1000);

    return () => {
      if (checkTimeout) clearTimeout(checkTimeout);
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  // Secondary surveillance: If locked down, prevent deletion of the lockdown overlay via DevTools
  useEffect(() => {
    if (!tampered) return;

    document.body.style.overflow = 'hidden';

    const antiBypassObserver = new MutationObserver(() => {
      const modal = document.getElementById('drm-integrity-lockdown-portal');
      if (!modal) {
        document.body.innerHTML = `
          <div style="position:fixed;inset:0;background:#091710;color:#f87171;padding:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;text-align:center;z-index:2147483647;" dir="rtl">
            <h1 style="font-size:26px;margin-bottom:16px;">تم قفل النظام نهائياً — انتهاك حقوق الملكية الفكرية</h1>
            <p style="color:#d1d5db;max-width:500px;font-size:15px;line-height:1.7;">
              تم رصد محاولة إزالة شاشة الحماية البرمجية. التطبيق معطل تماماً.
            </p>
            <div style="margin-top:24px;padding:12px 20px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:14px;color:#a7f3d0;" dir="ltr">
              Developed by <strong style="color:#34d399;">${EXPECTED_NAME}</strong>
            </div>
          </div>
        `;
      }
    });

    antiBypassObserver.observe(document.body, { childList: true, subtree: true });

    return () => antiBypassObserver.disconnect();
  }, [tampered]);

  if (!tampered) return null;

  return (
    <div
      id="drm-integrity-lockdown-portal"
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: 'rgba(9, 23, 16, 0.98)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        pointerEvents: 'all',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#0f291e',
          border: '2px solid #ef4444',
          borderRadius: '16px',
          padding: '36px 30px',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <ShieldAlert size={36} />
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#f87171',
            margin: '0 0 12px',
            lineHeight: 1.4,
          }}
        >
          تم قفل النظام — انتهاك حقوق الملكية الفكرية
        </h1>

        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.8,
            color: '#d1d5db',
            margin: '0 0 24px',
          }}
        >
          تم رصد محاولة لتعديل أو إزالة أو إخفاء حقوق المطور البرمجية
          <strong style={{ color: '#ffffff' }}> ({EXPECTED_NAME})</strong>.
          <br />
          تم إيقاف تشغيل التطبيق بالكامل لحماية حقوق الملكية. لإعادة تفعيل النظام، يجب استعادة
          حقوق المطور الأصلية دون أي تعديل.
        </p>

        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            marginBottom: '24px',
            fontSize: '13px',
            direction: 'ltr',
            color: '#a7f3d0',
          }}
        >
          Developed by{' '}
          <a
            href={EXPECTED_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#34d399',
              fontWeight: 600,
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {EXPECTED_NAME}
            <ExternalLink size={12} />
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '11px', color: '#9ca3af' }}>
          <Lock size={13} />
          <span>DRM Platform — Copyright & License Protection Active</span>
        </div>
      </div>
    </div>
  );
}
