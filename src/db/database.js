const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");
const { createTables } = require("./schema");

let db;

function getDatabase() {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "phx-drive.db");
    console.log("Database path:", dbPath);

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma("journal_mode = WAL");

    // Create all tables if they don't exist
    createTables(db);
  }

  return db;
}

module.exports = { getDatabase };
