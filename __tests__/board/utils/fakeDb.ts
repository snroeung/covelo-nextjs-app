// A table-aware stand-in for the Supabase service-role client. Every query is
// recorded; each table's handler decides what that query returns, so a test
// states "what is in the database" instead of the order queries run in.

export type Action = 'select' | 'insert' | 'update' | 'delete' | 'upsert';
type Args = unknown[];

export interface Query {
  table: string;
  action: Action;
  calls: Array<[string, Args]>;
  payload?: unknown;
  single: boolean;
  head: boolean;
}

export interface Result {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export type Handler = (q: Query) => Result | undefined;

export const arg = (q: Query, method: string, i = 0): unknown => q.calls.find((c) => c[0] === method)?.[1][i];
export const called = (q: Query, method: string, ...args: Args): boolean =>
  q.calls.some((c) => c[0] === method && args.every((a, i) => JSON.stringify(c[1][i]) === JSON.stringify(a)));
export const eqValue = (q: Query, column: string): unknown =>
  q.calls.find((c) => c[0] === 'eq' && c[1][0] === column)?.[1][1];

export function makeDb(handlers: Record<string, Handler> = {}, rpcs: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  const log: Query[] = [];
  const rpcLog: Array<{ name: string; args: Record<string, unknown> }> = [];

  const resolve = (q: Query) => {
    let r: Result = handlers[q.table]?.(q) ?? { data: q.single ? null : [] };
    if (q.single && Array.isArray(r.data)) r = { ...r, data: r.data[0] ?? null };
    return { data: null, error: null, count: null, ...r };
  };

  const from = (table: string) => {
    const q: Query = { table, action: 'select', calls: [], single: false, head: false };
    log.push(q);
    const builder: unknown = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === 'then') return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(resolve(q)).then(ok, bad);
        return (...args: Args) => {
          if (prop === 'insert' || prop === 'update' || prop === 'delete' || prop === 'upsert') {
            q.action = prop;
            q.payload = args[0];
          } else if (prop === 'select') {
            if ((args[1] as { head?: boolean } | undefined)?.head) q.head = true;
          } else if (prop === 'single' || prop === 'maybeSingle') {
            q.single = true;
          }
          q.calls.push([prop, args]);
          return builder;
        };
      },
    });
    return builder;
  };

  // An rpc handler returns its rows, or `{ error: { code, message } }` to fail
  const rpc = (name: string, args: Record<string, unknown> = {}) => {
    rpcLog.push({ name, args });
    const out = rpcs[name]?.(args);
    const failed = out && typeof out === 'object' && !Array.isArray(out) && 'error' in out;
    const result = failed ? { data: null, error: (out as { error: unknown }).error } : { data: out ?? null, error: null };
    return { then: (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok) };
  };

  return {
    client: { from, rpc },
    log,
    rpcLog,
    /** Queries against a table, optionally one action */
    of: (table: string, action?: Action) => log.filter((q) => q.table === table && (!action || q.action === action)),
  };
}
