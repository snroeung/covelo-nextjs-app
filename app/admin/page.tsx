import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OffersAdminShell } from '@/components/offers/admin/OffersAdminShell';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?next=/admin');
  }

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== 'admin') {
    redirect('/offers');
  }

  return <OffersAdminShell />;
}
