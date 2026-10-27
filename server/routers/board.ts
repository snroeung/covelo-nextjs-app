import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { router, viewerProcedure, authedProcedure } from "@/server/trpc";
import { boardAdminRouter } from "@/server/routers/boardAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CACHE, cacheKeys } from "@/lib/cache-config";
import {
  BOARD_OFFER_TYPES, BOARD_REPORT_REASONS, BOARD_TEXT_LIMITS, MOD_THRESHOLDS,
} from "@/lib/board/constants";
import {
  BOARD_COOLDOWNS, checkCooldown, checkPerTarget, checkPostTopics, checkRateLimit, checkRateLimitFor, checkRejectLock,
  remaining, type BoardLimitAction,
} from "@/lib/board/limits";
import { scanBlocklist } from "@/lib/board/moderation/blocklist";
import { heldMessage } from "@/lib/board/moderation/decide";
import { ISSUER_LABELS } from "@/lib/discover/offerCopy";
import {
  catalogSpendingOffer, catalogTransferOffer, type BoardOffer, type SpendingBonusFields, type TransferBonusFields,
} from "@/lib/board/offerView";
import type { BoardComment, BoardPost, BoardTopic, TopicStatus, Viewer, VoteValue } from "@/lib/board/types";
import { canSeeComment, canSeePost } from "@/lib/board/visibility";
import { loadActor, loadDisplayName, type UserEvents } from "@/lib/board/server/actor";
import { logModEvent } from "@/lib/board/server/audit";
import { bustTopicsCache, cacheGet, cacheSet } from "@/lib/board/server/cache";
import { must, throwIfBlocked } from "@/lib/board/server/errors";
import { countFeed, fetchPost, queryFeed, type FeedRow } from "@/lib/board/server/feed";
import { COMMENT_COLUMNS, buildCommentTree, hydratePosts, loadThread, type CommentRow } from "@/lib/board/server/hydrate";
import { loadBlockedTerms, moderateSubmission } from "@/lib/board/server/moderate";
import {
  createTopics, deleteTopics, loadTopicIndex, planTopics, previewTopic, topicFamily, type TopicPreview,
} from "@/lib/board/server/topics";

// The Board — member side (plan §3). Every read and write goes through the
// service-role client: the board tables deny anon/authenticated outright, so
// visibility, rate limits and moderation live here and nowhere can be skipped
// by talking to PostgREST directly.
//
// Caching: only the shared topic list (cacheKeys.boardTopics) goes through
// Redis. Posts, comments, votes, verdicts and reports are user-generated and
// must show the moment they change — never cached.

// ─── Input schemas ───────────────────────────────────────────────────────────

const id = z.guid();
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const topicInput = z.union([z.object({ id }), z.object({ name: text(60) })]);

const sourceLink = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Source link must start with http:// or https://")
  .optional();

const newOfferInput = z.object({
  type: z.enum(BOARD_OFFER_TYPES),
  value: text(24),
  name: text(120),
  from: text(80),
  to: optionalText(80),
  conditions: optionalText(300),
  ends: optionalText(40),
  url: sourceLink,
});

const createPostInput = z
  .object({
    kind: z.enum(["tip", "offer"]),
    title: text(BOARD_TEXT_LIMITS.titleMax),
    body: z.string().trim().max(BOARD_TEXT_LIMITS.bodyMax).default(""),
    topics: z.array(topicInput).min(1).max(5),
    link: z.object({ table: z.enum(["transfer_bonuses", "spending_bonuses"]), id }).optional(),
    newOffer: newOfferInput.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "tip" && (v.link || v.newOffer)) {
      ctx.addIssue({ code: "custom", message: "Tips can't carry an offer.", path: ["kind"] });
    }
    if (v.kind === "offer" && Boolean(v.link) === Boolean(v.newOffer)) {
      ctx.addIssue({ code: "custom", message: "Link a covelo offer or create a new one.", path: ["link"] });
    }
  });

const voteValue = z.union([z.literal(-1), z.literal(0), z.literal(1)]);

// ─── Small helpers ───────────────────────────────────────────────────────────

const notFound = (what = "Post") => new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const DAY_MS = 24 * 60 * 60 * 1000;

const times = (xs: ReadonlyArray<{ createdAt: Date }>) => xs.map((x) => x.createdAt);

async function visiblePost(admin: SupabaseClient, postId: string, viewer: Viewer): Promise<FeedRow> {
  const row = await fetchPost(admin, postId);
  if (!row || !canSeePost(row, viewer)) throw notFound();
  return row;
}

async function hydrateOne(admin: SupabaseClient, row: FeedRow, viewer: Viewer): Promise<BoardPost> {
  return (await hydratePosts(admin, [row], viewer))[0];
}

interface ModerationSummary {
  status: "clean" | "unscanned" | "held";
  reasons: string[];
  /** What to tell the author; null when nothing is held */
  message: string | null;
}

