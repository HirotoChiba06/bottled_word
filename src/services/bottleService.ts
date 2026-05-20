import { getDb } from "../db/connection";
import type { Bottle, BottleComment, BottleVisit } from "../types";

type Collection = {
  sentBottles: Bottle[];
  receivedVisits: (BottleVisit & { bottle_content: string })[];
  writtenComments: (BottleComment & { bottle_content: string })[];
  returnedBottles: (Bottle & { comments: BottleComment[] })[];
};

// ボトルごとに帰還までの必要コメント数を3〜5件でランダム化する。
function randomTargetCommentCount(): number {
  return Math.floor(Math.random() * 3) + 3;
}



export function createBottle(authorUserKey: string, content: string): void {
  getDb().prepare(`
    INSERT INTO bottles (author_user_key, content, target_comment_count)
    VALUES (?, ?, ?)
  `).run(authorUserKey, content, randomTargetCommentCount());
}



export function findRandomDriftingBottle(userKey: string): Bottle | undefined {
  const db = getDb();
  // 漂流中のボトルのうち、自分のボトルとコメント済みのボトルは除外する。
  const bottle = db.prepare(`
    SELECT *
    FROM bottles
    WHERE status = 'drifting'
      AND author_user_key != ?
      AND NOT EXISTS (
        SELECT 1 FROM bottle_comments
        WHERE bottle_comments.bottle_id = bottles.id
          AND bottle_comments.commenter_user_key = ?
      )
    ORDER BY RANDOM()
    LIMIT 1
  `).get(userKey, userKey) as Bottle | undefined;

  if (bottle) {
    db.prepare(`
      INSERT INTO bottle_visits (bottle_id, visitor_user_key, action)
      VALUES (?, ?, 'viewed')
    `).run(bottle.id, userKey);
  }

  return bottle;
}



export function addCommentToBottle(bottleId: number, userKey: string, content: string): { ok: true } | { ok: false; message: string } {
  const db = getDb();
  const bottle = db.prepare("SELECT * FROM bottles WHERE id = ?").get(bottleId) as Bottle | undefined;

  if (!bottle || bottle.status !== "drifting") {
    return { ok: false, message: "このボトルはもう漂流していません。" };
  }

  if (bottle.author_user_key === userKey) {
    return { ok: false, message: "自分が流したボトルにはコメントできません。" };
  }

  const alreadyCommented = db.prepare(`
    SELECT id FROM bottle_comments
    WHERE bottle_id = ? AND commenter_user_key = ?
  `).get(bottleId, userKey);

  if (alreadyCommented) {
    return { ok: false, message: "このボトルにはすでにコメント済みです。" };
  }

  // コメント追加・履歴記録・帰還判定は一貫性が必要なのでtransactionでまとめている。
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO bottle_comments (bottle_id, commenter_user_key, content)
      VALUES (?, ?, ?)
    `).run(bottleId, userKey, content);

    db.prepare(`
      INSERT INTO bottle_visits (bottle_id, visitor_user_key, action)
      VALUES (?, ?, 'commented')
    `).run(bottleId, userKey);

    const newCount = bottle.comment_count + 1;
    const hasReturned = newCount >= bottle.target_comment_count;

    db.prepare(`
      UPDATE bottles
      SET comment_count = ?,
          status = ?,
          returned_at = CASE WHEN ? THEN datetime('now') ELSE returned_at END
      WHERE id = ?
    `).run(newCount, hasReturned ? "returned" : "drifting", hasReturned ? 1 : 0, bottleId);
  });

  transaction();
  return { ok: true };
}



export function getCollection(userKey: string): Collection {
  const db = getDb();
  const sentBottles = db.prepare(`
    SELECT * FROM bottles
    WHERE author_user_key = ?
    ORDER BY created_at DESC
  `).all(userKey) as Bottle[];

  const receivedVisits = db.prepare(`
    SELECT bottle_visits.*, bottles.content AS bottle_content
    FROM bottle_visits
    JOIN bottles ON bottles.id = bottle_visits.bottle_id
    WHERE bottle_visits.visitor_user_key = ?
    ORDER BY bottle_visits.visited_at DESC
    LIMIT 30
  `).all(userKey) as (BottleVisit & { bottle_content: string })[];

  const writtenComments = db.prepare(`
    SELECT bottle_comments.*, bottles.content AS bottle_content
    FROM bottle_comments
    JOIN bottles ON bottles.id = bottle_comments.bottle_id
    WHERE bottle_comments.commenter_user_key = ?
    ORDER BY bottle_comments.created_at DESC
  `).all(userKey) as (BottleComment & { bottle_content: string })[];

  const returnedBase = db.prepare(`
    SELECT * FROM bottles
    WHERE author_user_key = ? AND status = 'returned'
    ORDER BY returned_at DESC
  `).all(userKey) as Bottle[];

  const commentsByBottle = db.prepare(`
    SELECT * FROM bottle_comments
    WHERE bottle_id = ?
    ORDER BY created_at ASC
  `);

  const returnedBottles = returnedBase.map((bottle) => ({
    ...bottle,
    comments: commentsByBottle.all(bottle.id) as BottleComment[],
  }));

  return { sentBottles, receivedVisits, writtenComments, returnedBottles };
}

/**
 * 以降解決すべき設計課題
 * 
 * findRandomDriftingBottle が閲覧記録までしている。
 * コメントエラー時にroute側で別ボトルが表示される可能性。
 * 同時コメント時の comment_count 競合。
 * ORDER BY RANDOM() はデータが増えると重い。
 * viewするだけで毎回 viewed が増えるので履歴が膨らむ。
 * 
 * 後日対応。
 */