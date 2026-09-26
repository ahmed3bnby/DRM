import { requireActor } from '@/lib/auth';
import Shell from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({children}:{children:React.ReactNode}) {
  const actor = await requireActor();
  return <Shell actor={actor}>{children}</Shell>;
}
