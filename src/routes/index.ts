import { Router } from "express";
import { appConfig } from "../config";
import { addCommentToBottle, createBottle, findRandomDriftingBottle, getCollection } from "../services/bottleService";

export const router = Router();

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

router.get("/", (req, res) => {
  const bottle = findRandomDriftingBottle(req.anonymousUserKey);
  res.render("home", {
    title: "浜辺",
    bottle,
    errors: [],
    values: {},
    limits: appConfig.limits,
  });
});

router.post("/bottles", (req, res) => {
  const content = normalizeText(req.body.content);
  const errors: string[] = [];

  if (!content) {
    errors.push("メッセージを入力してください。");
  }

  if (content.length > appConfig.limits.bottleContent) {
    errors.push(`メッセージは${appConfig.limits.bottleContent}文字以内で入力してください。`);
  }

  if (errors.length > 0) {
    const bottle = findRandomDriftingBottle(req.anonymousUserKey);
    return res.status(400).render("home", {
      title: "浜辺",
      bottle,
      errors,
      values: { content },
      limits: appConfig.limits,
    });
  }

  createBottle(req.anonymousUserKey, content);
  return res.redirect("/collection?notice=sent");
});

router.post("/bottles/:id/comments", (req, res) => {
  const bottleId = Number(req.params.id);
  const content = normalizeText(req.body.content);
  const errors: string[] = [];

  if (!Number.isInteger(bottleId) || bottleId <= 0) {
    errors.push("ボトルの指定が正しくありません。");
  }

  if (!content) {
    errors.push("コメントを入力してください。");
  }

  if (content.length > appConfig.limits.commentContent) {
    errors.push(`コメントは${appConfig.limits.commentContent}文字以内で入力してください。`);
  }

  if (errors.length === 0) {
    const result = addCommentToBottle(bottleId, req.anonymousUserKey, content);
    if (!result.ok) {
      errors.push(result.message);
    }
  }

  if (errors.length > 0) {
    const bottle = findRandomDriftingBottle(req.anonymousUserKey);
    return res.status(400).render("home", {
      title: "浜辺",
      bottle,
      errors,
      values: { comment: content },
      limits: appConfig.limits,
    });
  }

  return res.redirect("/collection?notice=commented");
});

router.get("/collection", (req, res) => {
  res.render("collection", {
    title: "物置",
    collection: getCollection(req.anonymousUserKey),
    notice: req.query.notice,
  });
});

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
