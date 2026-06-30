const { safeStorage, app } = require("electron");
const path = require("path");
const fs = require("fs");

// Lazily resolved so app is ready before we ask for userData path
const getCredsPath = () =>
  path.join(app.getPath("userData"), "credentials.enc");

const saveCredentials = (email, password, frappUrl) => {
  const data = JSON.stringify({ email, password, frappUrl });
  const encrypted = safeStorage.encryptString(data);
  fs.writeFileSync(getCredsPath(), encrypted);
  console.log("Credentials saved securely");
};

const loadCredentials = () => {
  if (!fs.existsSync(getCredsPath())) return null;

  const encrypted = fs.readFileSync(getCredsPath());
  const decrypted = safeStorage.decryptString(encrypted);
  return JSON.parse(decrypted);
};

const clearCredentials = () => {
  if (fs.existsSync(getCredsPath())) {
    fs.unlinkSync(getCredsPath());
    console.log("Credentials cleared");
  }
};

const hasCredentials = () => fs.existsSync(getCredsPath());

module.exports = {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  hasCredentials,
};
