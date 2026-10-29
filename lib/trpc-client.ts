import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { TZ_HEADER, browserTimeZone } from '@/lib/time';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      // The viewer's zone decides when a dated offer stops counting for them
      headers: () => ({ [TZ_HEADER]: browserTimeZone() }),
    }),
  ],
});
