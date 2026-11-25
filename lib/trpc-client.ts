import { createTRPCClient, httpBatchLink, httpLink, splitLink } from '@trpc/client';
import type { AppRouter } from '@/server/routers/_app';
import { TZ_HEADER, browserTimeZone } from '@/lib/time';

const url = '/api/trpc';
// The viewer's zone decides when a dated offer stops counting for them
const headers = () => ({ [TZ_HEADER]: browserTimeZone() });

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      // Keep the frequent, tiny health poll off the data batch so it never delays data
      // queries (and so it's its own request — independently cacheable and stubbable).
      condition: (op) => op.path.startsWith('health.'),
      true: httpLink({ url, headers }),
      false: httpBatchLink({ url, headers }),
    }),
  ],
});
