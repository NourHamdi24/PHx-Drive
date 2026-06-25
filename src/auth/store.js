const { safeStorage, app } = require("electron");
const path = require("path");
const fs = require("fs");

// File where encrypted credentials are saved
const CREDS_PATH = path.join(app.getPath("userData"), "credentials.enc");

const saveCredentials = (email, password, frappUrl) => {
  const data = JSON.stringify({ email, password, frappUrl });
  const encrypted = safeStorage.encryptString(data);
  fs.writeFileSync(CREDS_PATH, encrypted);
  console.log("Credentials saved securely");
};

const loadCredentials = () => {
  if (!fs.existsSync(CREDS_PATH)) return null;

  const encrypted = fs.readFileSync(CREDS_PATH);
  const decrypted = safeStorage.decryptString(encrypted);
  return JSON.parse(decrypted);
};

const clearCredentials = () => {
  if (fs.existsSync(CREDS_PATH)) {
    fs.unlinkSync(CREDS_PATH);
    console.log("Credentials cleared");
  }
};

const hasCredentials = () => fs.existsSync(CREDS_PATH);

module.exports = {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  hasCredentials,
};
