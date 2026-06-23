const path = require("path");
const fs = require("fs");
const {
  login,
  getLoggedUser,
  listFiles,
  downloadFile,
  uploadFile,
  createFolder,
  trashOrRestore,
  permanentDelete,
  listTrashedFiles,
  getTotalStorageUsed,
  getHomeFolderId,
  getShareLink,
} = require("./src/sync/api");

const FRAPPE_URL = "https://192.168.12.5";
const EMAIL = "nour24hamdi@gmail.com";
const PASSWORD = "Welcome@2026";
const ROOT_FOLDER = "643fe16af7fbb484861849f40f819b7a";
const TEST_FILE_ID = "efe83aa2878d405184395c0492aca941";

// Helper to log results cleanly
const pass = (name, result) => console.log(`✅ ${name}:`, result);
const fail = (name, err) => console.error(`❌ ${name}:`, err.message);

async function runTests() {
  let cookie;
  let createdFolderId;
  let uploadedFileId;
  let testFilePath = "./test-upload.txt";

  // Create a dummy file to upload
  fs.writeFileSync(testFilePath, "PHx Drive test file content");

  // ─── 1. Login ──────────────────────────────────────────
  console.log("\n--- Auth ---");
  try {
    cookie = await login(FRAPPE_URL, EMAIL, PASSWORD);
    pass("login", cookie);
  } catch (err) {
    fail("login", err);
    return; // Can't continue without a cookie
  }

  // ─── 2. Get Logged User ────────────────────────────────
  try {
    const user = await getLoggedUser(FRAPPE_URL, cookie);
    pass("getLoggedUser", user);
  } catch (err) {
    fail("getLoggedUser", err);
  }

  // ─── 3. Get Home Folder ID ─────────────────────────────
  console.log("\n--- Folders ---");
  try {
    const homeFolder = await getHomeFolderId(FRAPPE_URL, cookie);
    pass("getHomeFolderId", homeFolder);
  } catch (err) {
    fail("getHomeFolderId", err);
  }

  // ─── 4. List Files ─────────────────────────────────────
  try {
    const files = await listFiles(FRAPPE_URL, cookie, ROOT_FOLDER);
    pass("listFiles", `${files.length} items found`);
  } catch (err) {
    fail("listFiles", err);
  }

  // ─── 5. Create Folder ──────────────────────────────────
  try {
    const folder = await createFolder(
      FRAPPE_URL,
      cookie,
      "PHx-Test-Folder",
      ROOT_FOLDER,
    );
    createdFolderId = folder.name;
    pass("createFolder", `created with id: ${createdFolderId}`);
  } catch (err) {
    fail("createFolder", err);
  }

  // ─── 6. Upload File ────────────────────────────────────
  console.log("\n--- Files ---");
  try {
    const uploaded = await uploadFile(
      FRAPPE_URL,
      cookie,
      testFilePath,
      "test-upload.txt",
      ROOT_FOLDER,
    );
    uploadedFileId = uploaded.name;
    pass("uploadFile", `uploaded with id: ${uploadedFileId}`);
  } catch (err) {
    fail("uploadFile", err);
    console.log("Full error response:", err.response?.data);
  }

  // ─── 7. Download File ──────────────────────────────────
  try {
    await downloadFile(
      FRAPPE_URL,
      cookie,
      TEST_FILE_ID,
      "./test-download.docx",
    );
    pass("downloadFile", "saved to test-download.docx");
  } catch (err) {
    fail("downloadFile", err);
  }

  // ─── 8. Get Share Link ─────────────────────────────────
  try {
    const link = getShareLink(FRAPPE_URL, TEST_FILE_ID);
    pass("getShareLink", link);
  } catch (err) {
    fail("getShareLink", err);
  }

  // ─── 9. Get Storage Used ───────────────────────────────
  console.log("\n--- Storage ---");
  try {
    const storage = await getTotalStorageUsed(FRAPPE_URL, cookie);
    pass("getTotalStorageUsed", `${storage} bytes`);
  } catch (err) {
    fail("getTotalStorageUsed", err);
  }

  // ─── 10. Trash File ────────────────────────────────────
  console.log("\n--- Trash ---");
  if (uploadedFileId) {
    try {
      await trashOrRestore(FRAPPE_URL, cookie, [uploadedFileId]);
      pass("trashOrRestore (trash)", `trashed ${uploadedFileId}`);
    } catch (err) {
      fail("trashOrRestore (trash)", err);
    }

    // ─── 11. List Trashed Files ──────────────────────────
    try {
      const trashed = await listTrashedFiles(FRAPPE_URL, cookie);
      pass("listTrashedFiles", `${trashed.length} items in trash`);
    } catch (err) {
      fail("listTrashedFiles", err);
    }

    // ─── 12. Restore File ────────────────────────────────
    try {
      await trashOrRestore(FRAPPE_URL, cookie, [uploadedFileId]);
      pass("trashOrRestore (restore)", `restored ${uploadedFileId}`);
    } catch (err) {
      fail("trashOrRestore (restore)", err);
    }

    // ─── 13. Permanent Delete ────────────────────────────
    try {
      // Trash it again before permanent delete
      await trashOrRestore(FRAPPE_URL, cookie, [uploadedFileId]);
      await permanentDelete(FRAPPE_URL, cookie, [uploadedFileId]);
      pass("permanentDelete", `permanently deleted ${uploadedFileId}`);
    } catch (err) {
      fail("permanentDelete", err);
    }
  }

  // ─── 14. Trash and Delete Test Folder ──────────────────
  if (createdFolderId) {
    try {
      await trashOrRestore(FRAPPE_URL, cookie, [createdFolderId]);
      await permanentDelete(FRAPPE_URL, cookie, [createdFolderId]);
      pass("cleanup folder", `deleted test folder ${createdFolderId}`);
    } catch (err) {
      fail("cleanup folder", err);
    }
  }

  // ─── Cleanup local files ───────────────────────────────
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
  if (fs.existsSync("./test-download.docx"))
    fs.unlinkSync("./test-download.docx");

  console.log("\n--- Done ---");
}

runTests().catch(console.error);
