import { initTRPC } from "@trpc/server";

const t = initTRPC.create({
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
