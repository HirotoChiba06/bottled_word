import path from "path";

export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  cookieName: "anonymous_user_key",
  dbPath: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "bottled_word.sqlite"),
  limits: {
    bottleContent: 360,
    commentContent: 180,
  },
};
