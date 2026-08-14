export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  cookieName: "anonymous_user_key",
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true" || process.env.PGSSLMODE === "require",
  limits: {
    bottleContent: 360,
    commentContent: 180,
  },
};
