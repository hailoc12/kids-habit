#!/usr/bin/env node

/**
 * Google Gemini MCP Server — WebBridge Generated
 *
 * Automates Google Gemini via authenticated HTTP requests:
 * - Gem CRUD: create, list, get, edit, enhance
 * - Chat: send messages to Gemini or specific Gems
 * - Tools: fetch available extensions
 *
 * Auth: Cookie-based (WebBridge captures real Chrome session cookies)
 * Requires: Chrome running with WebBridge extension active
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Constants ──────────────────────────────────────────────────────────────

const GEMINI_BASE = "https://gemini.google.com/u/0/_/BardChatUi/data";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

// RPC endpoint builders
const batchUrl = (rpcIds, sourcePath, reqId = 100000) =>
  `${GEMINI_BASE}/batchexecute?rpcids=${rpcIds}&source-path=${encodeURIComponent(sourcePath)}&bl=boq_assistant-bard-web-server_20260529.02_p0&f.sid=0&hl=vi&_reqid=${reqId}&rt=c`;

const streamUrl = (reqId = 100000) =>
  `${GEMINI_BASE}/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20260529.02_p0&f.sid=0&hl=vi&_reqid=${reqId}&rt=c`;

// ─── Session State ──────────────────────────────────────────────────────────

let session = {
  cookies: null,      // Cookie string from WebBridge
  atToken: null,      // XSRF/anti-forgery token
  sid: null,          // Session ID (f.sid)
  loaded: false,
};

// Session cache file — updated by WebBridge bridge.sock
// Fix 2026-09-16: session.json nằm trong server/ (không phải site root) —
// check cả 2 để tương thích, tránh "session not available" giả.
const SESSION_FILE = existsSync(join(__dirname, "session.json"))
  ? join(__dirname, "session.json")
  : join(__dirname, "..", "session.json");

function loadSession() {
  if (session.loaded) return true;

  // Try loading from session cache file
  if (existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
      session.cookies = data.cookies;
      session.atToken = data.atToken;
      session.sid = data.sid || "0";
      session.loaded = true;
      return true;
    } catch {
      // Fall through
    }
  }

  return false;
}

function ensureSession() {
  if (!loadSession()) {
    throw new Error(
      "Gemini session not available. Ensure Chrome is running with WebBridge extension and you have visited gemini.google.com."
    );
  }
}

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

function commonHeaders() {
  return {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    "User-Agent": USER_AGENT,
    "Referer": "https://gemini.google.com/",
    "X-Same-Domain": "1",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-platform": '"macOS"',
    Cookie: session.cookies,
  };
}

/**
 * Parse Gemini's anti-XSSI response format: )]}'  <length> <data>
 */
function parseGeminiResponse(raw) {
  if (!raw) return null;

  // Strip the )]}' prefix
  let text = raw.replace(/^\)\]\}'\s*/, "");

  // Parse length-prefixed chunks
  const chunks = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Try to parse as length-prefixed JSON
    const maybeLen = parseInt(line, 10);
    if (!isNaN(maybeLen) && i + 1 < lines.length) {
      // Next line is the data
      try {
        const data = JSON.parse(lines[i + 1]);
        chunks.push(data);
        i++; // Skip the data line
      } catch {
        // Not valid JSON after length, try parsing line itself
        try {
          chunks.push(JSON.parse(line));
        } catch {
          // Skip
        }
      }
    } else {
      // Try parsing as direct JSON
      try {
        chunks.push(JSON.parse(line));
      } catch {
        // Skip
      }
    }
  }

  return chunks.length > 0 ? chunks : text;
}

/**
 * Extract the actual data payload from a batchexecute response.
 * Looks for ["wrb.fr", rpcId, payload, ...] pattern.
 */
function extractRpcPayload(chunks, rpcId) {
  if (!Array.isArray(chunks)) return chunks;

  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;
    for (const item of chunk) {
      if (Array.isArray(item) && item[0] === "wrb.fr" && item[1] === rpcId) {
        // item[2] is the JSON-stringified payload
        if (typeof item[2] === "string") {
          try {
            return JSON.parse(item[2]);
          } catch {
            return item[2];
          }
        }
        return item[2];
      }
    }
  }
  return chunks;
}

// ─── CDP in-page fetch (PRIMARY auth path, 2026-09-15) ─────────────────────
// Google chặn node-fetch replay cookies (401) — chỉ fetch() chạy TRONG tab
// gemini.google.com đã login mới được 200. Debug Chrome port 9223 giữ tab này.
import WebSocket from "ws";
import http from "node:http";

const CDP_PORT = parseInt(process.env.GEMINI_CDP_PORT || "9223", 10);

