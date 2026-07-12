const { login, getLoggedUser, getHomeFolderId } = require("../sync/api");
const {
  saveCredentials,
  loadCredentials,
  clearCredentials,
} = require("./store");
const { getDatabase } = require("../db/database");

const FRAPPE_URL = "https://192.168.12.5";

const handleLogin = async (email, password) => {
  // Step 1 — Login to Frappe
  console.log("Logging in to Frappe...");
  const sessionCookie = await login(FRAPPE_URL, email, password);

  // Step 2 — Verify session
  const loggedUser = await getLoggedUser(FRAPPE_URL, sessionCookie);
  if (loggedUser !== email) throw new Error("Session verification failed");
  console.log("Session verified for:", loggedUser);

  // Step 3 — Get root folder ID
  const rootFolderId = await getHomeFolderId(FRAPPE_URL, sessionCookie);
  console.log("Root folder:", rootFolderId);

  // Step 4 — Save password encrypted via safeStorage
  saveCredentials(email, password, FRAPPE_URL);

  // Step 5 — Save user to SQLite
  const db = getDatabase();
  const existingUser = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  if (existingUser) {
    db.prepare(
      `
      UPDATE users SET session_cookie = ?, root_folder_id = ? WHERE email = ?
    `,
    ).run(sessionCookie, rootFolderId, email);
    console.log("Existing user updated");
  } else {
    db.prepare(
      `
      INSERT INTO users (email, frappe_url, session_cookie, root_folder_id)
      VALUES (?, ?, ?, ?)
    `,
    ).run(email, FRAPPE_URL, sessionCookie, rootFolderId);
    console.log("New user created");
  }

  return {
    success: true,
    email,
    sessionCookie,
    rootFolderId,
    needsSyncFolder: true,
  };
};

const handleAutoLogin = async () => {
  const db = getDatabase();
  const user = db.prepare("SELECT * FROM users LIMIT 1").get();

  if (!user) return { success: false, reason: "no_user" };

  // Try existing session first
  try {
    const loggedUser = await getLoggedUser(
      user.frappe_url,
      user.session_cookie,
    );
    if (loggedUser === user.email) {
      console.log("Auto login successful:", user.email);
      return { success: true, ...user };
    }
  } catch (err) {
    console.log("Session expired, re-logging in...");
  }

  // Session expired — re-login with stored credentials
  const creds = loadCredentials();
  if (!creds) return { success: false, reason: "no_credentials" };

  try {
    return await handleLogin(creds.email, creds.password);
  } catch (err) {
    return { success: false, reason: "relogin_failed" };
  }
};

const handleLogout = () => {
  const db = getDatabase();
  db.prepare(
    "DELETE FROM sync_state WHERE user_id = (SELECT id FROM users LIMIT 1)",
  ).run();
  db.prepare(
    "DELETE FROM sync_queue WHERE user_id = (SELECT id FROM users LIMIT 1)",
  ).run();
  db.prepare("DELETE FROM users").run();
  clearCredentials();
  return { success: true };
};

module.exports = { handleLogin, handleAutoLogin, handleLogout };
