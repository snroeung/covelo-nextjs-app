import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isEnabled } from '@/lib/feature-flags';
import type { FlagName } from '@/lib/feature-flags';
import { PROXY_AUTH_HEADER, timingExposed } from '@/lib/timing';

// Routes that require a feature flag to be enabled.
// Patterns are prefix-matched (pathname.startsWith).
// Auth routes are intentionally excluded — auth is always on.
const ROUTE_FLAGS: Array<{ prefix: string; flag: FlagName }> = [
  { prefix: '/hotels',       flag: 'ui:hotels' },
  { prefix: '/flights',      flag: 'ui:flights' },
  { prefix: '/search',       flag: 'ui:search' },
  { prefix: '/trip-planner', flag: 'ui:trip-planner' },
  { prefix: '/discover/board', flag: 'ui:board' },
  { prefix: '/discover',    flag: 'ui:discover' },
  { prefix: '/offers',      flag: 'ui:discover' },
  { prefix: '/settings',    flag: 'ui:settings' },
  { prefix: '/you',         flag: 'ui:you' },
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
  const refreshedCookies: Array<{ name: string; value: string; options?: CookieOptions }> = [];

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
          refreshedCookies.push(...cookiesToSet);
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session so it doesn't expire mid-session
  const authStart = performance.now();
  await supabase.auth.getUser();
  const authMs = Math.round(performance.now() - authStart);

  // Proxy runs outside the tRPC request, so the route's own Server-Timing can't see this call.
  // A response header here would replace the route's, so API calls get the number forwarded as a
  // request header (the route folds it into its single header); pages get it directly.
  if (pathname.startsWith('/api/trpc')) {
    const forwarded = new Headers(request.headers);
    forwarded.set(PROXY_AUTH_HEADER, String(authMs));
    supabaseResponse = NextResponse.next({ request: { headers: forwarded } });
    refreshedCookies.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
  } else if (timingExposed(request.headers)) {
    supabaseResponse.headers.set('Server-Timing', `proxy-auth;dur=${authMs}`);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