function httpGetJSON(port, p, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: p, timeout: timeoutMs }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function cdpInPagePost(url, body, timeoutMs = 45000) {
  const tabs = await httpGetJSON(CDP_PORT, "/json");
  const tab = tabs.find((t) => t.type === "page" && t.url.includes("gemini.google"));
  if (!tab) throw new Error(`Không tìm thấy tab gemini.google.com trong Chrome debug :${CDP_PORT} — mở tab + login rồi retry`);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false });
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("CDP evaluate timeout")); }, timeoutMs);
    ws.on("open", () => {
      const expr = `(async () => {
        const at = window.WIZ_global_data && window.WIZ_global_data['SNlM0e'] || '';
        const r = await fetch(${JSON.stringify(url)}, {method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Same-Domain':'1'},
          body: ${JSON.stringify(body)}.replace('__AT__', encodeURIComponent(at)), credentials:'include'});
        return {status: r.status, text: await r.text()};
      })()`;
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate",
        params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    });
    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.id === 1) {
        clearTimeout(timer); ws.close();
        const v = msg.result && msg.result.result && msg.result.result.value;
        if (!v) return reject(new Error("CDP evaluate không trả giá trị"));
        resolve(v);
      }
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Make a batchexecute RPC call to Gemini.
 * PRIMARY: in-page fetch trong tab gemini đã login (Chrome debug 9223).
 * FALLBACK: node-fetch + session.json (cookies replay — Google hay chặn 401).
 */
