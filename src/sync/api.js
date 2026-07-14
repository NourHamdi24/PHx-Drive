const axios = require("axios");
const https = require("https");

// Ignore self-signed certificate on our Frappe instance
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Base axios instance — all requests go through this
const createClient = (frappUrl, sessionCookie) => {
  return axios.create({
    baseURL: frappUrl,
    httpsAgent,
    headers: {
      Cookie: `sid=${sessionCookie}`,
      "Content-Type": "application/json",
    },
  });
};

// ─── Auth ──────────────────────────────────────────────────────

const login = async (frappUrl, email, password) => {
  const response = await axios.post(
    `${frappUrl}/api/method/login`,
    { usr: email, pwd: password },
    {
      httpsAgent,
      withCredentials: true,
    },
  );

  // Extract session cookie from response headers
  const cookies = response.headers["set-cookie"];
  if (!cookies) throw new Error("No session cookie returned");

  const sidCookie = cookies.find((c) => c.startsWith("sid="));
  if (!sidCookie) throw new Error("No sid cookie found");

  // Extract just the sid value
  const sid = sidCookie.split(";")[0].split("=")[1];
  return sid;
};

const getLoggedUser = async (frappUrl, sessionCookie) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.get("/api/method/frappe.auth.get_logged_user");
  return response.data.message;
};

const getUserProfile = async (frappUrl, sessionCookie, email) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.get("/api/method/frappe.client.get", {
    params: { doctype: "User", name: email },
  });
  const { full_name, username, user_image, time_zone, language, country } = response.data.message;

  let image = null;
  if (user_image) {
    const imageUrl = user_image.startsWith("http") ? user_image : `${frappUrl}${user_image}`;
    const imageResponse = await client.get(imageUrl, { responseType: "arraybuffer" });
    const contentType = imageResponse.headers["content-type"] || "image/png";
    image = `data:${contentType};base64,${Buffer.from(imageResponse.data).toString("base64")}`;
  }

  return { full_name, username, image, time_zone, language, country };
};

const getUserRank = async (frappUrl, sessionCookie, email) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.post(
    "/api/method/frappe.desk.page.user_profile.user_profile.get_user_rank",
    { user: email },
  );
  return response.data.message;
};

const getEnergyPoints = async (frappUrl, sessionCookie, email, start = 0, limit = 20) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.post(
    "/api/method/frappe.desk.page.user_profile.user_profile.get_energy_points_list",
    { start, limit, user: email },
  );
  return response.data.message;
};

// ─── Files ─────────────────────────────────────────────────────

const listFiles = async (frappUrl, sessionCookie, folderId, isActive = 1) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.get("/api/method/drive.api.list.files", {
    params: {
      entity_name: folderId,
      is_active: isActive,
      limit: 60,
      folders_first: true,
      favourites_only: false,
      recents_only: false,
      file_kind_list: "[]",
      tag_list: "[]",
    },
  });
  return response.data.message;
};

const downloadFile = async (frappUrl, sessionCookie, entityName, destPath) => {
  const client = createClient(frappUrl, sessionCookie);
  const fs = require("fs");

  const response = await client.get(
    "/api/method/drive.api.files.get_file_content",
    {
      params: {
        entity_name: entityName,
        trigger_download: 1,
      },
      responseType: "stream",
    },
  );

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const uploadFile = async (
  frappUrl,
  sessionCookie,
  filePath,
  fileName,
  parentId,
) => {
  const FormData = require("form-data");
  const fs = require("fs");

  const client = createClient(frappUrl, sessionCookie);
  const stat = fs.statSync(filePath);
  const form = new FormData();

  const crypto = require("crypto");
  form.append("uuid", crypto.randomUUID());
  form.append("chunk_index", "0");
  form.append("total_file_size", stat.size.toString());
  form.append("chunk_size", "20971520");
  form.append("total_chunk_count", "1");
  form.append("chunk_byte_offset", "0");
  form.append("last_modified", parseInt(stat.mtimeMs).toString());

  form.append("parent", parentId);
  form.append("file", fs.createReadStream(filePath), fileName);

  const response = await client.post(
    "/api/method/drive.api.files.upload_file",
    form,
    { headers: { ...form.getHeaders() } },
  );

  return response.data.message;
};

const createFolder = async (frappUrl, sessionCookie, title, parentId) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.post(
    "/api/method/drive.api.files.create_folder",
    {
      title,
      parent: parentId,
    },
  );
  return response.data.message;
};

// ─── Delete ────────────────────────────────────────────────────

const permanentDelete = async (frappUrl, sessionCookie, entityNames) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.post(
    "/api/method/drive.api.files.delete_entities",
    {
      entity_names: JSON.stringify(entityNames),
    },
  );
  return response.data;
};

// ─── Storage ───────────────────────────────────────────────────

const getTotalStorageUsed = async (frappUrl, sessionCookie) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.get(
    "/api/method/drive.api.storage.total_storage_used",
  );
  return response.data.message[0].total_size;
};

// ─── Home Folder ───────────────────────────────────────────────

const getHomeFolderId = async (frappUrl, sessionCookie) => {
  const client = createClient(frappUrl, sessionCookie);
  const response = await client.get(
    "/api/method/drive.api.files.get_home_folder_id",
  );
  return response.data.message;
};

// ─── Share ─────────────────────────────────────────────────────

const getShareLink = (frappUrl, entityName) => {
  return `${frappUrl}/drive/file/${entityName}`;
};

module.exports = {
  login,
  getLoggedUser,
  getUserProfile,
  getUserRank,
  getEnergyPoints,
  listFiles,
  downloadFile,
  uploadFile,
  createFolder,
  permanentDelete,
  getTotalStorageUsed,
  getHomeFolderId,
  getShareLink,
};
