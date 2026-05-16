import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { appConfig } from "../config";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(appConfig.dbPath), { recursive: true });
    db = new Database(appConfig.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }

  return db;
}