const toSummary = (status: ModerationSummary["status"], reasons: readonly string[]): ModerationSummary => ({
  status,
  reasons: [...reasons],
  message: status === "held" ? heldMessage(reasons) : null,
});

/** Posting timestamps split the three ways the caps count them. */
function postStamps(posts: UserEvents["posts"]) {
  return {
    all: times(posts),
    offers: times(posts.filter((p) => p.kind === "offer")),
    newOffers: times(posts.filter((p) => p.newOffer)),
  };
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const boardRouter = router({
  admin: boardAdminRouter,

  posts: router({
    /** The feed. Chip counts ride along on page one. */
    list: viewerProcedure("api:board")
      .input(z.object({
        type: z.enum(["tip", "offer"]).optional(),
        topic: id.optional(),
        q: z.string().trim().max(100).optional(),
        verified: z.boolean().optional(),
        sort: z.enum(["hot", "new", "top"]).default("hot"),
        cursor: z.string().max(500).nullish(),
      }))
      .query(async ({ input, ctx }): Promise<{
        posts: BoardPost[];
        nextCursor: string | null;
        counts: { all: number; byTopic: Record<string, number> } | null;
      }> => {
        const admin = getSupabaseAdmin();
        const { viewer } = ctx;

        let topicIds: string[] | undefined;
        if (input.topic) {
          topicIds = topicFamily(await loadTopicIndex(admin), input.topic);
        }

        const params = { type: input.type, topicIds, q: input.q, verifiedOnly: input.verified, sort: input.sort, cursor: input.cursor };
        const firstPage = !input.cursor;
        const [page, counts] = await Promise.all([
          queryFeed(admin, viewer, params),
          firstPage ? loadChipCounts(admin, viewer, input.type) : Promise.resolve(null),
        ]);
        return { posts: await hydratePosts(admin, page.rows, viewer), nextCursor: page.nextCursor, counts };
      }),

    get: viewerProcedure("api:board")
      .input(z.object({ id }))
      .query(async ({ input, ctx }): Promise<{ post: BoardPost; comments: BoardComment[] }> => {
        const admin = getSupabaseAdmin();
        const row = await visiblePost(admin, input.id, ctx.viewer);
        const [post, comments] = await Promise.all([
          hydrateOne(admin, row, ctx.viewer),
          loadThread(admin, row.id, row.author_id, ctx.viewer),
        ]);
        return { post, comments };
      }),

    create: authedProcedure("api:board")
      .input(createPostInput)
      .mutation(async ({ input, ctx }): Promise<{ post: BoardPost; moderation: ModerationSummary }> => {
        const admin = getSupabaseAdmin();
        const { user, isAdmin, viewer } = ctx;
        const now = new Date();

        const [actor, index, authorName, terms] = await Promise.all([
          loadActor(admin, user, isAdmin, undefined, now),
          loadTopicIndex(admin),
          loadDisplayName(admin, user),
          loadBlockedTerms(admin),
        ]);
        const { ctx: limitCtx, events } = actor;

        // Cheap checks first — a throttled member costs no LLM call
        throwIfBlocked(checkRejectLock(events.rejects, limitCtx));
        const stamps = postStamps(events.posts);
        throwIfBlocked(checkCooldown("post", latest(stamps.all), limitCtx));
        throwIfBlocked(checkRateLimit("post", stamps.all, limitCtx));
        if (input.kind === "offer") throwIfBlocked(checkRateLimit("offerPost", stamps.offers, limitCtx));
        if (input.newOffer) throwIfBlocked(checkRateLimit("newOfferPost", stamps.newOffers, limitCtx));

        // Topics: resolve without creating anything yet
        let blockedTopicName = false;
        const isBlocked = (name: string) => {
          const hit = scanBlocklist(name, terms).tier !== null;
          if (hit) blockedTopicName = true;
          return hit;
        };
        let plan;
        try {
          plan = await planTopics(admin, index, input.topics, isBlocked);
        } catch (err) {
          if (blockedTopicName) {
            await logModEvent(admin, { targetKind: "post", subjectUserId: user.id, action: "auto_reject", reasons: ["soft_blocklist"] });
          }
          throw err;
        }
        throwIfBlocked(checkPostTopics(plan.ordered.length, plan.toCreate.length));
        throwIfBlocked(checkRateLimitFor("topicCreate", events.topics, plan.toCreate.length, limitCtx));

        // A linked offer has to be live, and one member can't re-post it for a week
        if (input.link) {
          await assertLinkable(admin, input.link, now);
          if (!isAdmin) await assertNotRecentlyLinked(admin, user.id, input.link, now);
        }

        const chosenTopics = plan.ordered.map((i) => (i.type === "existing" ? i.topic.name : i.name));
        const outcome = await moderateSubmission(
          admin,
          {
            kind: input.kind,
            title: input.title,
            body: input.body,
            offer: input.newOffer && { ...input.newOffer, url: input.newOffer.url || undefined },
            chosenTopics,
            newTopics: plan.toCreate.map((t) => t.name),
            availableTopics: index.topics.filter((t) => t.status !== "hidden").map((t) => t.name),
            standing: limitCtx.standing,
            duplicateOf: { userId: user.id, title: input.title, now },
          },
          { terms },
        );
        const { decision } = outcome;

        if (decision.action === "reject") {
          await logModEvent(admin, {
            targetKind: "post", subjectUserId: user.id, action: "auto_reject", reasons: decision.reasons,
            scores: outcome.verdict, model: outcome.model, contentHash: outcome.hash,
          });
          throw new TRPCError({ code: "BAD_REQUEST", message: decision.message });
        }

        // Accepted — now it is safe to create things
        const created = await createTopics(admin, plan.toCreate, user.id);
        const createdByKey = new Map(created.map((c) => [c.topic.key, c]));
        const resolved = plan.ordered.map((item) =>
          item.type === "existing"
            ? { topic: item.topic, createdNew: false }
            : createdByKey.get(item.key)!,
        );
        const primary = resolved[0].topic;
        const cleanup: Array<() => PromiseLike<unknown>> = [
          () => deleteTopics(admin, created.filter((c) => c.createdNew).map((c) => c.topic.id)),
        ];

        let createdId: string;
        try {
          let memberOfferId: string | null = null;
          if (input.newOffer) {
            const inserted = await admin
              .from("board_member_offers")
              .insert(toMemberOfferRow(input.newOffer))
              .select("id")
              .single();
            memberOfferId = (must(inserted, "offer create") as unknown as { id: string }).id;
            cleanup.push(() => admin.from("board_member_offers").delete().eq("id", memberOfferId!));
          }

          const suggestedName = outcome.verdict?.suggested_topic?.toLowerCase();
          const suggestedTopic = suggestedName ? index.topics.find((t) => t.name.toLowerCase() === suggestedName) : undefined;
          const searchExtra = [
            authorName,
            ...resolved.map((r) => r.topic.name),
            input.newOffer?.name, input.newOffer?.from, input.newOffer?.to,
          ].filter(Boolean).join(" ");

          const insertedPost = await admin
            .from("board_posts")
            .insert({
              kind: input.kind,
              author_id: user.id,
              topic_id: primary.id,
              title: input.title,
              body: input.body,
              search_extra: searchExtra,
              offer_table: input.link?.table ?? null,
              offer_id: input.link?.id ?? null,
              member_offer_id: memberOfferId,
              review: input.kind === "offer" ? "pending" : null,
              mod_status: decision.modStatus,
              mod_reasons: decision.reasons,
              mod_flags: decision.flags,
              mod_scores: outcome.verdict,
              mod_model: outcome.model,
              suggested_topic_id: suggestedTopic?.id ?? null,
            })
            .select("id")
            .single();
          const postId = (must(insertedPost, "post create") as unknown as { id: string }).id;
          cleanup.push(() => admin.from("board_posts").delete().eq("id", postId));

          const links = await admin.from("board_post_topics").insert(
            resolved.map((r, i) => ({ post_id: postId, topic_id: r.topic.id, is_primary: i === 0, created_new: r.createdNew })),
          );
          must({ data: null, error: links.error }, "topic link");

          await logModEvent(admin, {
            targetKind: "post", targetId: postId, subjectUserId: user.id,
            action: decision.action === "hold" ? "auto_hold" : "auto_allow",
            reasons: decision.reasons, scores: outcome.verdict, model: outcome.model,
          });
          await bustTopicsCache();
          createdId = postId;
        } catch (err) {
          // PostgREST has no transaction; undo what this request made, newest first
          for (const undo of cleanup.reverse()) {
            try { await undo(); } catch { /* best effort — the original error is what matters */ }
          }
          throw err;
        }

        // Outside the try: the post exists now, so a failed read must not trigger the undo above
        const row = await visiblePost(admin, createdId, viewer);
        return { post: await hydrateOne(admin, row, viewer), moderation: toSummary(decision.modStatus, decision.reasons) };
      }),

    /** Title/body only; topics and the offer are fixed. Re-runs moderation. */
    edit: authedProcedure("api:board")
      .input(z.object({ id, title: text(BOARD_TEXT_LIMITS.titleMax), body: z.string().trim().max(BOARD_TEXT_LIMITS.bodyMax) }))
      .mutation(async ({ input, ctx }): Promise<{ post: BoardPost; moderation: ModerationSummary }> => {
        const admin = getSupabaseAdmin();
        const { user, isAdmin, viewer } = ctx;
        const now = new Date();

        const row = await visiblePost(admin, input.id, viewer);
        if (row.author_id !== user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own posts." });
        if (row.mod_status === "removed") throw new TRPCError({ code: "FORBIDDEN", message: "A moderator removed this post." });

        const [actor, index, terms] = await Promise.all([
          loadActor(admin, user, isAdmin, ["edits", "rejects"], now),
          loadTopicIndex(admin),
          loadBlockedTerms(admin),
        ]);
        const { ctx: limitCtx, events } = actor;
        throwIfBlocked(checkRejectLock(events.rejects, limitCtx));
        throwIfBlocked(checkRateLimit("edit", times(events.edits), limitCtx));
        throwIfBlocked(checkPerTarget("editsPerPost", events.edits.filter((e) => e.targetId === row.id).length, limitCtx));

        const outcome = await moderateSubmission(
          admin,
          {
            kind: row.kind, title: input.title, body: input.body,
            availableTopics: index.topics.filter((t) => t.status !== "hidden").map((t) => t.name),
            standing: limitCtx.standing,
          },
          { terms },
        );
        const { decision } = outcome;
        if (decision.action === "reject") {
          await logModEvent(admin, {
            targetKind: "post", targetId: row.id, subjectUserId: user.id, action: "auto_reject", reasons: decision.reasons,
            scores: outcome.verdict, model: outcome.model, contentHash: outcome.hash,
          });
          throw new TRPCError({ code: "BAD_REQUEST", message: decision.message });
        }

        // An edit can hold a post but never release one an admin or the reports queue held
        const wasHeld = row.mod_status === "held";
        const status: ModerationSummary["status"] = wasHeld || decision.action === "hold" ? "held" : decision.modStatus;
        const reasons = decision.action === "hold" ? decision.reasons : wasHeld ? row.mod_reasons : [];
        const update: Record<string, unknown> = {
          title: input.title, body: input.body, mod_status: status, mod_reasons: reasons, mod_flags: decision.flags,
          mod_scores: outcome.verdict, mod_model: outcome.model,
        };
        // Verification vouched for the old text — editing an approved offer puts it back in the queue
        if (row.kind === "offer" && row.review === "approved") {
          Object.assign(update, { review: "pending", verified_by: null, verified_at: null });
        }
        must(await admin.from("board_posts").update(update).eq("id", row.id).select("id").single() as never, "post edit");

        await logModEvent(admin, { targetKind: "post", targetId: row.id, subjectUserId: user.id, action: "post_edit", reasons, scores: outcome.verdict, model: outcome.model });

        const fresh = (await fetchPost(admin, row.id))!;
        return { post: await hydrateOne(admin, fresh, viewer), moderation: toSummary(status, reasons) };
      }),

    /** Author soft-delete. Moderator takedown is admin.takeDown. */
    delete: authedProcedure("api:board")
      .input(z.object({ id }))
      .mutation(async ({ input, ctx }): Promise<{ ok: true }> => {
        const admin = getSupabaseAdmin();
        const row = await fetchPost(admin, input.id);
        if (!row || row.deleted_at || row.author_id !== ctx.user.id) throw notFound();
        must(await admin.from("board_posts").update({ deleted_at: new Date().toISOString() }).eq("id", row.id) as never, "post delete");
        await bustTopicsCache();
        return { ok: true };
      }),

    /** value 0 clears the vote — kept as a row so flapping stays countable. */
    vote: authedProcedure("api:board")
      .input(z.object({ postId: id, value: voteValue }))
      .mutation(async ({ input, ctx }): Promise<{ score: number; myVote: VoteValue }> => {
        const admin = getSupabaseAdmin();
        const row = await visiblePost(admin, input.postId, ctx.viewer);
        const myVote = await castVote(admin, ctx, { target: "post", id: row.id }, input.value);
        const fresh = must(await admin.from("board_posts").select("score").eq("id", row.id).single(), "score") as unknown as { score: number };
        return { score: fresh.score, myVote };
      }),

    save: authedProcedure("api:board")
      .input(z.object({ postId: id, saved: z.boolean() }))
      .mutation(async ({ input, ctx }): Promise<{ saved: boolean }> => {
        const admin = getSupabaseAdmin();
        const row = await visiblePost(admin, input.postId, ctx.viewer);
        const now = new Date();
        const [actor, toggles] = await Promise.all([
          loadActor(admin, ctx.user, ctx.isAdmin, [], now),
          admin
            .from("board_save_toggles")
            .select("id", { count: "exact", head: true })
            .eq("user_id", ctx.user.id)
            .eq("post_id", row.id)
            .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
        ]);
        must({ data: null, error: toggles.error }, "save toggles");
        throwIfBlocked(checkPerTarget("saveTogglesPerPost", toggles.count ?? 0, actor.ctx));
        must(await admin.from("board_save_toggles").insert({ user_id: ctx.user.id, post_id: row.id }) as never, "save toggle");
        if (input.saved) {
          must(await admin.from("board_saves").upsert({ user_id: ctx.user.id, post_id: row.id }, { onConflict: "user_id,post_id", ignoreDuplicates: true }) as never, "save");
        } else {
          must(await admin.from("board_saves").delete().eq("user_id", ctx.user.id).eq("post_id", row.id) as never, "unsave");
        }
        return { saved: input.saved };
      }),
  }),

  comments: router({
    create: authedProcedure("api:board")
      .input(z.object({ postId: id, parentId: id.optional(), body: text(BOARD_TEXT_LIMITS.commentMax) }))
      .mutation(async ({ input, ctx }): Promise<{ comment: BoardComment; moderation: ModerationSummary }> => {
        const admin = getSupabaseAdmin();
        const { user, isAdmin, viewer } = ctx;
        const now = new Date();

        const post = await visiblePost(admin, input.postId, viewer);
        if (post.comments_locked && !isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Comments are locked on this post." });

        let parent: CommentRow | null = null;
        if (input.parentId) {
          const res = await admin.from("board_comments").select(COMMENT_COLUMNS).eq("id", input.parentId).maybeSingle();
          parent = must(res, "parent lookup") as unknown as CommentRow | null;
          if (!parent || parent.post_id !== post.id || !canSeeComment(parent, viewer)) throw notFound("Comment");
        }

        const [actor, terms, authorName] = await Promise.all([
          loadActor(admin, user, isAdmin, ["comments", "rejects"], now),
          loadBlockedTerms(admin),
          loadDisplayName(admin, user),
        ]);
        const { ctx: limitCtx, events } = actor;
        throwIfBlocked(checkRejectLock(events.rejects, limitCtx));
        throwIfBlocked(checkCooldown("comment", latest(times(events.comments)), limitCtx));
        throwIfBlocked(checkRateLimit("comment", times(events.comments), limitCtx));
        throwIfBlocked(checkPerTarget("commentsPerPost", events.comments.filter((c) => c.postId === post.id).length, limitCtx));
        if (parent) {
          throwIfBlocked(checkPerTarget("repliesPerParent", events.comments.filter((c) => c.parentId === parent!.id).length, limitCtx));
        }

        const outcome = await moderateSubmission(admin, { kind: "comment", body: input.body, standing: limitCtx.standing }, { terms });
        const { decision } = outcome;
        if (decision.action === "reject") {
          await logModEvent(admin, {
            targetKind: "comment", subjectUserId: user.id, action: "auto_reject", reasons: decision.reasons,
            scores: outcome.verdict, model: outcome.model, contentHash: outcome.hash,
          });
          throw new TRPCError({ code: "BAD_REQUEST", message: decision.message });
        }

        const inserted = await admin
          .from("board_comments")
          .insert({
            post_id: post.id, parent_id: input.parentId ?? null, author_id: user.id, body: input.body,
            mod_status: decision.modStatus, mod_reasons: decision.reasons, mod_flags: decision.flags,
            mod_scores: outcome.verdict, mod_model: outcome.model,
          })
          .select(COMMENT_COLUMNS)
          .single();
        const row = must(inserted, "comment create") as unknown as CommentRow;

        await logModEvent(admin, {
          targetKind: "comment", targetId: row.id, subjectUserId: user.id,
          action: decision.action === "hold" ? "auto_hold" : "auto_allow",
          reasons: decision.reasons, scores: outcome.verdict, model: outcome.model,
        });

        // The new row is a leaf: reuse the thread builder with it as a root, then restore its parent
        const [node] = buildCommentTree([{ ...row, parent_id: null }], {
          viewer, postAuthorId: post.author_id, names: new Map([[user.id, authorName]]), votes: new Map(),
        });
        return {
          comment: { ...node, parentId: row.parent_id, myVote: 1 },
          moderation: toSummary(decision.modStatus, decision.reasons),
        };
      }),

    vote: authedProcedure("api:board")
      .input(z.object({ commentId: id, value: voteValue }))
      .mutation(async ({ input, ctx }): Promise<{ score: number; myVote: VoteValue }> => {
        const admin = getSupabaseAdmin();
        const comment = await visibleComment(admin, input.commentId, ctx.viewer);
        await visiblePost(admin, comment.post_id, ctx.viewer);
        const myVote = await castVote(admin, ctx, { target: "comment", id: comment.id }, input.value);
        const fresh = must(await admin.from("board_comments").select("score").eq("id", comment.id).single(), "score") as unknown as { score: number };
        return { score: fresh.score, myVote };
      }),

    delete: authedProcedure("api:board")
      .input(z.object({ id }))
      .mutation(async ({ input, ctx }): Promise<{ ok: true }> => {
        const admin = getSupabaseAdmin();
        const res = await admin.from("board_comments").select("id, author_id, deleted_at").eq("id", input.id).maybeSingle();
        const row = must(res, "comment lookup") as unknown as { id: string; author_id: string; deleted_at: string | null } | null;
        if (!row || row.deleted_at || row.author_id !== ctx.user.id) throw notFound("Comment");
        must(await admin.from("board_comments").update({ deleted_at: new Date().toISOString() }).eq("id", row.id) as never, "comment delete");
        return { ok: true };
      }),
  }),

  report: authedProcedure("api:board")
    .input(z.object({
      kind: z.enum(["post", "comment"]),
      id,
      reason: z.enum(BOARD_REPORT_REASONS),
      note: z.string().trim().max(BOARD_TEXT_LIMITS.reportNoteMax).optional(),
    }))
    .mutation(async ({ input, ctx }): Promise<{ ok: true; held: boolean }> => {
      const admin = getSupabaseAdmin();
      const { user, isAdmin, viewer } = ctx;

      const [{ authorId, modStatus, modReasons }, actor] = await Promise.all([
        reportTarget(admin, input.kind, input.id, viewer),
        loadActor(admin, user, isAdmin, ["reports"]),
      ]);
      if (authorId === user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You can't report your own content." });
      throwIfBlocked(checkRateLimit("report", actor.events.reports, actor.ctx));

      const inserted = await admin.from("board_reports").insert({
        target_kind: input.kind, target_id: input.id, reporter_id: user.id, reason: input.reason, note: input.note || null,
      });
      if (inserted.error) {
        if (inserted.error.code === "23505") throw new TRPCError({ code: "CONFLICT", message: "You've already reported this." });
        must({ data: null, error: inserted.error }, "report");
      }

      // Admins act directly; their report never counts toward the auto-hold
      if (isAdmin || (modStatus !== "clean" && modStatus !== "unscanned")) return { ok: true, held: false };
      const counted = await admin
        .from("board_reports")
        .select("id", { count: "exact", head: true })
        .eq("target_kind", input.kind)
        .eq("target_id", input.id)
        .is("resolved_at", null);
      if ((counted.count ?? 0) < MOD_THRESHOLDS.reportsAutoHold) return { ok: true, held: false };

      const table = input.kind === "post" ? "board_posts" : "board_comments";
      must(await admin.from(table).update({ mod_status: "held", mod_reasons: [...new Set([...modReasons, "reports"])] }).eq("id", input.id) as never, "auto-hold");
      await logModEvent(admin, { targetKind: input.kind, targetId: input.id, subjectUserId: authorId, action: "reports_hold", reasons: ["reports"] });
      await bustTopicsCache();
      return { ok: true, held: true };
    }),

  topics: router({
    /** Chips + composer picker: common, active and dormant topics, plus the viewer's own provisional ones. */
    list: viewerProcedure("api:board")
      .input(z.object({ q: z.string().trim().max(60).optional() }).default({}))
      .query(async ({ input, ctx }): Promise<BoardTopic[]> => {
        const admin = getSupabaseAdmin();
        const shared = await sharedTopics(admin);
        let mine: BoardTopic[] = [];
        if (ctx.viewer.id) {
          const res = await admin.from("board_topics").select("id, name, key, status").eq("created_by", ctx.viewer.id).eq("status", "provisional").limit(50);
          mine = (must(res, "own topics") as unknown as Array<Omit<BoardTopic, "activity">>).map((t) => ({ ...t, activity: 0 }));
        }
        const q = input.q?.toLowerCase();
        return [...shared, ...mine].filter((t) => !q || t.name.toLowerCase().includes(q) || t.key.includes(q));
      }),

    /** Composer preview of the dedupe ladder — read-only. */
    resolve: authedProcedure("api:board")
      .input(z.object({ name: z.string().trim().min(1).max(60) }))
      .query(async ({ input }): Promise<TopicPreview> => {
        const admin = getSupabaseAdmin();
        const [index, terms] = await Promise.all([loadTopicIndex(admin), loadBlockedTerms(admin)]);
        return previewTopic(admin, index, input.name, (n) => scanBlocklist(n, terms).tier !== null);
      }),
  }),

  offers: router({
    /** "Link a covelo offer": live catalog offers only. */
    search: viewerProcedure("api:board")
      .input(z.object({ q: z.string().trim().max(60).optional() }).default({}))
      .query(async ({ input }): Promise<BoardOffer[]> => searchCatalog(getSupabaseAdmin(), input.q, new Date())),
  }),

  limits: router({
    /** What the composer shows before the member writes a long post. */
    me: authedProcedure("api:board")
      .query(async ({ ctx }) => {
        const admin = getSupabaseAdmin();
        const actor = await loadActor(admin, ctx.user, ctx.isAdmin);
        const { ctx: lc, events } = actor;
        const left = (action: BoardLimitAction, stamps: Date[]) => remaining(action, stamps, lc);
        const stamps = postStamps(events.posts);
        // Also covers a banned member: the check returns FORBIDDEN for them
        const lock = checkRejectLock(events.rejects, lc);
        const cooldown = checkCooldown("post", latest(stamps.all), lc);
        return {
          standing: lc.standing,
          post: left("post", stamps.all),
          offerPost: left("offerPost", stamps.offers),
          newOfferPost: left("newOfferPost", stamps.newOffers),
          comment: left("comment", times(events.comments)),
          topicCreate: left("topicCreate", events.topics),
          /** Set when the member can't write at all right now */
          blocked: lock.ok ? null : { message: lock.message, retryAt: lock.code === "TOO_MANY_REQUESTS" ? lock.retryAt.toISOString() : null },
          /** Seconds until the next post is allowed (the 30 s gap), 0 when ready */
          postCooldownSeconds: cooldown.ok || cooldown.code !== "TOO_MANY_REQUESTS"
            ? 0
            : Math.ceil((cooldown.retryAt.getTime() - lc.now.getTime()) / 1000),
        };
      }),
  }),
});

// ─── Shared pieces ───────────────────────────────────────────────────────────

function latest(dates: readonly Date[]): Date | null {
  return dates.length === 0 ? null : dates.reduce((a, b) => (b > a ? b : a));
}

async function loadChipCounts(
  admin: SupabaseClient,
  viewer: { id: string | null; isAdmin: boolean },
  type: "tip" | "offer" | undefined,
): Promise<{ all: number; byTopic: Record<string, number> }> {
  const [all, byTopic] = await Promise.all([
    countFeed(admin, viewer, { sort: "new", type }),
    admin.rpc("board_topic_counts", { p_kind: type ?? null }),
  ]);
  const rows = (must(byTopic as never, "topic counts") ?? []) as unknown as Array<{ topic_id: string; n: number | string }>;
  return { all, byTopic: Object.fromEntries(rows.map((r) => [r.topic_id, Number(r.n)])) };
}

/** What a report needs to know about its target; also proves the reporter can see it. */
async function reportTarget(
  admin: SupabaseClient,
  kind: "post" | "comment",
  targetId: string,
  viewer: Viewer,
): Promise<{ authorId: string | null; modStatus: string; modReasons: string[] }> {
  if (kind === "post") {
    const row = await visiblePost(admin, targetId, viewer);
    return { authorId: row.author_id, modStatus: row.mod_status, modReasons: row.mod_reasons };
  }
  const row = await visibleComment(admin, targetId, viewer);
  await visiblePost(admin, row.post_id, viewer);
  return { authorId: row.author_id, modStatus: row.mod_status, modReasons: row.mod_reasons };
}

async function visibleComment(
  admin: SupabaseClient,
  commentId: string,
  viewer: { id: string | null; isAdmin: boolean },
): Promise<CommentRow> {
  const res = await admin.from("board_comments").select(COMMENT_COLUMNS).eq("id", commentId).maybeSingle();
  const row = must(res, "comment lookup") as unknown as CommentRow | null;
  if (!row || !canSeeComment(row, viewer)) throw notFound("Comment");
  return row;
}

/** Cast, change or clear a vote, enforcing the vote caps. Returns the viewer's resulting vote. */
async function castVote(
  admin: SupabaseClient,
  ctx: { user: { id: string; created_at?: string }; isAdmin: boolean },
  target: { target: "post" | "comment"; id: string },
  value: VoteValue,
): Promise<VoteValue> {
  const column = target.target === "post" ? "post_id" : "comment_id";
  const lookup = async () =>
    must(
      await admin.from("board_votes").select("id, value, change_count").eq("user_id", ctx.user.id).eq(column, target.id).maybeSingle(),
      "vote lookup",
    ) as unknown as { id: string; value: VoteValue; change_count: number } | null;

  const [actor, found] = await Promise.all([loadActor(admin, ctx.user, ctx.isAdmin, ["votes"]), lookup()]);
  throwIfBlocked(checkRateLimit("vote", actor.events.votes, actor.ctx));

  let existing = found;
  if (!existing) {
    if (value === 0) return 0;
    const inserted = await admin.from("board_votes").insert({ user_id: ctx.user.id, [column]: target.id, value });
    if (!inserted.error) return value;
    if (inserted.error.code !== "23505") must({ data: null, error: inserted.error }, "vote");
    // A double-tap: the twin request created the row first. Apply this vote on top of it.
    existing = await lookup();
    if (!existing) throw new TRPCError({ code: "CONFLICT", message: "Your vote didn't go through — try again." });
  }
  if (existing.value === value) return value;
  throwIfBlocked(checkPerTarget("voteChangesPerTarget", existing.change_count, actor.ctx));
  must(await admin.from("board_votes").update({ value }).eq("id", existing.id) as never, "vote");
  return value;
}

/** board_member_offers insert row for a member-created offer. */
function toMemberOfferRow(o: z.infer<typeof newOfferInput>) {
  return {
    type: o.type, value: o.value, name: o.name, from_program: o.from, to_program: o.to || null,
    conditions: o.conditions || null, ends_label: o.ends || null, source_url: o.url || null,
  };
}

async function assertLinkable(
  admin: SupabaseClient,
  link: { table: "transfer_bonuses" | "spending_bonuses"; id: string },
  now: Date,
): Promise<void> {
  const res = await admin.from(link.table).select("id, status, active, end_date").eq("id", link.id).maybeSingle();
  const row = must(res, "offer lookup") as unknown as { status: string; active: boolean; end_date: string | null } | null;
  const live = row && row.active && (row.status === "admin" || row.status === "approved") && (!row.end_date || row.end_date >= isoDay(now));
  if (!live) throw new TRPCError({ code: "BAD_REQUEST", message: "That offer isn't available to link." });
}

async function assertNotRecentlyLinked(
  admin: SupabaseClient,
  userId: string,
  link: { table: string; id: string },
  now: Date,
): Promise<void> {
  const since = new Date(now.getTime() - BOARD_COOLDOWNS.sameOfferLinkDays * DAY_MS).toISOString();
  const res = await admin
    .from("board_posts")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .eq("offer_table", link.table)
    .eq("offer_id", link.id)
    .gte("created_at", since);
  if ((res.count ?? 0) > 0) {
    throw new TRPCError({ code: "CONFLICT", message: `You already posted this offer in the last ${BOARD_COOLDOWNS.sameOfferLinkDays} days.` });
  }
}

/** Shared (non-user) topic list, ordered for chips: common first, then by recent activity. Cached 5 min. */
async function sharedTopics(admin: SupabaseClient): Promise<BoardTopic[]> {
  const key = cacheKeys.boardTopics();
  const cached = await cacheGet<BoardTopic[]>(key);
  if (cached) return cached;

  const [topicRes, activityRes] = await Promise.all([
    admin.from("board_topics").select("id, name, key, status").in("status", ["common", "active", "dormant"]).limit(500),
    admin.rpc("board_topic_activity"),
  ]);
  const activity = new Map(
    ((must(activityRes as never, "topic activity") ?? []) as unknown as Array<{ topic_id: string; posts_30d: number | string; authors_30d: number | string }>)
      .map((a) => [a.topic_id, Number(a.posts_30d) + 2 * Number(a.authors_30d)]),
  );
  const rank = (s: TopicStatus) => (s === "common" ? 0 : s === "active" ? 1 : 2);
  const list = (must(topicRes, "topic list") as unknown as Array<Omit<BoardTopic, "activity">>)
    .map((t) => ({ ...t, activity: activity.get(t.id) ?? 0 }))
    .sort((a, b) => rank(a.status) - rank(b.status) || b.activity - a.activity || a.name.localeCompare(b.name));
  await cacheSet(key, list, CACHE.boardTopics.ttl);
  return list;
}

const TRANSFER_SEARCH_COLUMNS = "id, issuer, transfer_partner, bonus_pct, min_transfer_points, end_date, description, source_url";
const SPENDING_SEARCH_COLUMNS = "id, issuer, merchant_name, bonus_multiplier, bonus_type, spending_minimum, minimum_nights, end_date, description, source_url";

export async function searchCatalog(admin: SupabaseClient, q: string | undefined, now: Date): Promise<BoardOffer[]> {
  const today = isoDay(now);
  // PostgREST's or() grammar reserves these; they have no business in a search anyway
  const term = q?.replace(/[,()%*\\]/g, " ").trim();
  const issuers = term
    ? Object.entries(ISSUER_LABELS).filter(([code, label]) => label.toLowerCase().includes(term.toLowerCase()) || code === term.toLowerCase()).map(([code]) => code)
    : [];
  const matchers = (nameColumn: string) =>
    term ? [`${nameColumn}.ilike.%${term}%`, ...issuers.map((i) => `issuer.eq.${i}`)].join(",") : null;

  const run = (table: "transfer_bonuses" | "spending_bonuses", columns: string, nameColumn: string) => {
    let query = admin
      .from(table)
      .select(columns)
      .eq("active", true)
      .in("status", ["admin", "approved"])
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("end_date", { ascending: true, nullsFirst: false })
      .limit(20);
    const m = matchers(nameColumn);
    if (m) query = query.or(m);
    return query;
  };

  const [transfers, spendings] = await Promise.all([
    run("transfer_bonuses", TRANSFER_SEARCH_COLUMNS, "transfer_partner"),
    run("spending_bonuses", SPENDING_SEARCH_COLUMNS, "merchant_name"),
  ]);
  type Row = { end_date: string | null };
  const entries = [
    ...(must(transfers as never, "offer search") as unknown as Array<TransferBonusFields & Row & { id: string; source_url: string | null }>)
      .map((r) => ({ end: r.end_date, offer: catalogTransferOffer(r) })),
    ...(must(spendings as never, "offer search") as unknown as Array<SpendingBonusFields & Row & { id: string; source_url: string | null }>)
      .map((r) => ({ end: r.end_date, offer: catalogSpendingOffer(r) })),
  ];
  // Each table returned its own 20 soonest; interleave by end date (no end date = last) so neither crowds out the other
  return entries
    .sort((a, b) => (a.end ?? "9999-12-31").localeCompare(b.end ?? "9999-12-31"))
    .slice(0, 20)
    .map((e) => e.offer);
}
