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

export function isPlatformOwner(actor?: Partial<Pick<Actor, 'id' | 'role' | 'email'>> | null): boolean {
  if (!actor || actor.role !== 'admin') return false;
  if (actor.email && platformOwnerEmails().includes(actor.email.toLowerCase().trim())) {
    return true;
  }
  if (actor.id && platformOwnerIds().includes(actor.id)) {
    return true;
  }
  return false;
}