async function rpcCall(rpcId, payload, sourcePath, reqId = 100000 + Math.floor(Math.random() * 900000)) {
  const url = batchUrl(rpcId, sourcePath, reqId);
  const fReq = JSON.stringify([[[rpcId, JSON.stringify(payload), null, "generic"]]]);

  // PRIMARY — in-page (at token lấy live từ WIZ_global_data của tab)
  try {
    const bodyInPage = `f.req=${encodeURIComponent(fReq)}&at=__AT__&`;
    const v = await cdpInPagePost(url, bodyInPage);
    if (v.status === 200 && v.text && v.text.includes("wrb.fr")) {
      const parsed = parseGeminiResponse(v.text);
      return extractRpcPayload(parsed, rpcId);
    }
    console.error(`[gemini] in-page fetch status=${v.status} — fallback session.json`);
  } catch (e) {
    console.error(`[gemini] in-page fetch lỗi: ${e.message} — fallback session.json`);
  }

  // FALLBACK — cookie replay
  ensureSession();
  const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(session.atToken)}&`;

  const response = await fetch(url, {
    method: "POST",
    headers: commonHeaders(),
    body,
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  const parsed = parseGeminiResponse(raw);
  return extractRpcPayload(parsed, rpcId);
}

/**
 * Send a chat message via StreamGenerate endpoint.
 * PRIMARY (2026-09-16): in-page fetch trong tab gemini — bl/f.sid/at lấy LIVE
 * từ WIZ_global_data (payload hardcoded cũ trả er/400 vì bl stale + contextToken rỗng).
 * FALLBACK: node-fetch + session.json (cookie replay — Google hay chặn 401).
 */
const IMG_CONTEXT_TOKEN = "!AwClAGTNAAZz7H72U-xC6TlVhbZ0dsk7AEABEArZ1KT-1OfYYjEirB10GYMLsKzK1KAnhQo_hReDzToZUY79OnuxJhOIm7svn-SL0FTwd7Fe8t4t8GzY2lUdAgAAAFBSAAAACGgBB34ASzcy2Vo2oWrvLidX2DtH6nMds5FLWn_cS_nKZBENIBJZt75X2PUdkjd1faFk-9nbPmG4uOU43KT8UScDqCU6MweKZW-zxOsOpPFpTJkD53uuoRSfbT6Lnxrw3ivxertCHlAuRkPkYilPEamAoagoe71wMmklgpPOONTs0ws9P7hg1OlkvFyLnXWMWsutv8dNgOvPE4waxDc6GFsOW8plQ9Y-9ayTxLxeK5MfJ_4JG62r1ir_dltOEn6JvTvqbTRuwztRFbh5JZIc3sI5WgRs8fo_eYjHObeZ90oiKQVtoJwQsIC16vsccy2v8oMmO-u7VXFD9kYodGcf5s62m36Cu0I2XDgOr438vLH_23cHvX6ZBoDmhgb0DSCodgfrYL71xzmv_c9qRTp1cwptAH3s7OZ4FjMoV7mg8zrBgzSoSn_rZ-iweARo4UvMsPoWpxv-YF2VE82e_7MkFO2VQSDhIrg6ef_VIxJWOWs0q4Xq2NU-P0JJ-AksYKHdGrQedj2VXykV9lg_kCf2v1Bw2VF4F8kkNA0XzPT4IV34RhdwLIvgyb5Ekp9LKy7Q8hfbqaeEzXiuaglWZV_-iRgOtJo37Gbso3e1wggKAqxQCfhUhynE7GiOBAnkpEIyXgDVjAyvl3F370gq3jERjjV0UN5eN1mp1E_2S9IiIwnzkUvaEne6teES6p5IHx9iNW7srd40Cdk-jNUYaxWrYOR5mG-4Gq2RqMEcAXarE-_d304KbN-x_5_taS_x0UCys-D5YYcTW_SyaUR1l6YP0sd3SKIuGx-8BxSvXNK7NLl79WjGKCSWlx7x1Kooa92Ogrp2qd58GimUJK1pqvXvWBOtXEo_m3iH6UhZHYkZ31Qk5dojifrNPhw6XwOBpPttaLSQ8Gj_eQKDHbYFU7KUw7LrAOxdD0T_jfo5xUIUBMBqhi9W3NWsIkDjjqemiErt1swkiANETZPINSYjil1EPOD9VLlwXJhG8WqMmBktHayA-Qiia7mywkuDPEJXd8mXlFQ3cBMaqM8OaP8MZgBUpK6dud_F7FBtVRvQN9sdw7IK-Z6TOMrNiB24HHcOjQsP63cPJfzYi1yCkn4xPviavJ5_1N2ObUJSizMzWLkziGg7kUL8VD882nLfTDsOj4iBmPFLb2sExqNvLccLTIQXfgILo1CRe2TGHrp8TBEWW-5U6xh4w5mUdywTcogVncbQty4uIDZiS1v8piQUk9Yk4XY-nNrqXmcBfk70-h00k79KeJ49Fkc9-lg_jbbqwwpaK6ojcKWVeLyQak3tqPwK29gGoIC4u8VO_SL_g0vORQBho8D0ijJdjCZZbBUWKFequACnBq_TWFbBvGTni1UERDDA-_REwdOdNQ_OstMmLfDpsce6IcuqkPVb4vvfgq0DSmzst262P5fru82CACmQGVnJXYCO5wLgjNpr2g";

async function streamGenerateViaCDP(message, contextToken = IMG_CONTEXT_TOKEN, timeoutMs = 120000) {
  // 10/10 fix: ưu tiên tab /app — tab gemini khác (gems/edit...) thiếu WIZ_global_data
  const tab = await findGeminiTab();
  if (!tab) throw new Error(`Không tìm thấy tab gemini.google.com trong Chrome debug :${CDP_PORT}`);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 500 * 1024 * 1024 });
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error(`StreamGenerate CDP timeout sau ${timeoutMs}ms`)); }, timeoutMs);
    ws.on("open", () => {
      // Build payload trong page — đúng shape capture thật 2026-09-16:
      // [msg,0,null,null,null,null,0] + ["vi"] + ["","","",7×null,""] (10 elem) + contextToken
      const msgJson = JSON.stringify(message);
      const expr = `(async () => {
        const w = window.WIZ_global_data || {};
        const bl = w['cfb2h'], fsid = w['FdrFJe'], at = w['SNlM0e'];
        if (!bl || !at) return {status: 0, text: 'WIZ_global_data thiếu cfb2h/SNlM0e — reload tab gemini rồi retry'};
        const inner = [[${msgJson},0,null,null,null,null,0],["vi"],["","","",null,null,null,null,null,null,null,""],${JSON.stringify(contextToken)}];
        const fReq = JSON.stringify([null, JSON.stringify(inner)]);
        const url = 'https://gemini.google.com/u/0/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=' + encodeURIComponent(bl) + '&f.sid=' + (fsid || 0) + '&hl=vi&_reqid=' + Math.floor(100000 + Math.random() * 900000) + '&rt=c';
        const r = await fetch(url, {method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Same-Domain':'1'},
          body: 'f.req=' + encodeURIComponent(fReq) + '&at=' + encodeURIComponent(at) + '&',
          credentials:'include'});
        const text = await r.text();
        return {status: r.status, len: text.length, text: text.slice(0, 800000)};
      })()`;
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate",
        params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    });
    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.id === 1) {
        clearTimeout(timer); ws.close();
        const v = msg.result && msg.result.result && msg.result.result.value;
        if (!v) {
          const exc = msg.result && msg.result.exceptionDetails;
          return reject(new Error("StreamGenerate CDP lỗi: " + (exc ? JSON.stringify(exc).slice(0, 300) : "không có giá trị")));
        }
        resolve(v);
      }
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

async function streamGenerate(message, conversationId = null, reqId = 100000 + Math.floor(Math.random() * 900000)) {
  // PRIMARY — CDP in-page (live bl/f.sid/at + contextToken capture)
  try {
    const v = await streamGenerateViaCDP(message);
    if (v.status === 200 && v.len > 0 && !v.text.startsWith("WIZ_global_data")) {
      return { rawText: v.text, parsed: parseGeminiResponse(v.text) };
    }
    console.error(`[gemini] StreamGenerate CDP status=${v.status} — fallback session.json`);
  } catch (e) {
    console.error(`[gemini] StreamGenerate CDP lỗi: ${e.message} — fallback session.json`);
  }

  // FALLBACK — cookie replay
  ensureSession();

  const url = streamUrl(reqId);
  const contextToken = ""; // Empty for new conversations
  const fReq = JSON.stringify([
    null,
    `[[\"${message.replace(/"/g, '\\"')}\",0,null,null,null,null,0],[\"vi\"],[\"\",\"\",\"\",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],\"${contextToken}\"]`,
  ]);

  const body = `f.req=${encodeURIComponent(fReq)}&at=${encodeURIComponent(session.atToken)}&`;

  const response = await fetch(url, {
    method: "POST",
    headers: commonHeaders(),
    body,
  });

  if (!response.ok) {
    throw new Error(`Gemini StreamGenerate error: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  return { rawText: raw, parsed: parseGeminiResponse(raw) };
}

// ─── Image generation + download (2026-09-16) ───────────────────────────────
// Pipeline proven live 2026-09-16: StreamGenerate CDP (prompt sinh ảnh) →
// response chứa URL ảnh https://lh3.googleusercontent.com/gg-dl/<signed> →
// CORS chặn fetch ảnh từ page gemini (TypeError: Failed to fetch) →
// tải bằng cách MỞ TAB MỚI navigate tới URL + Network.getResponseBody
// (full browser context; curl anonymous lẫn kèm cookies đều 403).

function extractGeneratedImages(text) {
  const urls = [...new Set(text.match(/https:\/\/lh3\.googleusercontent\.com\/gg-dl\/[A-Za-z0-9_-]+/g) || [])];
  // tên file gốc do Gemini đặt (vd watermarked_img_13835157707557019787.png) — tiện trace
  const names = [...new Set(text.match(/[A-Za-z0-9_]*img_[A-Za-z0-9_]*\.png/g) || [])];
  return urls.map((url, i) => ({ url, gemini_name: names[i] || null }));
}

/** Nhận diện TỪ CHỐI (bản quyền/nhân vật có IP...) — Gemini trả lời text thay vì ảnh.
 *  Evidence 11/10: "Bạch Tuyết"/"7 chú lùn" bị từ chối im lặng (response không có
 *  gg-dl URL, chỉ text) — bị debug oan là "flaky". Exit code 3 = REFUSED. */
const REFUSE_PATTERNS = [
  /bản quyền/i, /copyright/i, /intellectual property/i,
  /không thể (tạo|vẽ|tạo ra)/i, /can'?t (create|generate|draw)/i,
  /không thể hỗ trợ/i, /I can'?t help/i, /will not be able to/i,
  /nhân vật có bản quyền/i, /kinh đich?ển Disney/i,
];
function detectRefusal(text) {
  const t = String(text || "");
  for (const p of REFUSE_PATTERNS) {
    const m = t.match(p);
    if (m) {
      // lấy câu chứa dấu hiệu để trace
      const idx = t.indexOf(m[0]);
      const snippet = t.slice(Math.max(0, idx - 60), idx + 120).replace(/\s+/g, " ");
      return `REFUSED: ${snippet}`;
    }
  }
  return null;
}

async function cdpDownloadViaTabNavigation(url, timeoutMs = 60000) {
  // Tab mới riêng (PUT /json/new) — không đụng tab gemini; đóng sau khi xong
  const created = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: CDP_PORT, path: "/json/new", method: "PUT", timeout: 5000 }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject); req.end();
  });
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(created.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 500 * 1024 * 1024 });
    let mid = 0; const pending = new Map(); let mainReq = null;
    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${created.id}`).catch(() => {});
      reject(new Error(`Download tab timeout sau ${timeoutMs}ms`));
    }, timeoutMs);
    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
      if (msg.method === "Network.requestWillBeSent" && msg.params.request.url.includes("gg-dl")) mainReq = msg.params.requestId;
    });
    const send = (method, params = {}) => new Promise((res) => {
      const id = ++mid; pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.on("open", () => {
      (async () => {
        try {
          await send("Network.enable", { maxResourceBufferSize: 100 * 1024 * 1024, maxTotalBufferSize: 200 * 1024 * 1024 });
          await send("Page.enable");
          await send("Page.navigate", { url });
          for (let i = 0; i < Math.floor(timeoutMs / 500) && !mainReq; i++) {
            await new Promise((r) => setTimeout(r, 500));
          }
          if (!mainReq) throw new Error("Không capture được request gg-dl (URL ảnh hết hạn?)");
          await new Promise((r) => setTimeout(r, 1000));
          const body = await send("Network.getResponseBody", { requestId: mainReq });
          clearTimeout(timer); ws.close();
          fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${created.id}`).catch(() => {});
          if (!body.result || !body.result.body) {
            throw new Error("getResponseBody rỗng: " + JSON.stringify(body.error || {}).slice(0, 200));
          }
          resolve(Buffer.from(body.result.body, body.result.base64Encoded ? "base64" : "utf8"));
        } catch (e) {
          clearTimeout(timer);
          try { ws.close(); } catch {}
          fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${created.id}`).catch(() => {});
          reject(e);
        }
      })();
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

function slugify(s, maxLen = 40) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxLen) || "gemini-image";
}

// ─── MCP Server ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "gemini-google-com",
  version: "1.0.0",
});

