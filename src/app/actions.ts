'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSession, destroySession, requireActor } from '@/lib/auth';
import { createCustomer, updateCustomer, deleteCustomer } from '@/lib/customers';
import { runAndSaveScreening } from '@/lib/screening';
import { recordMatchDecision } from '@/lib/decisions';
import { assignReviewCase } from '@/lib/review-cases';
import { getSourceRecord } from '@/lib/search';
import { createTeamUser, setUserQuota, consumeSearch, quotaStatus, setUserRole, setUserDisabled, resetUserPassword, updateUserProfile, deleteTeamUser, clearUserSearches, deleteUserSearchEvent, clearMySearchHistory, removeSearchHistoryItem } from '@/lib/team';
import { extractRecordCountry, extractRecordDob, extractRecordIdentifier } from '@/lib/record-details';
import { customerSchema, teamUserSchema, canManageCustomers, uuidSchema } from '@/lib/validation';
import { isPlatformOwner } from '@/lib/platform-access';
import { getSystemLockdown, setSystemLockdown } from '@/lib/platform';

export type LoginState = {error?: string};
export async function loginAction(_previous: LoginState, data: FormData): Promise<LoginState> {
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  const remember = data.get('remember') === 'on';
  const { getLocale } = await import('@/lib/i18n');
  const locale = await getLocale().catch(() => 'ar');
  const isAr = locale === 'ar';

  if (!email || !password) {
    return {
      error: isAr
        ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور.'
        : 'Please enter your email and password.',
    };
  }

  const sessionRes = await createSession(email, password, remember);
  if (!sessionRes.success) {
    if (sessionRes.reason === 'maintenance') {
      const lockdown = await getSystemLockdown();
      const customMsg = isAr
        ? (lockdown.message_ar?.trim() || lockdown.message_en?.trim())
        : (lockdown.message_en?.trim() || lockdown.message_ar?.trim());
      const baseMsg = isAr
        ? '⚠️ النظام في وضع الصيانة والتحديث حالياً. يرجى المحاولة لاحقاً بعد اكتمال أعمال التحديث.'
        : '⚠️ System is currently under maintenance. Please try again later.';
      return {
        error: customMsg ? `${baseMsg}\n\n📢 ${isAr ? 'بيان الإدارة:' : 'Management Note:'} "${customMsg}"` : baseMsg,
      };
    }

    if (sessionRes.reason === 'rate_limited') {
      const mins = sessionRes.retryAfterMinutes ?? 15;
      const maxAtt = sessionRes.maxAttempts ?? 5;
      return {
        error: isAr
          ? `تم حظر محاولات الدخول مؤقتاً لتكرار المحاولات الخاطئة (${maxAtt} محاولات).\nيرجى الانتظار ${mins} دقيقة قبل المحاولة مجدداً.`
          : `Too many failed login attempts (${maxAtt} attempts).\nAccount access is temporarily locked. Please wait ${mins} minute(s) before trying again.`,
      };
    }

    const rem = sessionRes.remainingAttempts;
    if (rem !== undefined && rem > 0 && rem < (sessionRes.maxAttempts ?? 5)) {
      const attemptsWord = rem === 1 ? 'محاولة واحدة' : rem === 2 ? 'محاولتان' : `${rem} محاولات`;
      return {
        error: isAr
          ? `بيانات الدخول غير صحيحة. متبقي لك ${attemptsWord} قبل حظر الدخول مؤقتاً.`
          : `Invalid credentials. You have ${rem} attempt${rem === 1 ? '' : 's'} remaining before temporary lockout.`,
      };
    }

    return {
      error: isAr
        ? 'تعذر تسجيل الدخول. يرجى التحقق من صحة البريد الإلكتروني وكلمة المرور.'
        : 'Invalid email or password. Please verify your credentials.',
    };
  }

  redirect('/');
}
export async function logoutAction() { await destroySession(); redirect('/login'); }

