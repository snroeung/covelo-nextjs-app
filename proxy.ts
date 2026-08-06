import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEnabled } from '@/lib/feature-flags';
import type { FlagName } from '@/lib/feature-flags';

// Routes that require a feature flag to be enabled.
// Patterns are prefix-matched (pathname.startsWith).
// Auth routes are intentionally excluded — auth is always on.
const ROUTE_FLAGS: Array<{ prefix: string; flag: FlagName }> = [
  { prefix: '/hotels',       flag: 'ui:hotels' },
  { prefix: '/flights',      flag: 'ui:flights' },
  { prefix: '/search',       flag: 'ui:search' },
  { prefix: '/trip-planner', flag: 'ui:trip-planner' },
  { prefix: '/offers',       flag: 'ui:offers' },
  { prefix: '/settings',    flag: 'ui:settings' },
  { prefix: '/admin',       flag: 'ui:admin' },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Feature flag gate — redirect disabled routes to home before auth processing
  for (const { prefix, flag } of ROUTE_FLAGS) {
    if (pathname.startsWith(prefix) && !isEnabled(flag)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session so it doesn't expire mid-session
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
