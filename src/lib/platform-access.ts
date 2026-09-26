import type { Actor } from './auth';

// Super admin accounts that have root platform-owner privileges across all tenants
export const SUPER_ADMIN_EMAILS = ['ahmed3bnbyy@gmail.com'];

export function platformOwnerIds(): string[] {
  return (process.env.PLATFORM_ADMIN_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
}

export function platformOwnerEmails(): string[] {
  const envEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...SUPER_ADMIN_EMAILS, ...envEmails]));
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return platformOwnerEmails().includes(email.toLowerCase().trim());
}

export function isSuperAdminId(id?: string | null): boolean {
  if (!id) return false;
  return platformOwnerIds().includes(id.trim());
}

export function isPlatformOwner(actor?: Partial<Pick<Actor, 'id' | 'role' | 'email'>> | null): boolean {
  if (!actor || actor.role !== 'admin') return false;
  if (actor.email && isSuperAdminEmail(actor.email)) {
    return true;
  }
  if (actor.id && isSuperAdminId(actor.id)) {
    return true;
  }
  return false;
}
