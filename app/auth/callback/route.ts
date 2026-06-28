import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Explicit next (e.g. password reset) takes priority over onboarding check
      if (next) return NextResponse.redirect(`${origin}${next}`);

      const userId = data.session?.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();
        if (!profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding?verified=1`);
        }
      }
      return NextResponse.redirect(`${origin}/flights`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=could_not_confirm`);
}
