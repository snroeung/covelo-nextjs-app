import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { router, adminProcedure } from "@/server/trpc";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { redis } from "@/lib/redis";
import { isEnabled } from "@/lib/feature-flags";
import { cacheKeys } from "@/lib/cache-config";
import { BOARD_REJECT_REASONS, BOARD_REMOVE_REASONS, BOARD_TEXT_LIMITS } from "@/lib/board/constants";
import { scanBlocklist } from "@/lib/board/moderation/blocklist";
import { validateTopic } from "@/lib/board/topics";
import type { BoardPost, ModStatus, Viewer } from "@/lib/board/types";
import { logModEvent } from "@/lib/board/server/audit";
import { bustTopicsCache } from "@/lib/board/server/cache";
import { must } from "@/lib/board/server/errors";
import { fetchPost, queryFeed } from "@/lib/board/server/feed";
import { hydratePosts } from "@/lib/board/server/hydrate";
import { loadBlockedTerms } from "@/lib/board/server/moderate";
import {
  approveHeld, bad, dismissReports, loadOfferPost, notApprovable, notFound, rejectOfferPost, restore, takeDown, verify,
} from "@/lib/board/server/review";
import { rescanBlocklist, type RescanResult } from "@/lib/board/server/rescan";
import { assertBoardPostReady, syncSystemPost, type OfferTable } from "@/lib/board/server/systemPost";
import { followMerge, loadTopicIndex, setPostTopics, setPrimaryTopic } from "@/lib/board/server/topics";
import { createSpendingBonusInput, createTransferBonusInput } from "@/server/routers/offers";

// The Board — moderator side (plan §3, §6, §8). Everything here is
// adminProcedure: the caller's JWT must carry app_metadata.role = "admin".
// Like the member router it writes through the service-role client, because
// the board tables deny the session client outright.

const id = z.guid();
const targetKind = z.enum(["post", "comment"]);
type TargetKind = z.infer<typeof targetKind>;

const OK = { ok: true } as const;

/** Cap on the Reported list: the open reports scanned, and so the posts shown. */
const REPORTED_LIMIT = 100;

/** Public posts with open reports (their own, or on a comment), most-reported first. */
async function reportedPosts(admin: SupabaseClient, viewer: Viewer, type?: "tip" | "offer"): Promise<BoardPost[]> {
  const res = await admin.from("board_reports").select("target_kind, target_id").is("resolved_at", null).limit(1000);
  const open = must(res, "open reports") as unknown as Array<{ target_kind: TargetKind; target_id: string }>;

  const onPost = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  for (const r of open) {
    const bucket = r.target_kind === "post" ? onPost : commentCounts;
    bucket.set(r.target_id, (bucket.get(r.target_id) ?? 0) + 1);
  }

  // A reported comment counts toward its post, once it is a public comment (held / removed ones have their own queue)
  const onComments = new Map<string, number>();
  if (commentCounts.size > 0) {
    const comments = await admin.from("board_comments").select("id, post_id").in("id", [...commentCounts.keys()]).is("deleted_at", null).in("mod_status", ["clean", "unscanned"]);
    for (const c of must(comments, "reported comments") as unknown as Array<{ id: string; post_id: string }>) {
      onComments.set(c.post_id, (onComments.get(c.post_id) ?? 0) + (commentCounts.get(c.id) ?? 0));
    }
  }

  const total = (postId: string) => (onPost.get(postId) ?? 0) + (onComments.get(postId) ?? 0);
  const ids = [...new Set([...onPost.keys(), ...onComments.keys()])].sort((a, b) => total(b) - total(a)).slice(0, REPORTED_LIMIT);
  if (ids.length === 0) return [];

  const page = await queryFeed(admin, viewer, { sort: "new", type, ids, modStatuses: ["clean", "unscanned"], limit: REPORTED_LIMIT });
  const posts = await hydratePosts(admin, page.rows, viewer);
  for (const p of posts) if (p.mod) p.mod.reportedComments = onComments.get(p.id) ?? 0;
  return posts.sort((a, b) => total(b.id) - total(a.id));
}

const offersCacheKeys = (table: OfferTable) => (table === "transfer_bonuses" ? cacheKeys.transferBonuses() : cacheKeys.spendingBonuses());

/** The member's own post, as the admin corrected it while reviewing. Omitted = left as written. */
const publishPostEdit = z.object({
  title: z.string().trim().min(1).max(BOARD_TEXT_LIMITS.titleMax),
  body: z.string().trim().max(BOARD_TEXT_LIMITS.bodyMax),
  topicIds: z.array(id).min(1).max(5),
}).optional();

