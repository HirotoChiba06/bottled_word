import { getClient, query } from "../db/connection";
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

const bottleFields = `
  id,
  author_user_key,
  content,
  status,
  target_comment_count,
  comment_count,
  created_at::text AS created_at,
  returned_at::text AS returned_at
`;

const commentFields = `
  id,
  bottle_id,
  commenter_user_key,
  content,
  created_at::text AS created_at
`;

export async function createBottle(authorUserKey: string, content: string): Promise<void> {
  await query(`
    INSERT INTO bottles (author_user_key, content, target_comment_count)
    VALUES ($1, $2, $3)
  `, [authorUserKey, content, randomTargetCommentCount()]);
}



export async function findRandomDriftingBottle(userKey: string): Promise<Bottle | undefined> {
  // 漂流中のボトルのうち、自分のボトルとコメント済みのボトルは除外する。
  const bottles = await query<Bottle>(`
    SELECT ${bottleFields}
    FROM bottles
    WHERE status = 'drifting'
      AND author_user_key != $1
      AND NOT EXISTS (
        SELECT 1 FROM bottle_comments
        WHERE bottle_comments.bottle_id = bottles.id
          AND bottle_comments.commenter_user_key = $2
      )
    ORDER BY RANDOM()
    LIMIT 1
  `, [userKey, userKey]);
  const bottle = bottles[0];

  if (bottle) {
    await query(`
      INSERT INTO bottle_visits (bottle_id, visitor_user_key, action)
      VALUES ($1, $2, 'viewed')
    `, [bottle.id, userKey]);
  }

  return bottle;
}



export async function addCommentToBottle(bottleId: number, userKey: string, content: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const client = await getClient();

  // コメント追加・履歴記録・帰還判定は一貫性が必要なのでtransactionでまとめている。
  try {
    await client.query("BEGIN");

    const bottleResult = await client.query<Bottle>(`
      SELECT ${bottleFields}
      FROM bottles
      WHERE id = $1
      FOR UPDATE
    `, [bottleId]);
    const bottle = bottleResult.rows[0];

    if (!bottle || bottle.status !== "drifting") {
      await client.query("ROLLBACK");
      return { ok: false, message: "このボトルはもう漂流していません。" };
    }

    if (bottle.author_user_key === userKey) {
      await client.query("ROLLBACK");
      return { ok: false, message: "自分が流したボトルにはコメントできません。" };
    }

    const alreadyCommented = await client.query(`
      SELECT id FROM bottle_comments
      WHERE bottle_id = $1 AND commenter_user_key = $2
    `, [bottleId, userKey]);

    if (alreadyCommented.rowCount && alreadyCommented.rowCount > 0) {
      await client.query("ROLLBACK");
      return { ok: false, message: "このボトルにはすでにコメント済みです。" };
    }

    await client.query(`
      INSERT INTO bottle_comments (bottle_id, commenter_user_key, content)
      VALUES ($1, $2, $3)
    `, [bottleId, userKey, content]);

    await client.query(`
      INSERT INTO bottle_visits (bottle_id, visitor_user_key, action)
      VALUES ($1, $2, 'commented')
    `, [bottleId, userKey]);

    const newCount = bottle.comment_count + 1;
    const hasReturned = newCount >= bottle.target_comment_count;

    await client.query(`
      UPDATE bottles
      SET comment_count = $1,
          status = $2,
          returned_at = CASE WHEN $3::boolean THEN now() ELSE returned_at END
      WHERE id = $4
    `, [newCount, hasReturned ? "returned" : "drifting", hasReturned, bottleId]);

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}



export async function getCollection(userKey: string): Promise<Collection> {
  const sentBottles = await query<Bottle>(`
    SELECT ${bottleFields}
    FROM bottles
    WHERE author_user_key = $1
    ORDER BY created_at DESC
  `, [userKey]);

  const receivedVisits = await query<BottleVisit & { bottle_content: string }>(`
    SELECT
      bottle_visits.id,
      bottle_visits.bottle_id,
      bottle_visits.visitor_user_key,
      bottle_visits.action,
      bottle_visits.visited_at::text AS visited_at,
      bottles.content AS bottle_content
    FROM bottle_visits
    JOIN bottles ON bottles.id = bottle_visits.bottle_id
    WHERE bottle_visits.visitor_user_key = $1
    ORDER BY bottle_visits.visited_at DESC
    LIMIT 30
  `, [userKey]);

  const writtenComments = await query<BottleComment & { bottle_content: string }>(`
    SELECT
      bottle_comments.id,
      bottle_comments.bottle_id,
      bottle_comments.commenter_user_key,
      bottle_comments.content,
      bottle_comments.created_at::text AS created_at,
      bottles.content AS bottle_content
    FROM bottle_comments
    JOIN bottles ON bottles.id = bottle_comments.bottle_id
    WHERE bottle_comments.commenter_user_key = $1
    ORDER BY bottle_comments.created_at DESC
  `, [userKey]);

  const returnedBase = await query<Bottle>(`
    SELECT ${bottleFields}
    FROM bottles
    WHERE author_user_key = $1 AND status = 'returned'
    ORDER BY returned_at DESC
  `, [userKey]);

  const returnedBottles = await Promise.all(
    returnedBase.map(async (bottle) => ({
      ...bottle,
      comments: await query<BottleComment>(`
        SELECT ${commentFields}
        FROM bottle_comments
        WHERE bottle_id = $1
        ORDER BY created_at ASC
      `, [bottle.id]),
    })),
  );

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
