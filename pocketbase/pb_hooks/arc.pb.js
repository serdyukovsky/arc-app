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
      return decodeURIComponent(String(value || ""));
    } catch (err) {
      return String(value || "");
    }
  }

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  var SHA256_INIT = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ];

  function utf8Bytes(text) {
    var str = String(text || "");
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var cp = str.codePointAt(i);
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
    var bytes = Array.isArray(messageBytes) ? messageBytes.slice() : [];
    var bitLen = bytes.length * 8;

    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0x00);

    var high = Math.floor(bitLen / 0x100000000);
    var low = bitLen >>> 0;
    bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
    bytes.push((low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

    var h = SHA256_INIT.slice();
    var w = new Array(64).fill(0);

    for (var offset = 0; offset < bytes.length; offset += 64) {
      for (var j = 0; j < 16; j++) {
        var idx = offset + j * 4;
        w[j] = (
          (bytes[idx] << 24) |
          (bytes[idx + 1] << 16) |
          (bytes[idx + 2] << 8) |
          bytes[idx + 3]
        ) >>> 0;
      }

      for (var n = 16; n < 64; n++) {
        var s0 = rightRotate(w[n - 15], 7) ^ rightRotate(w[n - 15], 18) ^ (w[n - 15] >>> 3);
        var s1 = rightRotate(w[n - 2], 17) ^ rightRotate(w[n - 2], 19) ^ (w[n - 2] >>> 10);
        w[n] = (w[n - 16] + s0 + w[n - 7] + s1) >>> 0;
      }

      var a = h[0];
      var b = h[1];
      var c = h[2];
      var d = h[3];
      var ee = h[4];
      var f = h[5];
      var g = h[6];
      var hh = h[7];

      for (var m = 0; m < 64; m++) {
        var sig1 = rightRotate(ee, 6) ^ rightRotate(ee, 11) ^ rightRotate(ee, 25);
        var ch = (ee & f) ^ (~ee & g);
        var temp1 = (hh + sig1 + ch + SHA256_K[m] + w[m]) >>> 0;
        var sig0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (sig0 + maj) >>> 0;

        hh = g;
        g = f;
        f = ee;
        ee = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h[0] = (h[0] + a) >>> 0;
      h[1] = (h[1] + b) >>> 0;
      h[2] = (h[2] + c) >>> 0;
      h[3] = (h[3] + d) >>> 0;
      h[4] = (h[4] + ee) >>> 0;
      h[5] = (h[5] + f) >>> 0;
      h[6] = (h[6] + g) >>> 0;
      h[7] = (h[7] + hh) >>> 0;
    }

    var out = [];
    for (var t = 0; t < h.length; t++) {
      out.push((h[t] >>> 24) & 0xff);
      out.push((h[t] >>> 16) & 0xff);
      out.push((h[t] >>> 8) & 0xff);
      out.push(h[t] & 0xff);
    }
    return out;
  }

  function hmacSha256Bytes(messageBytes, keyBytes) {
    var key = Array.isArray(keyBytes) ? keyBytes.slice() : [];
    var message = Array.isArray(messageBytes) ? messageBytes : [];
    if (key.length > 64) key = sha256Bytes(key);
    if (key.length < 64) key = key.concat(new Array(64 - key.length).fill(0));

    var oPad = key.map(function(b) { return b ^ 0x5c; });
    var iPad = key.map(function(b) { return b ^ 0x36; });
    var inner = sha256Bytes(iPad.concat(message));
    return sha256Bytes(oPad.concat(inner));
  }

  function bytesToHex(bytes) {
    return bytes.map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function timingSafeEqualStrings(left, right) {
    var a = String(left || "");
    var b = String(right || "");
    if (a.length !== b.length) return false;
    var mismatch = 0;
    for (var i2 = 0; i2 < a.length; i2++) {
      mismatch |= (a.charCodeAt(i2) ^ b.charCodeAt(i2));
    }
    return mismatch === 0;
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
    if (k === "hash") {
      hash = v;
    } else if (k !== "signature") {
      // Telegram may include "signature" (third-party validation field).
      // It must be excluded from data_check_string for bot-token hash validation.
      fields[k] = v;
    }
  });

  if (!hash) return errorJson(401, "Invalid Telegram initData: missing hash");

  var checkString = Object.keys(fields)
    .sort()
    .map(function(k) { return k + "=" + fields[k]; })
    .join("\n");

  // Telegram check:
  // secret = HMAC_SHA256(bot_token, "WebAppData")
  // hash   = HMAC_SHA256(data_check_string, secret)
  var secret = hmacSha256Bytes(utf8Bytes(botToken), utf8Bytes("WebAppData"));
  var actualHash = bytesToHex(hmacSha256Bytes(utf8Bytes(checkString), secret)).toLowerCase();
  var expectedHash = String(hash || "").toLowerCase();

  if (!timingSafeEqualStrings(actualHash, expectedHash)) {
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
