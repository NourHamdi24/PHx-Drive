const createTables = (db) => {
  db.pragma("foreign_keys = ON");

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      api_key TEXT NOT NULL,
      api_secret TEXT NOT NULL,
      frappe_url TEXT NOT NULL,
      root_folder_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sync state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entity_name TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      local_path TEXT,
      modified TEXT,
      file_size INTEGER,
      is_group INTEGER DEFAULT 0,
      parent_drive_entity TEXT,
      status TEXT DEFAULT 'synced',
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Sync queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entity_name TEXT,
      local_path TEXT,
      action TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      retries INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Trash table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trash (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entity_name TEXT NOT NULL,
      title TEXT NOT NULL,
      original_path TEXT,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      source TEXT DEFAULT 'local',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log("All tables created successfully");
};

module.exports = { createTables };
