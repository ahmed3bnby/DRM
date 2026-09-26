import type {Actor} from './auth';
export function isPlatformOwner(actor:Pick<Actor,'id'|'role'>){
 return actor.role==='admin'&&(process.env.PLATFORM_ADMIN_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean).includes(actor.id);
}
