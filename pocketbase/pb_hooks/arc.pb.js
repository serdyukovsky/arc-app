/// <reference path="../pb_data/types.d.ts" />

// ARC Telegram Mini App hooks for PocketBase.
//
// Required setup:
// 1) Set env var TELEGRAM_BOT_TOKEN in PocketBase runtime.
// 2) Ensure there is an auth collection named "users".
// 3) Create a base collection "arc_state" with fields:
//    - user  (relation -> users, required, unique)
//    - state (json or text, required)
//
// Endpoints provided:
// - POST /api/arc/telegram-auth  { initData }
// - GET  /api/arc/state          (auth required)
// - POST /api/arc/state          (auth required) { state }

const TELEGRAM_AUTH_TTL_SECONDS = 24 * 60 * 60;
const TELEGRAM_AUTH_CLOCK_SKEW_SECONDS = 60;
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const SHA256_INIT = [
  0x6a09e667,
  0xbb67ae85,
  0x3c6ef372,
  0xa54ff53a,
  0x510e527f,
  0x9b05688c,
  0x1f83d9ab,
  0x5be0cd19,
];

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || "").replace(/\+/g, "%20"));
  } catch {
    return String(value || "");
  }
}

function parseInitData(initData) {
  const fields = {};
  let hash = "";

  const pairs = String(initData || "").split("&");
  pairs.forEach((part) => {
    if (!part) return;
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const k = safeDecode(part.slice(0, idx));
    const v = safeDecode(part.slice(idx + 1));
    if (k === "hash") hash = v;
    else fields[k] = v;
  });

  return { fields, hash };
}

function extractInitDataFromRequest(e) {
  const body = new DynamicModel({ initData: "", init_data: "" });
  try {
    e.bindBody(body);
  } catch {
    // ignore bind errors, fallback below
  }
  const fromBody = String(body.initData || body.init_data || "").trim();
  if (fromBody) return fromBody;
  return "";
}

function utf8Bytes(text) {
  const str = String(text || "");
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.codePointAt(i);
    if (cp > 0xffff) i++;
    if (cp <= 0x7f) {
      bytes.push(cp);
    } else if (cp <= 0x7ff) {
      bytes.push(0xc0 | (cp >> 6));
      bytes.push(0x80 | (cp & 0x3f));
    } else if (cp <= 0xffff) {
      bytes.push(0xe0 | (cp >> 12));
      bytes.push(0x80 | ((cp >> 6) & 0x3f));
      bytes.push(0x80 | (cp & 0x3f));
    } else {
      bytes.push(0xf0 | (cp >> 18));
      bytes.push(0x80 | ((cp >> 12) & 0x3f));
      bytes.push(0x80 | ((cp >> 6) & 0x3f));
      bytes.push(0x80 | (cp & 0x3f));
    }
  }
  return bytes;
}

function rightRotate(word, bits) {
  return (word >>> bits) | (word << (32 - bits));
}

function sha256Bytes(messageBytes) {
  const bytes = Array.isArray(messageBytes) ? messageBytes.slice() : [];
  const bitLen = bytes.length * 8;

  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0x00);

  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  const h = SHA256_INIT.slice();
  const w = new Array(64).fill(0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = (
        (bytes[j] << 24) |
        (bytes[j + 1] << 16) |
        (bytes[j + 2] << 8) |
        bytes[j + 3]
      ) >>> 0;
    }

    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = [];
  for (let i = 0; i < h.length; i++) {
    out.push((h[i] >>> 24) & 0xff);
    out.push((h[i] >>> 16) & 0xff);
    out.push((h[i] >>> 8) & 0xff);
    out.push(h[i] & 0xff);
  }
  return out;
}

function hmacSha256Bytes(messageBytes, keyBytes) {
  let key = Array.isArray(keyBytes) ? keyBytes.slice() : [];
  const message = Array.isArray(messageBytes) ? messageBytes : [];
  if (key.length > 64) key = sha256Bytes(key);
  if (key.length < 64) key = key.concat(new Array(64 - key.length).fill(0));

  const oPad = key.map((b) => b ^ 0x5c);
  const iPad = key.map((b) => b ^ 0x36);
  const inner = sha256Bytes(iPad.concat(message));
  return sha256Bytes(oPad.concat(inner));
}

function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualStrings(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return mismatch === 0;
}

