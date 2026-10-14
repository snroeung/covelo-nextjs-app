import { router } from "@/server/trpc";

// The Board — member tips + offer posts, moderation, topics.
// Procedures land in Phase 3 (member) and Phase 4 (admin). Reads use
// flaggedProcedure("api:board"), writes authedProcedure("api:board"),
// moderation adminProcedure("api:board").
//
// Caching: only the shared topic list (cacheKeys.boardTopics) goes through
// Redis. Posts, comments, votes, moderation verdicts and reports are
// user-generated and must show the moment they change — never cached.
export const boardRouter = router({});
