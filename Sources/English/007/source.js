const ANIKOTO_BASE = "https://animesogo.to";
const ANIKOTO_NAME = "AnimeSogo";

async function anikotoText(url, headers) {
  const response = await fetchv2(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/json,*/*",
      "Referer": ANIKOTO_BASE + "/",
      "X-Requested-With": "XMLHttpRequest",
      ...(headers || {})
    }
  });
  if (!response.ok) throw new Error(`${ANIKOTO_NAME} HTTP ${response.status}`);
  return response.text();
}

function rc4Base64Url(key, input) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  const k = Array.from(String(key), (c) => c.charCodeAt(0));
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i] + k[i % k.length]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
  }
  let i = 0; j = 0;
  let binary = "";
  for (const ch of String(input)) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    binary += String.fromCharCode(ch.charCodeAt(0) ^ s[(s[i] + s[j]) & 255]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function exchange(input, from, to) {
  return Array.from(String(input), (ch) => {
    const index = from.indexOf(ch);
    return index >= 0 ? to[index] : ch;
  }).join("");
}

function vrfEncrypt(value) {
  let vrf = String(value);
  vrf = exchange(vrf, "AP6GeR8H0lwUz1", "UAz8Gwl10P6ReH");
  vrf = rc4Base64Url("ItFKjuWokn4ZpB", vrf);
  vrf = rc4Base64Url("fOyt97QWFB3", vrf);
  vrf = exchange(vrf, "1majSlPQd2M5", "da1l2jSmP5QM");
  vrf = exchange(vrf, "CPYvHj09Au3", "0jHA9CPYu3v");
  vrf = Array.from(vrf).reverse().join("");
  vrf = rc4Base64Url("736y1uTJpBLUX", vrf);
  return encodeURIComponent(btoa(vrf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""));
}

function stripTags(html) {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function showPath(href) {
  const path = String(href || "").replace(ANIKOTO_BASE, "").split("?")[0];
  return path.replace(/\/ep-\d+.*$/, "");
}

function titleFromPath(path) {
  const slug = String(path || "").split("/watch/").pop() || "";
  return slug
    .replace(/-[a-z0-9]{5}$/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

async function searchResults(query) {
  const html = await anikotoText(`${ANIKOTO_BASE}/filter?keyword=${encodeURIComponent(query)}&page=1&vrf=${vrfEncrypt(query)}`);
  const seen = new Set();
  const results = [];
  const regex = /<a\b[^>]*href=["']([^"']*\/watch\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) && results.length < 20) {
    const path = showPath(match[1]);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const block = match[2];
    const rawTitle = decodeHtml((block.match(/class=["'][^"']*(?:name|title)[^"']*["'][^>]*>([^<]+)/i) || [])[1] || stripTags(block));
    const title = /[a-z]{3,}/i.test(rawTitle) ? rawTitle : titleFromPath(path);
    results.push({ title, href: JSON.stringify({ path, title }), image: ((block.match(/(?:data-src|src)=["']([^"']+)/i) || [])[1] || ""), source: ANIKOTO_NAME });
  }
  return results.filter((item) => item.title && item.href);
}

async function extractDetails(href) {
  const data = JSON.parse(href);
  const html = await anikotoText(ANIKOTO_BASE + data.path);
  const id = (html.match(/data-id=["']([^"']+)/i) || [])[1] || (html.match(/data-tip=["']([^"']+)/i) || [])[1] || "";
  const title = decodeHtml((html.match(/<h[12][^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]+)/i) || [])[1] || data.title || "");
  const description = decodeHtml(stripTags((html.match(/<(?:div|p)[^>]*class=["'][^"']*(?:synopsis|description|content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i) || [])[1] || title));
  return [{ title, description, aliases: id ? `${title}, ${id}` : title, airdate: "", href: JSON.stringify({ ...data, id }) }];
}

async function extractEpisodes(href) {
  const data = JSON.parse(href);
  let id = data.id;
  if (!id) {
    const detail = await extractDetails(href);
    id = JSON.parse(detail[0].href).id;
  }
  if (!id) throw new Error(`${ANIKOTO_NAME}: missing anime id`);
  const text = await anikotoText(`${ANIKOTO_BASE}/ajax/episode/list/${id}?vrf=${vrfEncrypt(id)}`, { "Referer": ANIKOTO_BASE + data.path });
  const payload = JSON.parse(text);
  const html = payload.result || "";
  const episodes = [];
  const regex = /<a\b([^>]*data-num=["'][^"']+["'][^>]*)>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const attrs = match[1];
    const number = Number((attrs.match(/data-num=["']([^"']+)/i) || [])[1]);
    const ids = (attrs.match(/data-ids=["']([^"']+)/i) || [])[1] || "";
    const title = decodeHtml((html.slice(Math.max(0, match.index - 180), match.index).match(/<li[^>]*title=["']([^"']+)/i) || [])[1] || `Episode ${number}`);
    if (Number.isFinite(number) && ids) {
      episodes.push({ number, title, href: JSON.stringify({ ...data, id, number, ids }) });
    }
  }
  return episodes.sort((lhs, rhs) => lhs.number - rhs.number);
}

async function extractStreamUrl(href) {
  const data = JSON.parse(href);
  const epPath = `${data.path}/ep-${data.number}`;
  const text = await anikotoText(`${ANIKOTO_BASE}/ajax/server/list?servers=${encodeURIComponent(data.ids)}`, { "Referer": ANIKOTO_BASE + epPath });
  const payload = JSON.parse(text);
  const html = payload.result || "";
  const serverIds = Array.from(html.matchAll(/data-link-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:li|a)>/gi))
    .map((match) => ({ id: match[1], name: stripTags(match[2]) }))
    .filter((item) => item.id);
  for (const server of serverIds.slice(0, 5)) {
    try {
      const serverText = await anikotoText(`${ANIKOTO_BASE}/ajax/server?get=${encodeURIComponent(server.id)}`, { "Referer": ANIKOTO_BASE + epPath });
      const serverPayload = JSON.parse(serverText);
      const url = serverPayload?.result?.url || serverPayload?.url || "";
      if (!url) continue;
      if (/\.m3u8|\/stream\//i.test(url)) return [{ title: `${ANIKOTO_NAME} ${server.name}`.trim(), streamUrl: url, headers: { "Referer": ANIKOTO_BASE + "/" } }];
      const page = await anikotoText(url, { "Referer": ANIKOTO_BASE + "/" });
      const m3u8 = (page.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i) || [])[0];
      if (m3u8) return [{ title: `${ANIKOTO_NAME} ${server.name}`.trim(), streamUrl: m3u8, headers: { "Referer": url } }];
    } catch (_) {}
  }
  throw new Error(`${ANIKOTO_NAME}: no playable streams`);
}
