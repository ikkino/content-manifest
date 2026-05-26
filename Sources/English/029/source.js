const BASE_URL = "https://anicrush.wiki";

function absoluteUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return BASE_URL + (value.startsWith("/") ? value : "/" + value);
}

function cleanText(value) {
  return String(value || "")
    .replace(/&hellip;|&#8230;/g, "...")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#038;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Ignore malformed metadata and keep parsing the page.
    }
  }
  return blocks;
}

function findSchema(blocks, type) {
  for (const block of blocks) {
    const graph = Array.isArray(block["@graph"]) ? block["@graph"] : [block];
    const found = graph.find((item) => item && item["@type"] === type);
    if (found) return found;
  }
  return null;
}

async function fetchText(url, options = {}) {
  const response = await fetchv2(url, {
    "Accept": "text/html,application/json,*/*",
    "Referer": BASE_URL + "/",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ...(options.headers || {})
  }, options.method, options.body);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.text();
}

async function searchResults(keyword) {
  const query = encodeURIComponent(String(keyword || "").trim());
  if (!query) return JSON.stringify([]);

  const json = await fetchText(BASE_URL + "/wp-json/wp/v2/search?search=" + query);
  const data = JSON.parse(json);
  const results = [];

  for (const item of Array.isArray(data) ? data : []) {
    if (!item.url || !item.title) continue;
    results.push({
      title: cleanText(item.title),
      image: "",
      href: item.url
    });
  }

  return JSON.stringify(results);
}

async function extractDetails(url) {
  const html = await fetchText(url);
  const blocks = parseJsonLdBlocks(html);
  const series = findSchema(blocks, "TVSeries") || {};
  const description = cleanText(series.description)
    || cleanText(html.match(/<meta name="description" content="([^"]+)"/)?.[1])
    || "N/A";
  const aliases = cleanText(series.alternateName) || "N/A";
  const airdate = cleanText(series.datePublished) || "N/A";

  return JSON.stringify([{ description, aliases, airdate }]);
}

async function extractEpisodes(url) {
  const html = await fetchText(url);
  const episodes = [];
  const seen = new Set();
  const regex = /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*\bep-item\b[^"]*"[^>]*data-number="([^"]+)"[^>]*data-id="([^"]+)"/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = absoluteUrl(match[1]);
    const number = Number.parseFloat(match[2]);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    episodes.push({
      href,
      number: Number.isFinite(number) ? number : episodes.length + 1
    });
  }

  episodes.sort((a, b) => a.number - b.number);
  return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
  const html = await fetchText(url);
  const blocks = parseJsonLdBlocks(html);
  const episode = findSchema(blocks, "TVEpisode") || {};
  const embed = episode.video?.embedUrl
    || html.match(/<iframe[^>]+src="([^"]+)"/i)?.[1]
    || html.match(/data-hash="([^"]+)"/i)?.[1];

  let streamUrl = embed || "";
  if (streamUrl && !/^https?:\/\//i.test(streamUrl)) {
    try {
      const decoded = atob(streamUrl);
      streamUrl = decoded.match(/<iframe[^>]+src="([^"]+)"/i)?.[1] || "";
    } catch {
      streamUrl = "";
    }
  }

  if (!streamUrl) return JSON.stringify({ streams: [] });
  return JSON.stringify({
    streams: [{
      title: "AniCrush",
      streamUrl,
      url: streamUrl
    }]
  });
}