const publishInput = z.discriminatedUnion("table", [
  z.object({ postId: id, table: z.literal("transfer_bonuses"), offer: createTransferBonusInput, post: publishPostEdit }),
  z.object({ postId: id, table: z.literal("spending_bonuses"), offer: createSpendingBonusInput, post: publishPostEdit }),
]);

// ─── Router ──────────────────────────────────────────────────────────────────

export const boardAdminRouter = router({
  /**
   * Mod view on the board page. held / removed / all: posts the member feed
   * hides. reported: public posts that picked up reports short of the
   * auto-hold, most-reported first — on the post itself or on a comment — with
   * counts on `mod`. A reported post is listed until its reports are acted on
   * or dismissed.
   */
  modFeed: adminProcedure("api:board")
    .input(z.object({
      status: z.enum(["held", "removed", "all", "reported"]).default("all"),
      type: z.enum(["tip", "offer"]).optional(),
      cursor: z.string().max(500).nullish(),
    }))
    .query(async ({ input, ctx }): Promise<{ posts: BoardPost[]; nextCursor: string | null }> => {
      const admin = getSupabaseAdmin();
      if (input.status === "reported") return { posts: await reportedPosts(admin, ctx.viewer, input.type), nextCursor: null };

      const modStatuses: ModStatus[] = input.status === "all" ? ["held", "removed"] : [input.status];
      const page = await queryFeed(admin, ctx.viewer, { sort: "new", type: input.type, cursor: input.cursor, modStatuses });
      return { posts: await hydratePosts(admin, page.rows, ctx.viewer), nextCursor: page.nextCursor };
    }),

  // ── Offer verification ──

  approve: adminProcedure("api:board")
    .input(z.object({ postId: id }))
    .mutation(async ({ input, ctx }) => {
      const admin = getSupabaseAdmin();
      const row = await loadOfferPost(admin, input.postId);
      const why = notApprovable(row);
      if (why) throw bad(why);
      await verify(admin, ctx.user.id, row.id);
      return OK;
    }),

  reject: adminProcedure("api:board")
    .input(z.object({ postId: id, reason: z.enum(BOARD_REJECT_REASONS) }))
    .mutation(async ({ input }) => {
      await rejectOfferPost(getSupabaseAdmin(), input.postId, input.reason);
      return OK;
    }),

  /** Posts that need the editor (member-created offers) are skipped, not failed. */
  bulkApprove: adminProcedure("api:board")
    .input(z.object({ ids: z.array(id).min(1).max(100) }))
    .mutation(async ({ input, ctx }): Promise<{ approved: string[]; skipped: Array<{ id: string; reason: string }> }> => {
      const admin = getSupabaseAdmin();
      const approved: string[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      for (const postId of input.ids) {
        const row = await fetchPost(admin, postId);
        const why = !row || row.deleted_at ? "Post not found." : notApprovable(row);
        if (why) {
          skipped.push({ id: postId, reason: why });
          continue;
        }
        await verify(admin, ctx.user.id, postId);
        approved.push(postId);
      }
      return { approved, skipped };
    }),

  /**
   * Publish a member-created offer: add it to the catalog, point the member's
   * post at it, and verify the post. PostgREST has no multi-statement
   * transaction, so a failure part-way undoes the earlier steps by hand.
   */
  publish: adminProcedure("api:board")
    .input(publishInput)
    .mutation(async ({ input, ctx }): Promise<{ offerId: string; post: BoardPost }> => {
      const admin = getSupabaseAdmin();
      const { table, offer } = input;
      const row = await loadOfferPost(admin, input.postId);
      if (!row.member_offer_id) throw bad("This post already links a catalog offer.");
      if (offer.post_to_board) assertBoardPostReady({ board_post_title: offer.board_post_title ?? null, board_topic: offer.board_topic ?? null });

      // Check the corrected topics before anything is written, so a bad pick leaves no half-published offer
      let postTopicIds: string[] | null = null;
      if (input.post) {
        const index = await loadTopicIndex(admin);
        postTopicIds = [];
        for (const topicId of input.post.topicIds) {
          const picked = index.byId.get(topicId);
          const topic = picked ? followMerge(index, picked) : null;
          if (!topic || topic.status === "hidden") throw bad("One of those topics isn't available.");
          if (!postTopicIds.includes(topic.id)) postTopicIds.push(topic.id);
        }
      }

      const inserted = await admin
        .from(table)
        .insert({ ...offer, source: "member", status: "approved", active: true, submitted_by: row.author_id })
        .select("id")
        .single();
      const offerId = (must(inserted, "publish offer") as unknown as { id: string }).id;
      const undo: Array<() => PromiseLike<unknown>> = [() => admin.from(table).delete().eq("id", offerId)];

      try {
        must(
          await admin.from("board_member_offers").update({ published_table: table, published_id: offerId }).eq("id", row.member_offer_id) as never,
          "publish link",
        );
        undo.push(() => admin.from("board_member_offers").update({ published_table: null, published_id: null }).eq("id", row.member_offer_id!));

        // One statement: the post must always have exactly one offer link
        must(
          await admin.from("board_posts").update({
            offer_table: table, offer_id: offerId, member_offer_id: null,
            review: "approved", verified_by: ctx.user.id, verified_at: new Date().toISOString(), reject_reason: null,
            ...(input.post ? { title: input.post.title, body: input.post.body } : {}),
          }).eq("id", row.id) as never,
          "publish post",
        );
        if (postTopicIds) await setPostTopics(admin, row.id, postTopicIds);
      } catch (err) {
        for (const step of undo.reverse()) {
          try { await step(); } catch { /* best effort — the original error is what matters */ }
        }
        throw err;
      }

      if (offer.post_to_board) {
        await syncSystemPost(admin, table, offerId, {
          post_to_board: true, board_topic: offer.board_topic ?? null, board_post_title: offer.board_post_title ?? null, board_post_body: offer.board_post_body ?? null,
        }, ctx.user.id).catch((err) => {
          throw new TRPCError({ code: err instanceof TRPCError ? err.code : "INTERNAL_SERVER_ERROR", message: `Published, but not posted to the board: ${err instanceof Error ? err.message : "sync failed"}` });
        });
      }
      if (isEnabled("integration:redis:offers")) await redis.del(offersCacheKeys(table)).catch(() => {});

      const fresh = (await fetchPost(admin, row.id))!;
      return { offerId, post: (await hydratePosts(admin, [fresh], ctx.viewer))[0] };
    }),

  // ── Moderating content ──

  takeDown: adminProcedure("api:board")
    .input(z.object({ kind: targetKind, id, reason: z.enum(BOARD_REMOVE_REASONS), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      await takeDown(getSupabaseAdmin(), ctx.user.id, input.kind, input.id, input.reason, input.note);
      return OK;
    }),

  restore: adminProcedure("api:board")
    .input(z.object({ kind: targetKind, id }))
    .mutation(async ({ input, ctx }) => {
      await restore(getSupabaseAdmin(), ctx.user.id, input.kind, input.id);
      return OK;
    }),

  approveHeld: adminProcedure("api:board")
    .input(z.object({ kind: targetKind, id }))
    .mutation(async ({ input, ctx }) => {
      await approveHeld(getSupabaseAdmin(), ctx.user.id, input.kind, input.id);
      return OK;
    }),

  /** Reported but fine: settle the reports and leave the content up. */
  dismissReports: adminProcedure("api:board")
    .input(z.object({ kind: targetKind, id }))
    .mutation(async ({ input, ctx }) => {
      await dismissReports(getSupabaseAdmin(), ctx.user.id, input.kind, input.id);
      return OK;
    }),

  /** The Mod view's bulk bar. One bad id never blocks the rest. */
  bulk: adminProcedure("api:board")
    .input(z.object({
      action: z.enum(["takeDown", "approveHeld", "restore", "dismissReports"]),
      kind: targetKind,
      ids: z.array(id).min(1).max(100),
      reason: z.enum(BOARD_REMOVE_REASONS).optional(),
      note: z.string().trim().max(500).optional(),
    }).refine((v) => v.action !== "takeDown" || !!v.reason, { message: "A reason is required to take content down.", path: ["reason"] }))
    .mutation(async ({ input, ctx }): Promise<{ done: string[]; failed: Array<{ id: string; message: string }> }> => {
      const admin = getSupabaseAdmin();
      const done: string[] = [];
      const failed: Array<{ id: string; message: string }> = [];
      for (const targetId of input.ids) {
        try {
          if (input.action === "takeDown") await takeDown(admin, ctx.user.id, input.kind, targetId, input.reason!, input.note);
          else if (input.action === "restore") await restore(admin, ctx.user.id, input.kind, targetId);
          else if (input.action === "dismissReports") await dismissReports(admin, ctx.user.id, input.kind, targetId);
          else await approveHeld(admin, ctx.user.id, input.kind, targetId);
          done.push(targetId);
        } catch (err) {
          failed.push({ id: targetId, message: err instanceof Error ? err.message : "Failed." });
        }
      }
      return { done, failed };
    }),

  /** Fix a miscategorised post: the chosen topic becomes primary and the old primary is dropped. */
  setTopic: adminProcedure("api:board")
    .input(z.object({ postId: id, topicId: id }))
    .mutation(async ({ input, ctx }) => {
      const admin = getSupabaseAdmin();
      const row = await fetchPost(admin, input.postId);
      if (!row || row.deleted_at) throw notFound();
      const index = await loadTopicIndex(admin);
      const picked = index.byId.get(input.topicId);
      const topic = picked ? followMerge(index, picked) : null;
      if (!topic) throw bad("That topic isn't available.");

      await setPrimaryTopic(admin, row.id, topic.id, "replace");
      // The mismatch flag is answered once an admin has chosen
      must(await admin.from("board_posts").update({ mod_flags: row.mod_flags.filter((f) => f !== "topic_mismatch") }).eq("id", row.id) as never, "clear flag");
      await logModEvent(admin, { targetKind: "post", targetId: row.id, subjectUserId: row.author_id, actorId: ctx.user.id, action: "set_topic", note: `${row.topic_id ?? "none"} → ${topic.id}` });
      await bustTopicsCache();
      return OK;
    }),

  lockComments: adminProcedure("api:board")
    .input(z.object({ postId: id, locked: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const admin = getSupabaseAdmin();
      const row = await fetchPost(admin, input.postId);
      if (!row || row.deleted_at) throw notFound();
      must(await admin.from("board_posts").update({ comments_locked: input.locked }).eq("id", row.id) as never, "lock comments");
      await logModEvent(admin, {
        targetKind: "post", targetId: row.id, subjectUserId: row.author_id, actorId: ctx.user.id,
        action: input.locked ? "lock_comments" : "unlock_comments",
      });
      return OK;
    }),

  /** `normal` clears a manual flag. Removals in the last 30 days still raise watch / restricted on their own. */
  setStanding: adminProcedure("api:board")
    .input(z.object({ userId: id, standing: z.enum(["normal", "restricted", "banned"]), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ input, ctx }) => {
      const admin = getSupabaseAdmin();
      if (input.userId === ctx.user.id) throw bad("You can't change your own standing.");
      if (input.standing === "normal") {
        must(await admin.from("board_user_flags").delete().eq("user_id", input.userId) as never, "clear standing");
      } else {
        must(
          await admin.from("board_user_flags").upsert(
            { user_id: input.userId, standing: input.standing, set_by: ctx.user.id, note: input.note || null },
            { onConflict: "user_id" },
          ) as never,
          "set standing",
        );
      }
      await logModEvent(admin, { targetKind: "user", targetId: input.userId, subjectUserId: input.userId, actorId: ctx.user.id, action: "set_standing", reasons: [input.standing], note: input.note });
      return OK;
    }),

  // ── Topics ──

  topics: router({
    rename: adminProcedure("api:board")
      .input(z.object({ id, name: z.string().trim().min(1).max(60) }))
      .mutation(async ({ input, ctx }) => {
        const admin = getSupabaseAdmin();
        const [index, terms] = await Promise.all([loadTopicIndex(admin), loadBlockedTerms(admin)]);
        const topic = index.byId.get(input.id);
        if (!topic) throw notFound("Topic");
        const v = validateTopic(input.name, { isBlocked: (n) => scanBlocklist(n, terms).tier !== null });
        if (!v.ok) throw bad(v.error);

        if (v.key !== topic.key) {
          const clash = index.topics.find((t) => t.id !== topic.id && t.key === v.key) ?? (index.aliases.has(v.key) && index.aliases.get(v.key) !== topic.id ? index.byId.get(index.aliases.get(v.key)!) : undefined);
          if (clash) throw new TRPCError({ code: "CONFLICT", message: `"${clash.name}" already uses that name.` });
          // Its new key is no longer an alias; its old key becomes one
          await admin.from("board_topic_aliases").delete().eq("key", v.key).eq("topic_id", topic.id);
          must(await admin.from("board_topic_aliases").upsert({ key: topic.key, topic_id: topic.id }, { onConflict: "key", ignoreDuplicates: true }) as never, "alias");
        }
        must(await admin.from("board_topics").update({ name: v.name, key: v.key }).eq("id", topic.id) as never, "rename");
        await logModEvent(admin, { targetKind: "topic", targetId: topic.id, actorId: ctx.user.id, action: "topic_rename", note: `${topic.name} → ${v.name}` });
        await bustTopicsCache();
        return OK;
      }),

    /** Atomic (board_merge_topics): posts, aliases and earlier merges all move to the target. */
    merge: adminProcedure("api:board")
      .input(z.object({ sourceId: id, targetId: id }))
      .mutation(async ({ input, ctx }) => {
        const admin = getSupabaseAdmin();
        const res = await admin.rpc("board_merge_topics", { p_source: input.sourceId, p_target: input.targetId });
        if (res.error) {
          if (res.error.code === "22023") throw bad(res.error.message);
          if (res.error.code === "P0002") throw notFound("Topic");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Topic merge failed: ${res.error.message}` });
        }
        await logModEvent(admin, { targetKind: "topic", targetId: input.sourceId, actorId: ctx.user.id, action: "topic_merge", note: `into ${input.targetId}` });
        await bustTopicsCache();
        return OK;
      }),

    hide: adminProcedure("api:board")
      .input(z.object({ id, hidden: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const admin = getSupabaseAdmin();
        const topic = (await loadTopicIndex(admin)).byId.get(input.id);
        if (!topic) throw notFound("Topic");
        if (topic.merged_into_id) throw bad("A merged topic can't be shown again — merge is permanent.");
        // Unhiding returns it as active; the nightly dormancy job re-evaluates it
        must(await admin.from("board_topics").update({ status: input.hidden ? "hidden" : "active" }).eq("id", topic.id) as never, "hide topic");
        await logModEvent(admin, { targetKind: "topic", targetId: topic.id, actorId: ctx.user.id, action: "topic_hide", note: input.hidden ? "hidden" : "unhidden" });
        await bustTopicsCache();
        return OK;
      }),

    promote: adminProcedure("api:board")
      .input(z.object({ id }))
      .mutation(async ({ input, ctx }) => {
        const admin = getSupabaseAdmin();
        const topic = (await loadTopicIndex(admin)).byId.get(input.id);
        if (!topic) throw notFound("Topic");
        if (topic.merged_into_id || topic.status === "hidden") throw bad("Show the topic before promoting it.");
        must(await admin.from("board_topics").update({ status: "common" }).eq("id", topic.id) as never, "promote topic");
        await logModEvent(admin, { targetKind: "topic", targetId: topic.id, actorId: ctx.user.id, action: "topic_promote" });
        await bustTopicsCache();
        return OK;
      }),
  }),

  // ── Blocklist ──

  blockedTerms: router({
    list: adminProcedure("api:board").query(async () => {
      const res = await getSupabaseAdmin().from("board_blocked_terms").select("term, tier, created_at").order("created_at", { ascending: false }).limit(1000);
      return must(res, "blocked terms") as unknown as Array<{ term: string; tier: "hard" | "soft"; created_at: string }>;
    }),

    /** Matched through obscenity (so l33t and stretched spellings count), as a whole word. hard rejects, soft holds. */
    add: adminProcedure("api:board")
      .input(z.object({ term: z.string().trim().min(2).max(64), tier: z.enum(["hard", "soft"]) }))
      .mutation(async ({ input, ctx }) => {
        const admin = getSupabaseAdmin();
        const term = input.term.toLowerCase().replace(/\s+/g, " ");
        const res = await admin.from("board_blocked_terms").insert({ term, tier: input.tier, added_by: ctx.user.id });
        if (res.error?.code === "23505") throw new TRPCError({ code: "CONFLICT", message: "That term is already on the list." });
        must({ data: null, error: res.error }, "add term");
        await logModEvent(admin, { targetKind: "term", actorId: ctx.user.id, action: "term_add", reasons: [input.tier], note: term });
        return OK;
      }),

    remove: adminProcedure("api:board")
      .input(z.object({ term: z.string().trim().min(1).max(64) }))
      .mutation(async ({ input, ctx }) => {
        const admin = getSupabaseAdmin();
        const term = input.term.toLowerCase().replace(/\s+/g, " ");
        must(await admin.from("board_blocked_terms").delete().eq("term", term) as never, "remove term");
        await logModEvent(admin, { targetKind: "term", actorId: ctx.user.id, action: "term_remove", note: term });
        return OK;
      }),
  }),

  /** After editing the blocklist: hold recent posts and comments that now match. */
  rescan: adminProcedure("api:board")
    .input(z.object({ days: z.number().int().min(1).max(30).default(30) }).default({ days: 30 }))
    .mutation(async ({ input, ctx }): Promise<RescanResult> => {
      const admin = getSupabaseAdmin();
      const terms = await loadBlockedTerms(admin);
      const result = await rescanBlocklist(admin, terms, { days: input.days, actorId: ctx.user.id });
      if (result.held > 0) await bustTopicsCache();
      return result;
    }),
});