export async function toggleSystemLockdownAction(data: FormData) {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) {
    throw new Error('FORBIDDEN');
  }
  const enabled = data.get('enabled') === 'true';
  const messageAr = String(data.get('messageAr') ?? '');
  const messageEn = String(data.get('messageEn') ?? '');
  await setSystemLockdown(actor, enabled, messageAr, messageEn);
  revalidatePath('/platform');
  revalidatePath('/');
  revalidatePath('/login');
  redirect('/platform?lockdown_saved=1');
}

export async function quickReenableSystemAction() {
  const actor = await requireActor();
  if (!isPlatformOwner(actor)) {
    throw new Error('FORBIDDEN');
  }
  await setSystemLockdown(actor, false);
  revalidatePath('/platform');
  revalidatePath('/');
  revalidatePath('/login');
}

export type FormState = {error?: string; fields?: Record<string, string[] | undefined>; values?: Record<string,string>};
export async function createCustomerAction(_previous: FormState, data: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (!canManageCustomers(actor.role)) return {error: 'صلاحيتك تسمح بالاطلاع فقط.'};
  const values = Object.fromEntries(['name','entityType','country','nationality','deliveryChannel','email','industry','dateOfBirth','identifier','notes'].map(key=>[key,String(data.get(key) ?? '')]));
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return {error: 'راجع الحقول الموضحة أدناه.', fields: parsed.error.flatten().fieldErrors, values};

  const quotaCheck = await quotaStatus(actor);
  if (!quotaCheck.allowed) {
    return { error: 'رصيد عمليات الفحص المتاح لك غير كافٍ لإنشاء وفحص عميل جديد. يرجى التواصل مع مسؤول النظام لزيادة الحصة.', values };
  }

  let customerId: string;
  let reference: string;
  try {
    const res = await createCustomer(actor, parsed.data);
    customerId = res.id;
    reference = res.reference;
  }
  catch { return {error: 'تعذر حفظ الملف. لم يُسجل إنشاء مكتمل؛ أعد المحاولة.', values}; }

  try {
    await consumeSearch(actor, `screen:${customerId}`, parsed.data.name);
    await runAndSaveScreening(actor, customerId);
  } catch (err) {
    console.error('Failed to run initial screening after creating customer:', err);
  }

  revalidatePath('/'); revalidatePath('/profiles');
  redirect(`/profiles/${reference}?created=1&screened=1`);
}

export async function editCustomerAction(_previous: FormState, data: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (!canManageCustomers(actor.role)) return {error: 'صلاحيتك تسمح بالاطلاع فقط.'};
  const id = String(data.get('id') ?? '');
  if (!uuidSchema.safeParse(id).success) return {error: 'ملف غير صالح.'};
  const values = Object.fromEntries(['name','entityType','country','nationality','deliveryChannel','email','industry','dateOfBirth','identifier','notes'].map(key=>[key,String(data.get(key) ?? '')]));
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return {error: 'راجع الحقول الموضحة أدناه.', fields: parsed.error.flatten().fieldErrors, values};
  let reference: string;
  try { reference = await updateCustomer(actor, id, parsed.data); }
  catch (err: unknown) {
    if (err instanceof Error && err.message === 'FORBIDDEN_NOT_CREATOR') {
      return {error: 'لا تملك صلاحية تعديل هذا الملف. التعديل متاح فقط لمنشئ الملف أو مدير النظام.', values};
    }
    return {error: 'تعذر حفظ التعديلات؛ أعد المحاولة.', values};
  }
  revalidatePath('/profiles/[id]', 'page'); revalidatePath('/profiles'); revalidatePath('/');
  redirect(`/profiles/${reference}?updated=1`);
}

