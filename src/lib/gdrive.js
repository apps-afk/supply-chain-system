/**
 * Google Drive integration — uploads files to the shared "Supply Chain" drive
 * organized by category (subfolders).
 *
 * Requires two env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — full JSON of the service account key
 *   GOOGLE_DRIVE_PARENT_FOLDER_ID — ID of the parent folder in Shared Drive
 *
 * The service account email must be added as Content Manager on the parent
 * folder. Since it's a Shared Drive, supportsAllDrives:true is required on
 * every API call.
 */
import { google } from 'googleapis';
import { Readable } from 'stream';

export const isGDriveConfigured = !!(
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
  process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
);

let _client = null;
let _folderCache = {};   // category-label → folder-id (avoid repeated lookups)
let _folderInflight = {}; // category-label → in-flight Promise (de-duplicates concurrent creates)

function getClient() {
  if (_client) return _client;
  if (!isGDriveConfigured) throw new Error('ยังไม่ได้ตั้งค่า Google Drive — ต้องการ env vars GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_PARENT_FOLDER_ID');

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  });
  _client = google.drive({ version: 'v3', auth });
  return _client;
}

const PARENT_ID = () => process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

// Categories — each becomes a subfolder under the Supply Chain root.
// Add/edit here whenever a new attachment type is needed.
export const CATEGORIES = {
  rfq_quote:        'ใบเสนอราคา (RFQ Quotes)',
  contract:         'สัญญา (Contracts)',
  compare_report:   'รายงานเปรียบเทียบ (Compare Reports)',
  supplier_doc:     'เอกสารผู้ขาย (Supplier KYC)',
  price_reference:  'อ้างอิงราคา (Price References)',
};

async function findOrCreateSubfolder(label) {
  if (_folderCache[label]) return _folderCache[label];
  // De-duplicate concurrent lookups for the same label — without this, two
  // simultaneous uploads under a brand-new category would each create their
  // own subfolder and split files across duplicates.
  if (_folderInflight[label]) return _folderInflight[label];

  _folderInflight[label] = (async () => {
    const drive = getClient();
    const parent = PARENT_ID();

    // Escape Drive query special chars (' and \) to keep the q-filter safe
    // even if labels are renamed later.
    const safe = label.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = `name = '${safe}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await drive.files.list({
      q, fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
    });

    if (list.data.files?.length) {
      _folderCache[label] = list.data.files[0].id;
      return _folderCache[label];
    }

    // Not found — create it
    const created = await drive.files.create({
      requestBody: {
        name: label,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent],
      },
      fields: 'id, name',
      supportsAllDrives: true,
    });
    _folderCache[label] = created.data.id;
    return _folderCache[label];
  })().finally(() => { delete _folderInflight[label]; });

  return _folderInflight[label];
}

/**
 * Upload a file to Drive under the given category subfolder.
 * @param {object} args
 * @param {string} args.categoryKey  one of Object.keys(CATEGORIES)
 * @param {string} args.filename     desired filename in Drive
 * @param {string} args.mimeType     e.g. 'application/pdf'
 * @param {Readable|Buffer} args.body  the file contents (Buffer or stream)
 * @param {string} [args.entityRef]  e.g. 'RFQ-2025-001' — prefixed onto filename
 * @returns {Promise<{id, name, webViewLink, webContentLink}>}
 */
export async function uploadToCategory({ categoryKey, filename, mimeType, body, entityRef }) {
  const label = CATEGORIES[categoryKey];
  if (!label) throw new Error(`หมวดหมู่ไม่ถูกต้อง: ${categoryKey}`);

  const drive = getClient();

  const safeFilename = (entityRef ? `${entityRef}_` : '') +
                       `${Date.now()}_${filename}`.replace(/[\/\\?%*:|"<>]/g, '_');

  const attempt = async () => {
    const folderId = await findOrCreateSubfolder(label);
    // Buffer → stream per attempt — a Readable can't be replayed once
    // consumed by a failed create call.
    const stream = Buffer.isBuffer(body) ? Readable.from(body) : body;
    return drive.files.create({
      requestBody: {
        name: safeFilename,
        parents: [folderId],
      },
      media: { mimeType, body: stream },
      fields: 'id, name, webViewLink, webContentLink, size, parents',
      supportsAllDrives: true,
    });
  };

  try {
    const res = await attempt();
    return res.data;
  } catch (e) {
    // If the cached subfolder was deleted in Drive, the create 404s forever
    // until redeploy — evict the cache entry and retry once with a fresh
    // (re-created) folder. Only Buffers can be retried safely.
    const status = e?.code ?? e?.response?.status;
    if (status === 404 && Buffer.isBuffer(body)) {
      delete _folderCache[label];
      try {
        const res = await attempt();
        return res.data;
      } catch (e2) { e = e2; }
    }
    // Surface Google's actual error (rate-limit, permission, etc.) instead of
    // a generic "upload failed" — the upload route returns this back to the UI
    const detail = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e.message;
    const err = new Error(`Drive upload failed: ${detail}`);
    err.cause = e;
    throw err;
  }
}

/**
 * Delete a file by Drive file ID.
 */
export async function deleteFile(fileId) {
  const drive = getClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
  return true;
}

/**
 * Generate a fresh viewable URL (links don't expire but this confirms access).
 */
export async function getFile(fileId) {
  const drive = getClient();
  const res = await drive.files.get({
    fileId,
    fields: 'id, name, webViewLink, mimeType, size, createdTime',
    supportsAllDrives: true,
  });
  return res.data;
}
