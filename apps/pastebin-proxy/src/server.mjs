import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const PASTEBIN_DEV_KEY = process.env.PASTEBIN_DEV_KEY ?? "";

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function normalizePasteKey(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;

  const direct = value.match(/^[a-zA-Z0-9]{4,}$/);
  if (direct) return direct[0];

  try {
    const url = new URL(value);
    if (!url.hostname.includes("pastebin.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    if (parts[0] === "raw" && parts[1]) return parts[1];
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};

  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

async function createPaste(content, title) {
  if (!PASTEBIN_DEV_KEY) {
    throw new Error("PASTEBIN_DEV_KEY is not configured");
  }

  const body = new URLSearchParams({
    api_dev_key: PASTEBIN_DEV_KEY,
    api_option: "paste",
    api_paste_code: content,
    api_paste_private: "1",
    api_paste_name: title || "Epoch of Building export",
    api_paste_format: "json",
    api_paste_expire_date: "N",
  });

  const response = await fetch("https://pastebin.com/api/api_post.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = (await response.text()).trim();
  if (!response.ok || text.startsWith("Bad API request")) {
    throw new Error(text || `Pastebin API error (${response.status})`);
  }

  const key = normalizePasteKey(text);
  if (!key) {
    throw new Error("Pastebin returned an unexpected response");
  }

  return {
    key,
    url: `https://pastebin.com/${key}`,
    rawUrl: `https://pastebin.com/raw/${key}`,
  };
}

async function fetchRawPaste(key) {
  const response = await fetch(`https://pastebin.com/raw/${key}`);
  if (!response.ok) {
    throw new Error(`Paste not found (${response.status})`);
  }
  return response.text();
}

createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    if (method === "GET" && requestUrl.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "pastebin-proxy" });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/pastebin/create") {
      const body = await readJsonBody(req);
      const content = String(body.content ?? "");
      if (!content.trim()) {
        sendJson(res, 400, { error: "content is required" });
        return;
      }

      const created = await createPaste(content, String(body.title ?? ""));
      sendJson(res, 200, created);
      return;
    }

    if (method === "GET" && requestUrl.pathname.startsWith("/api/pastebin/raw/")) {
      const key = normalizePasteKey(requestUrl.pathname.split("/").pop());
      if (!key) {
        sendJson(res, 400, { error: "invalid paste key" });
        return;
      }

      const raw = await fetchRawPaste(key);
      sendJson(res, 200, { key, raw });
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/pastebin/raw") {
      const key = normalizePasteKey(requestUrl.searchParams.get("url"));
      if (!key) {
        sendJson(res, 400, { error: "invalid paste URL or key" });
        return;
      }

      const raw = await fetchRawPaste(key);
      sendJson(res, 200, { key, raw });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 500, { error: message });
  }
}).listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`pastebin-proxy listening on http://${HOST}:${PORT}`);
});
