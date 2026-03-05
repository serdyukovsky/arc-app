/// <reference path="../pb_data/types.d.ts" />

// ARC Telegram Mini App hooks for PocketBase.
//
// PocketBase JS caveat:
// hook handlers run in isolated contexts, so keep required helpers
// inside each handler (or require modules inside handler scope).

routerAdd("POST", "/api/arc/telegram-auth", function(e) {
  function errorJson(status, message) {
    return e.json(status, {
      status: status,
      message: message,
      data: {},
    });
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(String(value || "").replace(/\+/g, "%20"));
    } catch (err) {
      return String(value || "");
    }
  }

  var body = new DynamicModel({ initData: "", init_data: "" });
  try {
    e.bindBody(body);
  } catch (err) {
    // ignore parse errors and validate below
  }

  var initData = String(body.initData || body.init_data || "").trim();
  if (!initData) return errorJson(400, "InitData is required.");

  var botToken = String($os.getenv("TELEGRAM_BOT_TOKEN") || "");
  if (!botToken) return errorJson(500, "TELEGRAM_BOT_TOKEN is not configured");

  var fields = {};
  var hash = "";
  initData.split("&").forEach(function(part) {
    if (!part) return;
    var idx = part.indexOf("=");
    if (idx < 0) return;
    var k = safeDecode(part.slice(0, idx));
    var v = safeDecode(part.slice(idx + 1));
    if (k === "hash") hash = v;
    else fields[k] = v;
  });

  if (!hash) return errorJson(401, "Invalid Telegram initData: missing hash");

  var checkString = Object.keys(fields)
    .sort()
    .map(function(k) { return k + "=" + fields[k]; })
    .join("\n");

  // Telegram check:
  // secret = HMAC_SHA256("WebAppData", bot_token)
  // hash   = HMAC_SHA256(data_check_string, secret)
  var secret = $security.hs256("WebAppData", botToken);
  var actualHash = String($security.hs256(checkString, secret) || "").toLowerCase();
  var expectedHash = String(hash || "").toLowerCase();

  if (!$security.equal(actualHash, expectedHash)) {
    return errorJson(401, "Invalid Telegram initData: hash mismatch");
  }

  var authDate = parseInt(String(fields.auth_date || "0"), 10);
  var nowTs = Math.floor(Date.now() / 1000);
  if (!authDate || nowTs - authDate > 24 * 60 * 60 || authDate - nowTs > 60) {
    return errorJson(401, "Invalid Telegram initData: auth_date expired");
  }

  var tgUser = null;
  try {
    tgUser = JSON.parse(String(fields.user || "{}"));
  } catch (err) {
    return errorJson(401, "Invalid Telegram initData: bad user payload");
  }

  if (!tgUser || !tgUser.id) {
    return errorJson(401, "Invalid Telegram initData: missing user id");
  }

  var email = "tg_" + String(tgUser.id) + "@telegram.arc.local";
  var userRecord = null;

  try {
    userRecord = $app.findAuthRecordByEmail("users", email);
  } catch (err) {
    // create below
  }

  if (!userRecord) {
    var users = $app.findCollectionByNameOrId("users");
    var password = $security.randomString(40);
    userRecord = new Record(users);

    userRecord.set("email", email);
    userRecord.set("password", password);
    userRecord.set("passwordConfirm", password);
    userRecord.set("verified", true);

    if (typeof tgUser.username === "string" && tgUser.username.length > 0) {
      var username = tgUser.username.toLowerCase();
      try {
        userRecord.setIfFieldExists("username", username);
      } catch (err) {
        try {
          userRecord.set("username", username);
        } catch (err2) {
          // ignore optional field write errors
        }
      }
    }

    var fullName = (String(tgUser.first_name || "") + " " + String(tgUser.last_name || "")).trim();
    if (fullName) {
      try {
        userRecord.setIfFieldExists("name", fullName);
      } catch (err) {
        try {
          userRecord.set("name", fullName);
        } catch (err2) {
          // ignore optional field write errors
        }
      }
    }

    try {
      $app.save(userRecord);
    } catch (err) {
      // race on same email
      userRecord = $app.findAuthRecordByEmail("users", email);
    }
  }

  return $apis.recordAuthResponse(e, userRecord, "telegram");
});

routerAdd("GET", "/api/arc/state", function(e) {
  var stateRecord = null;
  try {
    stateRecord = $app.findFirstRecordByFilter("arc_state", "user = {:uid}", { uid: e.auth.id });
  } catch (err) {
    // no state yet
  }

  var rawState = stateRecord ? stateRecord.get("state") : null;
  var state = null;

  if (rawState !== null && typeof rawState !== "undefined") {
    if (typeof rawState === "string") {
      state = rawState;
    } else {
      try {
        state = JSON.stringify(rawState);
      } catch (err) {
        state = "";
      }
    }
  }

  return e.json(200, { state: state });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/arc/state", function(e) {
  function errorJson(status, message) {
    return e.json(status, {
      status: status,
      message: message,
      data: {},
    });
  }

  var body = new DynamicModel({ state: "" });
  try {
    e.bindBody(body);
  } catch (err) {
    // handled by validation below
  }

  var rawState = body.state;
  var state = "";
  if (typeof rawState === "string") {
    state = rawState;
  } else if (rawState !== null && typeof rawState !== "undefined") {
    try {
      state = JSON.stringify(rawState);
    } catch (err) {
      state = "";
    }
  }

  if (!state) return errorJson(400, "state is required");

  var collection = $app.findCollectionByNameOrId("arc_state");
  var stateRecord = null;
  try {
    stateRecord = $app.findFirstRecordByFilter("arc_state", "user = {:uid}", { uid: e.auth.id });
  } catch (err) {
    // create below
  }

  if (!stateRecord) stateRecord = new Record(collection);

  stateRecord.set("user", e.auth.id);
  stateRecord.set("state", state);
  $app.save(stateRecord);

  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));