export async function screenCustomerAction(data: FormData) {
  const actor = await requireActor();
  const id = String(data.get('customerId') ?? '');
  const reference = String(data.get('reference') ?? '');
  if (!uuidSchema.safeParse(id).success || !canManageCustomers(actor.role)) {
    if (reference) redirect(`/profiles/${reference}?screen=error`);
    return;
  }
  const quota = await consumeSearch(actor, `screen:${id}`);
  if (!quota.allowed) {
    revalidatePath('/profiles/[id]', 'page');
    if (reference) redirect(`/profiles/${reference}?screen=quota`);
    return;
  }
  try { await runAndSaveScreening(actor, id); }
  catch {
    revalidatePath('/profiles/[id]', 'page');
    if (reference) redirect(`/profiles/${reference}?screen=error`);
    return;
  }
  revalidatePath('/profiles/[id]', 'page');
  revalidatePath('/profiles/[id]/report', 'page');
  revalidatePath('/profiles');
  revalidatePath('/reviews');
  revalidatePath('/');
  if (reference) redirect(`/profiles/${reference}?screen=success`);
}

export async function createUserAction(_previous: FormState, data: FormData): Promise<FormState> {
  const actor = await requireActor();
  if (actor.role !== 'admin') return {error: 'هذا الإجراء خاص بالمدير.'};
  const values = Object.fromEntries(['email','displayName','role','quota','password'].map(key=>[key,String(data.get(key) ?? '')]));
  const parsed = teamUserSchema.safeParse(values);
  if (!parsed.success) return {error: 'راجع الحقول الموضحة أدناه.', fields: parsed.error.flatten().fieldErrors, values};
  try { await createTeamUser(actor, parsed.data); }
  catch (e) { const msg = String((e as Error).message ?? ''); return {error: /MEMBER_LIMIT/.test(msg) ? 'وصلت للحد الأقصى لعدد المستخدمين في باقتك. تواصل مع مزوّد الخدمة لرفع الحد.' : /duplicate|unique|EMAIL_TAKEN/i.test(msg) ? 'هذا البريد مستخدم بالفعل أو غير متاح.' : 'تعذر إنشاء المستخدم؛ أعد المحاولة.', values}; }
  revalidatePath('/team');
  return {};
}

export type QuotaState = { ok?: boolean; error?: string };
export async function updateQuotaAction(_previous: QuotaState, data: FormData): Promise<QuotaState> {
  const actor = await requireActor();
  if (actor.role !== 'admin') return {error: 'هذا الإجراء خاص بالمدير.'};
  const userId = String(data.get('userId') ?? '');
  if (!uuidSchema.safeParse(userId).success) return {error: 'مستخدم غير صالح.'};
  try { await setUserQuota(actor, userId, Number(data.get('quota') ?? 0)); }
  catch { return {error: 'تعذر تحديث الحصة؛ أعد المحاولة.'}; }
  revalidatePath('/team');
  return {ok: true};
}

export type UserControlState = { ok?: 'role' | 'password' | 'disabled' | 'enabled' | 'searches_cleared' | 'profile'; error?: string };
const controlError = (error: unknown) => {
  const code = error instanceof Error ? error.message : '';
  if (code === 'SELF') return 'SELF';
  if (code === 'LAST_ADMIN') return 'LAST_ADMIN';
  if (code === 'HAS_HISTORY') return 'HAS_HISTORY';
  if (code === 'EMAIL_TAKEN') return 'EMAIL_TAKEN';
  if (code === 'INVALID_NAME') return 'NAME_SHORT';
  if (code === 'INVALID_EMAIL') return 'INVALID_EMAIL';
  return 'GENERIC';
};
export async function manageUserAction(_previous: UserControlState, data: FormData): Promise<UserControlState> {
  const actor = await requireActor();
  if (actor.role !== 'admin') return {error: 'GENERIC'};
  const userId = String(data.get('userId') ?? '');
  const intent = String(data.get('intent') ?? '');
  if (!uuidSchema.safeParse(userId).success) return {error: 'GENERIC'};
  const fail = (error: unknown) => ({error: controlError(error)}) as UserControlState;
  if (intent === 'delete') {
    try { await deleteTeamUser(actor, userId); }
    catch (error) { return fail(error); }
    revalidatePath('/team');
    redirect('/team?removed=1');
  }
  try {
    if (intent === 'profile') {
      const displayName = String(data.get('displayName') ?? '').trim();
      const email = String(data.get('email') ?? '').trim().toLowerCase();
      if (displayName.length < 2) return { error: 'NAME_SHORT' };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'INVALID_EMAIL' };
      await updateUserProfile(actor, userId, { displayName, email });
    } else if (intent === 'role') {
      const role = String(data.get('role') ?? '');
      if (role !== 'admin' && role !== 'analyst' && role !== 'viewer') return {error: 'GENERIC'};
      await setUserRole(actor, userId, role, Number(data.get('quota') ?? 0));
    } else if (intent === 'password') {
      const password = String(data.get('password') ?? '');
      if (password.length < 12 || password.length > 200) return {error: 'PASSWORD'};
      await resetUserPassword(actor, userId, password);
    } else if (intent === 'disable' || intent === 'enable') {
      await setUserDisabled(actor, userId, intent === 'disable');
    } else if (intent === 'clear_searches') {
      await clearUserSearches(actor, userId);
    } else return {error: 'GENERIC'};
  } catch (error) { return fail(error); }
  revalidatePath('/team');
  revalidatePath('/team/[id]', 'page');
  return {ok: intent === 'enable' ? 'enabled' : intent === 'disable' ? 'disabled' : intent === 'password' ? 'password' : intent === 'clear_searches' ? 'searches_cleared' : intent === 'profile' ? 'profile' : 'role'};
}

