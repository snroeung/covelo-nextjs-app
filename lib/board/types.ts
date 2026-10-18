// Board API shapes — what server/routers/board.ts returns and the board UI
// renders. Client-safe: types only.

import type { AvatarTone } from "./avatar";
import type { BoardOffer } from "./offerView";
import type { ModReason, ModFlag, BoardPostKind } from "./constants";

export type { BoardOffer, BoardPostKind };

export type ModStatus = "clean" | "unscanned" | "held" | "removed";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type VoteValue = -1 | 0 | 1;

export interface BoardAuthor {
  name: string;
  initials: string;
  tone: AvatarTone;
  /** covelo's own account — admin-published offers */
  isSystem: boolean;
}

export interface BoardTopicRef {
  id: string;
  name: string;
  key: string;
}

/** Shown to the author (and admins) when their content isn't public. */
export interface ModNotice {
  kind: "held" | "removed" | "rejected";
  message: string;
  /** Admin-entered reason for removed / rejected content */
  reason: string | null;
}

/** Full moderation detail — admins only. */
export interface ModDetail {
  status: ModStatus;
  reasons: ModReason[];
  flags: ModFlag[];
  scores: Record<string, unknown> | null;
  removedReason: string | null;
  /** Open (unresolved) member reports against this item */
  reportCount: number;
  /** Distinct reasons members gave */
  reportReasons: string[];
  /** Posts only, set by the Mod view's Reported filter: open reports on this post's comments */
  reportedComments?: number;
}

export interface BoardPost {
  id: string;
  kind: BoardPostKind;
  title: string;
  body: string;
  author: BoardAuthor;
  isMine: boolean;
  createdAt: string;
  /** Primary topic first */
  topics: BoardTopicRef[];
  /** Sum of every vote, the viewer's included */
  score: number;
  myVote: VoteValue;
  saved: boolean;
  commentCount: number;
  commentsLocked: boolean;
  offer: BoardOffer | null;
  /** Offers only; null for tips */
  review: ReviewStatus | null;
  verified: { by: string; at: string } | null;
  notice: ModNotice | null;
  mod: ModDetail | null;
}

export interface BoardComment {
  id: string;
  postId: string;
  parentId: string | null;
  author: BoardAuthor;
  isMine: boolean;
  /** Original poster */
  isOp: boolean;
  /** "[removed by moderator]" for removed comments */
  body: string;
  createdAt: string;
  score: number;
  myVote: VoteValue;
  notice: ModNotice | null;
  mod: ModDetail | null;
  replies: BoardComment[];
}

export type TopicStatus = "common" | "provisional" | "active" | "dormant" | "hidden";

export interface BoardTopic {
  id: string;
  name: string;
  key: string;
  status: TopicStatus;
  /** Visible posts in the last 30 days + 2 × distinct authors — chip ordering */
  activity: number;
}

export interface Viewer {
  id: string | null;
  isAdmin: boolean;
}