function verifyTelegramInitData(initData, botToken) {
  const parsed = parseInitData(initData);
  if (!parsed.hash) return { ok: false, reason: "missing hash" };

  const checkString = Object.keys(parsed.fields)
    .sort()
    .map((k) => `${k}=${parsed.fields[k]}`)
    .join("\n");

  // Telegram check:
  // secret = HMAC_SHA256(bot_token, "WebAppData")
  // hash   = HMAC_SHA256(data_check_string, secret)
  const secret = hmacSha256Bytes(utf8Bytes(botToken), utf8Bytes("WebAppData"));
  const actualHash = bytesToHex(hmacSha256Bytes(utf8Bytes(checkString), secret)).toLowerCase();
  const expectedHash = String(parsed.hash || "").toLowerCase();

  if (!timingSafeEqualStrings(actualHash, expectedHash)) {
    return { ok: false, reason: "hash mismatch" };
  }

  const authDate = parseInt(parsed.fields.auth_date || "0", 10);
  const nowTs = Math.floor(Date.now() / 1000);
  if (
    !authDate ||
    nowTs - authDate > TELEGRAM_AUTH_TTL_SECONDS ||
    authDate - nowTs > TELEGRAM_AUTH_CLOCK_SKEW_SECONDS
  ) {
    return { ok: false, reason: "auth_date expired" };
  }

  let user = null;
  try {
    user = JSON.parse(parsed.fields.user || "{}");
  } catch {
    return { ok: false, reason: "bad user payload" };
  }

  if (!user?.id) return { ok: false, reason: "missing user id" };
  return { ok: true, user };
}

function findOrCreateTelegramUser(tgUser) {
  const telegramId = String(tgUser.id);
  const email = `tg_${telegramId}@telegram.arc.local`;

  try {
    return $app.findAuthRecordByEmail("users", email);
  } catch {
    // create below
  }

  const users = $app.findCollectionByNameOrId("users");
  const password = $security.randomString(40);
  const record = new Record(users);

  record.set("email", email);
  record.set("password", password);
  record.set("passwordConfirm", password);
  record.set("verified", true);

  // Optional profile fields (if present in your auth collection).
  if (typeof tgUser.username === "string" && tgUser.username.length > 0) {
    try {
      record.setIfFieldExists("username", tgUser.username.toLowerCase());
    } catch {
      try {
        record.set("username", tgUser.username.toLowerCase());
      } catch {
        // ignore optional field write errors
      }
    }
  }
  const fullName = [tgUser.first_name || "", tgUser.last_name || ""].join(" ").trim();
  if (fullName) {
    try {
      record.setIfFieldExists("name", fullName);
    } catch {
      try {
        record.set("name", fullName);
      } catch {
        // ignore optional field write errors
      }
    }
  }

  try {
    $app.save(record);
  } catch {
    // Parallel requests can race on the same tg email. Try read-after-fail first.
    return $app.findAuthRecordByEmail("users", email);
  }
  return record;
}

function findStateRecordByUserId(userId) {
  try {
    return $app.findFirstRecordByFilter("arc_state", "user = {:uid}", { uid: userId });
  } catch {
    return null;
  }
}

function serializeStateValue(rawState) {
  if (typeof rawState === "string") return rawState;
  if (rawState === null || typeof rawState === "undefined") return "";
  try {
    return JSON.stringify(rawState);
  } catch {
    return "";
  }
}

routerAdd("POST", "/api/arc/telegram-auth", (e) => {
  const initData = extractInitDataFromRequest(e);
  if (!initData) throw new BadRequestError("InitData is required.");

  const botToken = $os.getenv("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    return e.json(500, {
      status: 500,
      message: "TELEGRAM_BOT_TOKEN is not configured",
      data: {},
    });
  }

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok) {
    return e.json(401, {
      status: 401,
      message: `Invalid Telegram initData: ${verified.reason}`,
      data: {},
    });
  }

  const userRecord = findOrCreateTelegramUser(verified.user);
  return $apis.recordAuthResponse(e, userRecord, "telegram");
});

routerAdd("GET", "/api/arc/state", (e) => {
  const stateRecord = findStateRecordByUserId(e.auth.id);
  const rawState = stateRecord ? stateRecord.get("state") : null;
  const state = rawState === null || typeof rawState === "undefined"
    ? null
    : serializeStateValue(rawState);
  return e.json(200, { state });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/arc/state", (e) => {
  const body = new DynamicModel({ state: "" });
  e.bindBody(body);

  const state = serializeStateValue(body.state);
  if (!state) throw new BadRequestError("state is required");

  const collection = $app.findCollectionByNameOrId("arc_state");
  let stateRecord = findStateRecordByUserId(e.auth.id);
  if (!stateRecord) stateRecord = new Record(collection);

  stateRecord.set("user", e.auth.id);
  stateRecord.set("state", state);
  $app.save(stateRecord);

  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));
