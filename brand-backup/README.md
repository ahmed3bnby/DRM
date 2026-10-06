# Brand backup — ABC demo ↔ DRM

The platform is temporarily branded **ABC** (Royal Blue) for a client demo.
Everything needed to return to **DRM** is listed here.

## 1. Files moved out of the app (restore by moving back)
| Backup path | Restore to |
|---|---|
| `drm/app/icon.png` | `src/app/icon.png` — **and delete `src/app/icon.svg`** (the ABC tab icon) |
| `drm/public/drm-logo.png`, `logo1.png`, `logo.webp` | `public/` |
| `drm/public/drm-overview.html` | `public/` (DRM product overview page) |

`unused/abc-tv-network-logo-DO-NOT-USE.png` was found in `public/logo.png`. It is the
American TV network's trademark, not our design — never use it.

## 2. Colour (one place)
`src/app/design-system.css` → `:root` → swap the `--brand-50 … --brand-900` scale back to
the DRM green scale (DRM primary was `#007527`, hover `#005a1e`, light `#00872e`).
Everything else reads the tokens. Also `src/app/layout.tsx` → `themeColor`.

## 3. Text
- `src/lib/i18n.ts` — brand strings, advisor name (خالد المنصوري / Khalid Al Mansoori),
  login story footer (address / phone), `footerName`.
- `src/app/layout.tsx` — metadata title/description.
- `src/components/shell.tsx`, `src/app/login/page.tsx`, `src/app/error.tsx`,
  `src/app/not-found.tsx` — wordmark `ABC`, ticker, phone `+971 4 555 0123`.
- Report: `src/app/(workspace)/profiles/[id]/report/page.tsx` (fallback `'ABC'`, seal, footer).
- Page titles `| ABC` (grep `| ABC`), download filenames `ABC_*`, audit export `ABC COMPLIANCE`,
  `src/lib/bulk-screening.ts` sheet `ABC_Screening_Template`,
  `src/lib/notifications.ts` `[ABC Compliance Alert]`.

## 4. Database / seed
- `scripts/setup-db.ts` line ~50: seed org is `'ABC — Compliance & Advisory', 'ABC'`
  (comment shows the DRM original). **setup-db overwrites the org name on every run**, so
  change this together with the DB.
- Live DB: `organizations` id `10000000-0000-4000-8000-000000000001`
  name `ABC — Compliance & Advisory` (was `DRM — Diligence Risk Management`),
  reference `ABC` (was `DRM`).

Quick check after reverting: `grep -rn "ABC" src | grep -v node_modules`.
