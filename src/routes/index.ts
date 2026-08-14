/**
 * Bottled Word メインルート
 *
 * この層では：
 * - requestの受け取り
 * - validation
 * - response生成
 * を担当する。
 *
 * DB操作や業務ロジックは service 層へ委譲する。
 */



import { Router, type NextFunction, type Request, type Response } from "express";
import { appConfig } from "../config";
import { addCommentToBottle, createBottle, findRandomDriftingBottle, getCollection } from "../services/bottleService";

export const router = Router();

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(handler: AsyncRouteHandler): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/**
 * フォーム入力を安全に文字列化する。
 * undefined や非文字列入力は空文字へ正規化する。
 */
function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}



router.get("/", asyncRoute(async (req, res) => {
  const bottle = await findRandomDriftingBottle(req.anonymousUserKey);
  res.render("home", {
    title: "浜辺",
    bottle,
    errors: [],
    values: {},
    limits: appConfig.limits,
  });
}));



router.post("/bottles", asyncRoute(async (req, res) => {
  const bottleContent = normalizeText(req.body.content);
  const errors: string[] = [];

  if (!bottleContent) {
    errors.push("メッセージを入力してください。");
  }

  if (bottleContent.length > appConfig.limits.bottleContent) {
    errors.push(`メッセージは${appConfig.limits.bottleContent}文字以内で入力してください。`);
  }

  if (errors.length > 0) {
    const bottle = await findRandomDriftingBottle(req.anonymousUserKey);
    res.status(400).render("home", {
      title: "浜辺",
      bottle,
      errors,
      // エラー時の入力内容保持
      values: { bottleContent },
      limits: appConfig.limits,
    });
    return;
  }

  await createBottle(req.anonymousUserKey, bottleContent);
  res.redirect("/collection?notice=sent");
}));



router.post("/bottles/:id/comments", asyncRoute(async (req, res) => {
  const bottleId = Number(req.params.id);
  const commentContent = normalizeText(req.body.content);
  const errors: string[] = [];

  if (!Number.isInteger(bottleId) || bottleId <= 0) {
    errors.push("ボトルの指定が正しくありません。");
  }

  if (!commentContent) {
    errors.push("コメントを入力してください。");
  }

  if (commentContent.length > appConfig.limits.commentContent) {
    errors.push(`コメントは${appConfig.limits.commentContent}文字以内で入力してください。`);
  }

  if (errors.length === 0) {
    const result = await addCommentToBottle(bottleId, req.anonymousUserKey, commentContent);
    if (!result.ok) {
      errors.push(result.message);
    }
  }

  if (errors.length > 0) {
    const bottle = await findRandomDriftingBottle(req.anonymousUserKey);
    res.status(400).render("home", {
      title: "浜辺",
      bottle,
      errors,
      // エラー時の入力内容保持
      values: { commentContent },
      limits: appConfig.limits,
    });
    return;
  }

  res.redirect("/collection?notice=commented");
}));



router.get("/collection", asyncRoute(async (req, res) => {
  res.render("collection", {
    title: "物置",
    collection: await getCollection(req.anonymousUserKey),
    notice: req.query.notice,
  });
}));



router.get("/settings", (req, res) => {
  res.render("settings", {
    title: "オプション",
    currentTheme: res.locals.theme,
    currentFontSize: res.locals.fontSize,
    saved: req.query.saved,
  });
});

router.post("/settings", (req, res) => {
  const theme = req.body.theme === "night" ? "night" : "day";
  const fontSize = req.body.fontSize === "large" ? "large" : "normal";

  res.cookie("theme", theme, { sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 365 });
  res.cookie("font_size", fontSize, { sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 365 });
  res.redirect("/settings?saved=1");
});
