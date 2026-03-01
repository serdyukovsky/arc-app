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

function parseInitData(initData) {
  const fields = {};
  let hash = "";

  const pairs = String(initData || "").split("&");
  pairs.forEach((part) => {
    if (!part) return;
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const k = decodeURIComponent(part.slice(0, idx));
    const v = decodeURIComponent(part.slice(idx + 1));
    if (k === "hash") hash = v;
    else fields[k] = v;
  });

  return { fields, hash };
}

function verifyTelegramInitData(initData, botToken) {
  const parsed = parseInitData(initData);
  if (!parsed.hash) return { ok: false, reason: "missing hash" };

  const checkString = Object.keys(parsed.fields)
    .sort()
    .map((k) => `${k}=${parsed.fields[k]}`)
    .join("\n");

  // Telegram check:
  // secret = HMAC_SHA256("WebAppData", bot_token)
  // hash   = HMAC_SHA256(data_check_string, secret)
  const secret = $security.hs256("WebAppData", botToken);
  const actualHash = $security.hs256(checkString, secret).toLowerCase();
  const expectedHash = String(parsed.hash || "").toLowerCase();

  if (!$security.equal(actualHash, expectedHash)) {
    return { ok: false, reason: "hash mismatch" };
  }

  const authDate = parseInt(parsed.fields.auth_date || "0", 10);
  const nowTs = Math.floor(Date.now() / 1000);
  if (!authDate || nowTs - authDate > TELEGRAM_AUTH_TTL_SECONDS) {
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
    record.set("username", tgUser.username);
  }
  const fullName = [tgUser.first_name || "", tgUser.last_name || ""].join(" ").trim();
  if (fullName) record.set("name", fullName);

  $app.save(record);
  return record;
}

function findStateRecordByUserId(userId) {
  try {
    return $app.findFirstRecordByFilter("arc_state", "user = {:uid}", { uid: userId });
  } catch {
    return null;
  }
}

routerAdd("POST", "/api/arc/telegram-auth", (e) => {
  const body = new DynamicModel({ initData: "" });
  e.bindBody(body);

  const initData = String(body.initData || "").trim();
  if (!initData) throw new BadRequestError("initData is required");

  const botToken = $os.getenv("TELEGRAM_BOT_TOKEN");
  if (!botToken) throw new InternalServerError("TELEGRAM_BOT_TOKEN is not configured");

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok) throw new UnauthorizedError(`Invalid Telegram initData: ${verified.reason}`);

  const userRecord = findOrCreateTelegramUser(verified.user);
  return $apis.recordAuthResponse(e, userRecord, "telegram");
});

routerAdd("GET", "/api/arc/state", (e) => {
  const stateRecord = findStateRecordByUserId(e.auth.id);
  const state = stateRecord ? stateRecord.get("state") : null;
  return e.json(200, { state });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/arc/state", (e) => {
  const body = new DynamicModel({ state: "" });
  e.bindBody(body);

  const state = String(body.state || "");
  if (!state) throw new BadRequestError("state is required");

  const collection = $app.findCollectionByNameOrId("arc_state");
  let stateRecord = findStateRecordByUserId(e.auth.id);
  if (!stateRecord) stateRecord = new Record(collection);

  stateRecord.set("user", e.auth.id);
  stateRecord.set("state", state);
  $app.save(stateRecord);

  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));
