import type {Actor} from './auth';
// The platform owner(s) — the super admin(s) running the whole service. Configured
// out-of-band via PLATFORM_ADMIN_USER_IDS so no tenant admin can grant it.
export function platformOwnerIds(): string[] {
 return (process.env.PLATFORM_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean);
}
export function isPlatformOwner(actor: Partial<Pick<Actor, 'id' | 'role'>>) {
 return actor.role === 'admin' && !!actor.id && platformOwnerIds().includes(actor.id);
}
