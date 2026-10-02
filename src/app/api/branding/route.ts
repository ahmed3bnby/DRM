import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/auth';
import { getOrganizationBranding, saveOrganizationBranding } from '@/lib/branding';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await requireActor();
    const branding = await getOrganizationBranding(actor.organizationId);
    return NextResponse.json({ success: true, branding });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    if (actor.role !== 'admin') {
      return NextResponse.json({ error: 'FORBIDDEN: Admin permissions required' }, { status: 403 });
    }

    const body = await req.json();
    const updated = await saveOrganizationBranding(actor, body);
    return NextResponse.json({ success: true, branding: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update branding' }, { status: 500 });
  }
}