// ── Tool: gemini_list_gems ──────────────────────────────────────────────────

server.tool(
  "gemini_list_gems",
  "List all Gems in the user's Gemini account. Returns names, descriptions, IDs, and icons.",
  {},
  async () => {
    try {
      // Fetch pages 2 and 3 (page 2 returns pre-built Gems, page 3+ returns custom Gems)
      const results = [];
      for (const page of [2, 3]) {
        const payload = [page, ["vi"], 0];
        const data = await rpcCall("CNgdBe", payload, "/u/0/gems/view", 100000 + page * 100000);
        if (data) results.push(data);
      }

      // Parse Gem entries from the response
      const gems = [];

      function extractGems(obj, depth = 0) {
        if (depth > 15 || !obj) return;
        if (Array.isArray(obj)) {
          // Look for Gem entries: arrays containing [name, description, ...]
          for (const item of obj) {
            if (Array.isArray(item) && typeof item[0] === "string" && item.length > 5) {
              // Heuristic: Gem entries have name as first string and are long arrays
              if (item[0].length > 0 && item[0].length < 200 && item.some((x) => typeof x === "string" && x.includes("gem"))) {
                gems.push({
                  id: item.find((x) => typeof x === "string" && /^[a-f0-9]{12}$/.test(x)) || null,
                  name: item[0],
                  description: item[1] || "",
                  instructions_preview: item[2] ? String(item[2]).substring(0, 200) : null,
                });
              }
            }
            extractGems(item, depth + 1);
          }
        } else if (typeof obj === "object") {
          for (const val of Object.values(obj)) {
            extractGems(val, depth + 1);
          }
        }
      }

      for (const result of results) {
        extractGems(result);
      }

      // Also try the raw string approach
      const rawStr = JSON.stringify(results);

      // Extract Gem IDs (12-char hex pattern)
      const gemIdPattern = /"([a-f0-9]{12})"/g;
      const gemIds = new Set();
      let match;
      while ((match = gemIdPattern.exec(rawStr)) !== null) {
        gemIds.add(match[1]);
      }

      const output = {
        total_gems: gems.length,
        gem_ids_found: [...gemIds],
        gems,
        raw_available: true,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error listing Gems: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_get_gem_details ────────────────────────────────────────────

server.tool(
  "gemini_get_gem_details",
  "Get full details of a specific Gem including instructions, linked docs, colors, and visibility settings.",
  { gem_id: z.string().describe("The Gem ID (12-character hex string, e.g. '262e131a2039')") },
  async ({ gem_id }) => {
    try {
      const data = await rpcCall("UkGqGc", [gem_id], "/u/0/gems/view");

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error getting Gem details: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_create_gem ─────────────────────────────────────────────────

server.tool(
  "gemini_create_gem",
  "Create a new Gem with name, description, and custom instructions. Returns the new Gem ID on success. This is the final commit — for incremental saves use gemini_save_gem_draft.",
  {
    name: z.string().describe("Gem name (displayed in Gemini UI)"),
    description: z.string().describe("Short description of what the Gem does"),
    instructions: z.string().describe("System prompt / instructions for the Gem"),
  },
  async ({ name, description, instructions }) => {
    try {
      // E8.5-H3: create CHỈ commit đúng bản instructions caller truyền (đã qua gate approve
      // của Workflow A). KHÔNG tự enhance lại — heuristic regex từng nhặt nhầm chuỗi metadata
      // và vô hiệu hóa gate duyệt của user. Muốn enhance → gọi gemini_enhance_gem riêng trước.
      const finalInstructions = instructions;

      // Step 2: Commit the Gem via oMH3Zd
      const payload = [[
        name,
        description,
        finalInstructions,
        null, null, null, null, null,
        0,   // gem_type (0 = custom)
        null,
        1,   // visibility flag
        null, null, null,
        [],  // extensions/tools
        null, null,
        0,   // status
      ]];

      const data = await rpcCall("oMH3Zd", payload, "/u/0/gems/create");

      // Parse response: ["<gem_id>", true/false]
      let gemId = null;
      let success = false;

      if (data) {
        const str = JSON.stringify(data);
        const idMatch = str.match(/"([a-f0-9]{12})"/);
        if (idMatch) gemId = idMatch[1];
        success = str.includes("true");
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: success || !!gemId,
            gem_id: gemId,
            name,
            description,
            instructions_length: finalInstructions.length,
            instructions_preview: finalInstructions.substring(0, 500),
            message: gemId
              ? `Gem "${name}" created successfully with ID: ${gemId}`
              : "Gem creation request sent. Check gemini_list_gems to verify.",
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error creating Gem: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_save_gem_draft ─────────────────────────────────────────────

server.tool(
  "gemini_save_gem_draft",
  "Save a Gem draft incrementally. Use during editing to auto-save progress without finalizing.",
  {
    name: z.string().describe("Gem name"),
    description: z.string().describe("Gem description"),
    instructions: z.string().describe("Gem instructions (can be partial/in-progress)"),
  },
  async ({ name, description, instructions }) => {
    try {
      const payload = [[
        name,
        description,
        instructions,
        null, null, null, null, null,
        0, null, 1, null, null, null, [], null, null, 0,
      ]];

      await rpcCall("pOi9ic", payload, "/u/0/gems/create");

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            saved: true,
            name,
            description,
            instructions_preview: instructions.substring(0, 300),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error saving draft: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_enhance_gem ────────────────────────────────────────────────

server.tool(
  "gemini_enhance_gem",
  "Send raw Gem name/description/instructions and get back an AI-enhanced, detailed system prompt. Use this before creating a Gem to get better instructions.",
  {
    name: z.string().describe("Gem name"),
    description: z.string().describe("Short description"),
    instructions: z.string().describe("Raw instructions/concept for the Gem"),
  },
  async ({ name, description, instructions }) => {
    try {
      const data = await rpcCall(
        "QQ03v",
        [null, [name, description, instructions]],
        "/u/0/gems/create"
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            original_instructions: instructions,
            enhanced: data,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error enhancing Gem: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_load_gem_for_edit ──────────────────────────────────────────

server.tool(
  "gemini_load_gem_for_edit",
  "Load a Gem's full data for editing — instructions, colors, visibility, linked documents.",
  { gem_id: z.string().describe("The Gem ID to load for editing") },
  async ({ gem_id }) => {
    try {
      const data = await rpcCall(
        "HcT8bb",
        [gem_id, ["vi"], 1, null, 1],
        `/u/0/gems/edit/${gem_id}`
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error loading Gem for edit: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_send_message ───────────────────────────────────────────────

server.tool(
  "gemini_send_message",
  "Send a chat message to Gemini. Can optionally specify a conversation or Gem context.",
  {
    message: z.string().describe("The message to send"),
    conversation_id: z.string().optional().describe("Optional conversation ID to continue a chat"),
  },
  async ({ message, conversation_id }) => {
    try {
      const result = await streamGenerate(message, conversation_id || null);
      const data = result.parsed; // 2026-09-16: streamGenerate trả {rawText, parsed}

      // Try to extract the response text
      let responseText = "";
      const str = JSON.stringify(data);

      // Look for model response text in the parsed data
      // Gemini responses contain the text in nested arrays
      function findText(obj, depth = 0) {
        if (depth > 20 || responseText) return;
        if (typeof obj === "string" && obj.length > 20 && !obj.startsWith("http") && !obj.startsWith("[")) {
          responseText = obj;
          return;
        }
        if (Array.isArray(obj)) {
          for (const item of obj) findText(item, depth + 1);
        }
      }

      findText(data);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            message_sent: message,
            response_text: responseText || "Response received (see raw data)",
            raw_response: data,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error sending message: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_fetch_tools ────────────────────────────────────────────────

server.tool(
  "gemini_fetch_tools",
  "Fetch available Gemini extensions/tools (Google Calendar, Keep, Tasks, Gmail, Docs, Drive, Photos, YouTube Music, etc.).",
  {},
  async () => {
    try {
      const data = await rpcCall("cYRIkd", ["vi"], "/u/0/gems/create");

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching tools: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool: gemini_generate_image ─────────────────────────────────────────────

server.tool(
  "gemini_generate_image",
  "Generate image(s) from a text prompt via Gemini web (Nano Banana) and auto-download PNG files into a specified project folder. Requires debug Chrome :9223 with a logged-in gemini.google.com tab. Returns saved file paths.",
  {
    prompt: z.string().describe("Image generation prompt (tiếng Việt hoặc English)"),
    save_dir: z.string().describe("Absolute path of the project folder to save images into (created if missing)"),
    filename_base: z.string().optional().describe("Optional base name for files (default: slug of prompt). Files saved as <base>-01.png, <base>-02.png..."),
  },
  async ({ prompt, save_dir, filename_base }) => {
    try {
      const resp = await streamGenerateViaCDP(prompt);
      if (resp.status !== 200) {
        return { content: [{ type: "text", text: `Gemini StreamGenerate status ${resp.status}: ${String(resp.text).slice(0, 300)}` }], isError: true };
      }
      const images = extractGeneratedImages(resp.text);
      if (!images.length) {
        return { content: [{ type: "text", text: `Không tìm thấy ảnh nào trong response (model từ chối hoặc lỗi). Response đầu: ${resp.text.slice(0, 400)}` }], isError: true };
      }
      mkdirSync(save_dir, { recursive: true });
      const base = filename_base ? slugify(filename_base) : slugify(prompt);
      const files = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const buf = await cdpDownloadViaTabNavigation(img.url);
        const path = join(save_dir, `${base}-${String(i + 1).padStart(2, "0")}.png`);
        writeFileSync(path, buf);
        files.push({ path, bytes: buf.length, gemini_name: img.gemini_name, url: img.url });
      }
      return {
        content: [{ type: "text", text: JSON.stringify({
          prompt,
          images_generated: files.length,
          save_dir,
          files,
          note: "Ảnh Gemini free có watermark; latency sinh ảnh ~10-30s/call",
        }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error generating image: ${error.message}` }], isError: true };
    }
  }
);

// ── Tool: gemini_download_image ─────────────────────────────────────────────

server.tool(
  "gemini_download_image",
  "Download a Gemini-generated image by its gg-dl URL (from a previous generation) into a specified folder. Uses tab navigation via CDP because direct fetch is CORS-blocked. URLs are signed and expire — download soon after generation.",
  {
    url: z.string().describe("Image URL https://lh3.googleusercontent.com/gg-dl/..."),
    save_dir: z.string().describe("Absolute path of folder to save into (created if missing)"),
    filename: z.string().optional().describe("Optional file name (default: gemini-image-<timestamp>.png)"),
  },
  async ({ url, save_dir, filename }) => {
    try {
      const buf = await cdpDownloadViaTabNavigation(url);
      mkdirSync(save_dir, { recursive: true });
      const path = join(save_dir, filename || `gemini-image-${Date.now()}.png`);
      writeFileSync(path, buf);
      return {
        content: [{ type: "text", text: JSON.stringify({ downloaded: true, path, bytes: buf.length, url }, null, 2) }],
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error downloading image: ${error.message}` }], isError: true };
    }
  }
);


// ─── Image-conditioned generation (ảnh thật → tranh tô màu) 10/10 ──────────
// BÀI HỌC (probe 10/10, verbatim từ network thật): automation DOM của tab
// gemini (paste vào editor, bấm nút Gửi) bị Gemini lọc âm thầm — ảnh gắn
// được nhưng click Gửi không bao giờ submit. Đường ĐÚNG là RPC thuần:
//   1) upload ảnh qua https://push.clients6.google.com/upload/ (multipart,
//      header Push-ID + X-Tenant-Id — như traffic thật của trang) → trả
//      token dạng "/contrib_service/ttl_1d/..."
//   2) StreamGenerate với file_data = [[[token], filename]] ở vị trí [0][3]
//      (shape tham khảo HanaokaYuzu/Gemini-API), context token rỗng =
//      hội thoại mới → response chứa URL gg-dl như đường text-only.
// Tất cả fetch chạy IN-PAGE trong tab gemini đã login (CDP Runtime.evaluate).

/** nhận dạng ảnh bằng magic bytes — KHÔNG tin extension (luật project) */
function detectImageMime(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** tìm tab gemini dùng chung cho mọi flow ảnh — ưu tiên tab /app */
async function findGeminiTab() {
  const tabs = await httpGetJSON(CDP_PORT, "/json");
  return tabs.find((t) => t.type === "page" && /gemini\.google\.com\/(u\/0\/)?app/.test(t.url))
    || tabs.find((t) => t.type === "page" && t.url.includes("gemini.google"));
}

/** chạy 1 async expression trong tab, trả value (JSON) hoặc throw */
function evalInTab(tab, expr, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 500 * 1024 * 1024 });
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error("evalInTab timeout " + timeoutMs + "ms")); }, timeoutMs);
    ws.on("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate",
        params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    });
    ws.on("message", (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.id === 1) {
        clearTimeout(timer); try { ws.close(); } catch {}
        const v = msg.result && msg.result.result && msg.result.result.value;
        if (v === undefined || v === null) {
          return reject(new Error("evalInTab không trả giá trị: " + JSON.stringify(msg.result || {}).slice(0, 200)));
        }
        resolve(v);
      }
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * Sinh ảnh có điều kiện bởi ảnh đầu vào (image-conditioned) qua RPC thuần.
 * Trả về response text của StreamGenerate (chứa URL gg-dl) để tái dùng
 * extractGeneratedImages + cdpDownloadViaTabNavigation của đường text-only.
 */
async function generateWithImageViaCDP(prompt, imagePath, timeoutMs = 180000) {
  const tab = await findGeminiTab();
  if (!tab) throw new Error("Không tìm thấy tab gemini.google.com trong Chrome :" + CDP_PORT);

  const photoBuf = readFileSync(imagePath);
  const mime = detectImageMime(photoBuf);
  if (!mime) throw new Error("Ảnh đầu vào không phải JPEG/PNG (magic bytes)");
  const b64 = photoBuf.toString("base64");
  const filename = mime === "image/png" ? "photo.png" : "photo.jpg";

  // 1) upload ảnh → token (fetch in-page mang full đăng nhập)
  const upExpr = `(async () => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
    const file = new File([bytes], ${JSON.stringify(filename)}, { type: ${JSON.stringify(mime)} });
    const fd = new FormData();
    fd.append("file", file, ${JSON.stringify(filename)});
    const res = await fetch("https://push.clients6.google.com/upload/", {
      method: "POST",
      headers: { "X-Tenant-Id": "bard-storage", "Push-ID": "feeds/mcudyrk2a4khkz" },
      body: fd,
      credentials: "include"
    });
    const text = await res.text();
    return JSON.stringify({ status: res.status, token: text });
  })()`;
  const upRaw = await evalInTab(tab, upExpr, Math.min(timeoutMs, 120000));
  let up; try { up = JSON.parse(upRaw); } catch { throw new Error("upload response không parse được"); }
  if (up.status !== 200 || typeof up.token !== "string" || !up.token.startsWith("/")) {
    throw new Error("upload ảnh thất bại: status=" + up.status + " body=" + String(up.token).slice(0, 150));
  }

  // 2) StreamGenerate kèm file_data, context token rỗng (hội thoại mới)
  const genExpr = `(async () => {
    const w = window.WIZ_global_data || {};
    const bl = w['cfb2h'], fsid = w['FdrFJe'], at = w['SNlM0e'];
    if (!bl || !at) return JSON.stringify({ status: 0, err: 'WIZ_global_data thiếu cfb2h/SNlM0e — reload tab gemini rồi retry' });
    const fileData = [[[${JSON.stringify(up.token)}], ${JSON.stringify(filename)}]];
    const inner = [[${JSON.stringify(prompt)},0,null,fileData,null,null,0],["vi"],["","","",null,null,null,null,null,null,null,""],""];
    const fReq = JSON.stringify([null, JSON.stringify(inner)]);
    const url = 'https://gemini.google.com/u/0/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=' + encodeURIComponent(bl) + '&f.sid=' + (fsid || 0) + '&hl=vi&_reqid=' + Math.floor(100000 + Math.random() * 900000) + '&rt=c';
    const res = await fetch(url, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-Same-Domain': '1' },
      body: 'f.req=' + encodeURIComponent(fReq) + '&at=' + encodeURIComponent(at) + '&',
      credentials: 'include' });
    const text = await res.text();
    return JSON.stringify({ status: res.status, len: text.length, text: text.slice(0, 800000) });
  })()`;
  const genRaw = await evalInTab(tab, genExpr, timeoutMs);
  let gen; try { gen = JSON.parse(genRaw); } catch { throw new Error("StreamGenerate response không parse được"); }
  if (gen.status !== 200) throw new Error("StreamGenerate status " + gen.status + ": " + String(gen.err || "").slice(0, 200));
  return gen.text;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

// ─── CLI standalone (gen-image.js) — dựng cho BéStar colorbook 10/10 ─────
// Cách dùng: node gen-image.js "<prompt>" <save_dir> [base_name] [input_image]
// Có input_image (JPEG/PNG) → sinh ảnh có điều kiện bởi ảnh đó (chibi colorbook).
// Trả JSON {files:[{path,bytes}]} hoặc exit 1 + lỗi stderr.
const [,, promptArg, saveDir, baseName, inputImage] = process.argv;
if (!promptArg || !saveDir) { console.error("usage: node gen-image.js <prompt> <save_dir> [base] [input_image]"); process.exit(2); }
try {
  let responseText;
  if (inputImage) {
    if (!existsSync(inputImage)) { console.error("input image không tồn tại: " + inputImage); process.exit(2); }
    responseText = await generateWithImageViaCDP(promptArg, inputImage);
  } else {
    const resp = await streamGenerateViaCDP(promptArg);
    if (resp.status !== 200) { console.error("StreamGenerate status " + resp.status + ": " + String(resp.text).slice(0,300)); process.exit(1); }
    responseText = resp.text;
  }
  const images = extractGeneratedImages(responseText);
  if (!images.length) {
    const refused = detectRefusal(responseText);
    if (refused) { console.error(refused); process.exit(3); } // 3 = từ chối (bản quyền/IP)
    console.error("no image in response: " + responseText.slice(0,300)); process.exit(1);
  }
  mkdirSync(saveDir, { recursive: true });
  const base = slugify(baseName || promptArg);
  const files = [];
  for (let i = 0; i < images.length; i++) {
    const buf = await cdpDownloadViaTabNavigation(images[i].url);
    const p = join(saveDir, base + "-" + String(i+1).padStart(2,"0") + ".png");
    writeFileSync(p, buf);
    files.push({ path: p, bytes: buf.length });
  }
  console.log(JSON.stringify({ files }));
} catch (e) { console.error("gen-image error: " + e.message); process.exit(1); }
