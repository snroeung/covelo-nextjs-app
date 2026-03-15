import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
    onError({ error, path }) {
      console.error({
        time: new Date().toISOString(),
        path,
        status: error.code,
        message: error.message,
      });
    },
  });

export { handler as GET, handler as POST };
