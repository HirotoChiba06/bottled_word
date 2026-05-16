import "dotenv/config";
import path from "path";
import cookieParser from "cookie-parser";
import express from "express";
import { appConfig } from "./config";
import { initializeDatabase } from "./db/init";
import { anonymousUserMiddleware } from "./middleware/anonymousUser";
import { router } from "./routes";

initializeDatabase();

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));
app.use((req, res, next) => {
  res.locals.theme = req.cookies?.theme === "night" ? "night" : "day";
  res.locals.fontSize = req.cookies?.font_size === "large" ? "large" : "normal";
  next();
});
app.use(anonymousUserMiddleware);
app.use(router);

app.use((_req, res) => {
  res.status(404).render("not-found", { title: "見つかりません" });
});

app.listen(appConfig.port, () => {
  console.log(`Bottled Word is running on http://localhost:${appConfig.port}`);
});