export async function deleteCustomerAction(data: FormData) {
  const actor = await requireActor();
  if (actor.role !== 'admin') {
    redirect('/profiles?delete=forbidden');
  }
  const customerId = String(data.get('customerId') ?? '');
  if (!uuidSchema.safeParse(customerId).success) {
    redirect('/profiles?delete=error');
  }
  try {
    await deleteCustomer(actor, customerId);
  } catch {
    redirect('/profiles?delete=error');
  }
  revalidatePath('/profiles');
  revalidatePath('/profiles/[id]', 'page');
  revalidatePath('/reviews');
  revalidatePath('/');
  redirect('/profiles?deleted=1');
}

export type DecisionActionState = {
  ok?: boolean;
  error?: string;
  decision?: string;
  recordId?: string;
};

export async function saveMatchDecisionAction(
  _previous: DecisionActionState,
  data: FormData
): Promise<DecisionActionState> {
  const actor = await requireActor();
  const customerId = String(data.get('customerId') ?? '');
  const recordId = String(data.get('recordId') ?? '');
  const decision = String(data.get('decision') ?? '');
  const reason = String(data.get('reason') ?? '');
  if (!uuidSchema.safeParse(customerId).success || !recordId || !canManageCustomers(actor.role)) {
    return { ok: false, error: 'INVALID_INPUT', recordId };
  }
  if (!['confirmed', 'dismissed', 'needs_info'].includes(decision)) {
    return { ok: false, error: 'BAD_DECISION', recordId };
  }
  if (!reason.trim()) {
    return { ok: false, error: 'REASON_REQUIRED', recordId };
  }
  try {
    await recordMatchDecision(actor, customerId, recordId, decision, reason);
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'SAVE_FAILED', recordId };
  }
  revalidatePath('/profiles/[id]', 'page');
  revalidatePath('/profiles/[id]/report', 'page');
  revalidatePath('/reviews');
  revalidatePath('/profiles');
  revalidatePath('/');
  return { ok: true, decision, recordId };
}

export async function decideMatchAction(data: FormData) {
  const actor = await requireActor();
  const customerId = String(data.get('customerId') ?? '');
  const recordId = String(data.get('recordId') ?? '');
  const reference = String(data.get('reference') ?? '');
  if (!uuidSchema.safeParse(customerId).success || !recordId || !canManageCustomers(actor.role) || !/^[\w-]{4,60}$/.test(reference)) {
    if (reference) redirect(`/profiles/${reference}?decision=error`);
    return;
  }
  try { await recordMatchDecision(actor, customerId, recordId, String(data.get('decision') ?? ''), String(data.get('reason') ?? '')); }
  catch {
    redirect(`/profiles/${reference}?decision=error`);
  }
  revalidatePath('/profiles/[id]', 'page');
  revalidatePath('/profiles/[id]/report', 'page');
  revalidatePath('/reviews');
  revalidatePath('/profiles');
  revalidatePath('/');
  redirect(`/profiles/${reference}?decision=saved`);
}

export async function assignReviewCaseAction(data: FormData) {
  const actor = await requireActor();
  const caseId = String(data.get('caseId') ?? '');
  const intent = String(data.get('intent') ?? '');
  const assigneeId = String(data.get('assigneeId') ?? '') || null;
  const returnTo = String(data.get('returnTo') ?? '/reviews');
  const safeReturnTo = /^\/reviews(?:\?[^#]*)?$/.test(returnTo) ? returnTo : '/reviews';
  const outcomeUrl = (outcome: 'saved' | 'error') => `${safeReturnTo}${safeReturnTo.includes('?') ? '&' : '?'}assignment=${outcome}`;
  if (!uuidSchema.safeParse(caseId).success || (intent !== 'claim' && intent !== 'assign')) {
    redirect(outcomeUrl('error'));
  }
  try { await assignReviewCase(actor, caseId, assigneeId, intent === 'claim'); }
  catch { redirect(outcomeUrl('error')); }
  revalidatePath('/reviews');
  redirect(outcomeUrl('saved'));
}

export async function clearMySearchHistoryAction(data?: FormData) {
  const actor = await requireActor();
  await clearMySearchHistory(actor);
  revalidatePath('/search');
  revalidatePath('/search/history');
  const returnTo = data ? String(data.get('returnTo') ?? '') : '';
  if (returnTo === 'history') {
    redirect('/search/history');
  }
  redirect('/search');
}

export async function removeSearchHistoryItemAction(data: FormData) {
  const actor = await requireActor();
  const query = String(data.get('query') ?? '');
  if (query) {
    await removeSearchHistoryItem(actor, query);
  }
  revalidatePath('/search');
  revalidatePath('/search/history');
}

export async function clearUserSearchesAction(data: FormData) {
  const actor = await requireActor();
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  const userId = String(data.get('userId') ?? '');
  const username = String(data.get('username') ?? '');
  if (!uuidSchema.safeParse(userId).success) return;
  await clearUserSearches(actor, userId);
  revalidatePath('/team');
  revalidatePath('/team/[id]', 'page');
  if (username) redirect(`/team/${encodeURIComponent(username)}?cleared=1`);
}

export async function deleteUserSearchEventAction(data: FormData) {
  const actor = await requireActor();
  if (actor.role !== 'admin') throw new Error('FORBIDDEN');
  const userId = String(data.get('userId') ?? '');
  const eventId = String(data.get('eventId') ?? '');
  const username = String(data.get('username') ?? '');
  if (!uuidSchema.safeParse(userId).success || !uuidSchema.safeParse(eventId).success) return;
  await deleteUserSearchEvent(actor, userId, eventId);
  revalidatePath('/team');
  revalidatePath('/team/[id]', 'page');
  if (username) redirect(`/team/${encodeURIComponent(username)}?deleted=1`);
}


export async function createCustomerFromSourceRecordAction(data: FormData) {
  const actor = await requireActor();
  if (!canManageCustomers(actor.role)) {
    redirect('/search?error=forbidden');
  }
  const recordId = String(data.get('recordId') ?? '');
  if (!uuidSchema.safeParse(recordId).success) {
    redirect('/search?error=invalid_record');
  }
  const r = await getSourceRecord(recordId);
  if (!r) {
    redirect('/search?error=record_not_found');
  }

  const schemaType = String(r.details?.schema || (r.details?._provenance as Record<string, unknown> | undefined)?.schema || '');
  const isCompany = /company|organization|legalentity/i.test(schemaType);
  const country = extractRecordCountry(r.details) || 'AE';
  const dateOfBirth = extractRecordDob(r.details) || null;
  const identifier = extractRecordIdentifier(r.details, r.source_record_id) || null;
  const quotaCheck = await quotaStatus(actor);
  if (!quotaCheck.allowed) {
    redirect(`/search/${r.code}/${encodeURIComponent(r.source_record_id)}?error=quota`);
  }

  const notes = `تم إنشاء هذا الملف تلقائياً من سجل المصادر (${r.code} - ${r.source_record_id})`;
  const { id: customerId, reference } = await createCustomer(actor, {
    name: r.name,
    entityType: isCompany ? 'company' : 'individual',
    country,
    dateOfBirth: dateOfBirth || '',
    identifier: identifier || '',
    nationality: isCompany ? '' : (country || ''),
    deliveryChannel: 'online',
    notes,
  });

  try {
    await consumeSearch(actor, `screen:${customerId}`, r.name);
    await runAndSaveScreening(actor, customerId);
  } catch (err) {
    console.error('Failed to run initial screening after creating customer from record:', err);
  }

  revalidatePath('/');
  revalidatePath('/profiles');
  redirect(`/profiles/${reference}?created=1&from_record=1`);
}

// ── Platform owner (super admin): toggle premium features per organization ──
export async function updateOrgPlanAction(data: FormData) {
  const actor = await requireActor();
  const { isPlatformOwner } = await import('@/lib/platform-access');
  if (!isPlatformOwner(actor)) throw new Error('FORBIDDEN');
  const { updateOrgPlan } = await import('@/lib/platform');
  const { PREMIUM_FEATURES } = await import('@/lib/features');
  const orgId = String(data.get('orgId') || '');
  if (!/^[0-9a-fA-F-]{36}$/.test(orgId)) throw new Error('BAD_ORG');
  const features: Record<string, boolean> = {};
  for (const key of PREMIUM_FEATURES) features[key] = data.get(`f_${key}`) === 'on';
  await updateOrgPlan(orgId, {
    features,
    member_limit: Number(data.get('member_limit')) || 5,
    plan: String(data.get('plan') || 'base'),
  });
  revalidatePath('/platform');
  revalidatePath('/sources');
  revalidatePath('/search');
  revalidatePath('/search/bulk');
  revalidatePath('/profiles');
  revalidatePath('/');
  redirect('/platform?saved=1');
}

export async function superAdminCreditQuotaAction(data: FormData) {
  const actor = await requireActor();
  const { isPlatformOwner } = await import('@/lib/platform-access');
  if (!isPlatformOwner(actor)) throw new Error('FORBIDDEN');

  const { superAdminCreditUserQuota } = await import('@/lib/platform');
  const userId = String(data.get('userId') || '');
  if (!/^[0-9a-fA-F-]{36}$/.test(userId)) throw new Error('BAD_USER');

  const mode = String(data.get('mode') || 'add') as 'add' | 'set' | 'unlimited';
  const amountStr = data.get('amount');
  const amount = amountStr ? Number(amountStr) : undefined;
  const resetAnchor = data.get('resetAnchor') === 'true' || data.get('resetAnchor') === 'on';
  const note = String(data.get('note') || '').trim();

  await superAdminCreditUserQuota(actor, userId, {
    mode,
    amount,
    resetAnchor,
    note: note || undefined,
  });

  revalidatePath('/platform');
  redirect('/platform?quota_updated=1');
}

export async function toggleCustomerMonitoringAction(formData: FormData) {
  const actor = await requireActor();
  const customerId = String(formData.get('customerId') || '');
  const enabled = formData.get('enabled') === 'true';
  const handle = String(formData.get('handle') || '');

  const { toggleCustomerMonitoring } = await import('@/lib/ongoing-monitoring');
  await toggleCustomerMonitoring(actor.organizationId, customerId, enabled);

  if (handle) revalidatePath(`/profiles/${handle}`);
  revalidatePath('/profiles');
  revalidatePath('/reviews');
}

export async function triggerMonitoringCycleAction() {
  const actor = await requireActor();
  const { executeMonitoringCycle } = await import('@/lib/ongoing-monitoring');
  const res = await executeMonitoringCycle(actor);

  revalidatePath('/reviews');
  revalidatePath('/profiles');
  return res;
}

