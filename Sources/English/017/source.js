const BASE_URL = "https://123animes.ru";

function absoluteUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return BASE_URL + (value.startsWith("/") ? value : "/" + value);
}

function animeSlug(url) {
  return String(url || "").split("/anime/").pop().split("/")[0].split("?")[0];
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "");
}

async function fetchText(url, options = {}) {
  const response = await fetchv2(url, {
    "Accept": "text/html,application/json,*/*",
    "Referer": BASE_URL + "/",
    ...(options.headers || {})
  }, options.method, options.body);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.text();
}

async function searchResults(keyword) {
  const html = await fetchText(BASE_URL + "/search?keyword=" + encodeURIComponent(keyword));
  const blocks = html.match(/<div class="item">[\s\S]*?(?=<div class="item">|<div class="clearfix"><\/div>)/g) || [];
  const wanted = normalizeTitle(keyword);
  const results = [];

  for (const block of blocks) {
    const href = block.match(/<a href="([^"]+)"[^>]*class="(?:thumb|poster)[^"]*"/)?.[1]
      || block.match(/<a href="([^"]+)"/)?.[1];
    const title = block.match(/<a[^>]*class="name"[^>]*>([\s\S]*?)<\/a>/)?.[1]
      || block.match(/<img[^>]*alt="([^"]+)"/)?.[1];
    const image = block.match(/\sdata-src="([^"]+)"/)?.[1]
      || block.match(/\ssrc="([^"]+)"/)?.[1]
      || "";

    if (!href || !title) continue;
    results.push({
      title: cleanText(title),
      image: absoluteUrl(image),
      href: absoluteUrl(href)
    });
  }

  results.sort((a, b) => {
    const aTitle = normalizeTitle(a.title);
    const bTitle = normalizeTitle(b.title);
    const aExact = aTitle === wanted ? 0 : 1;
    const bExact = bTitle === wanted ? 0 : 1;
    return aExact - bExact || a.title.length - b.title.length;
  });

  return JSON.stringify(results);
}

async function extractDetails(url) {
  const html = await fetchText(url);
  const description = cleanText(html.match(/<div class="desc">([\s\S]*?)<\/div>/)?.[1]) || "N/A";
  const aliases = cleanText(html.match(/<p class="alias">([\s\S]*?)<\/p>/)?.[1]) || "N/A";
  const airdate = cleanText(html.match(/<dt>Released:<\/dt>\s*<dd>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]) || "N/A";

  return JSON.stringify([{ description, aliases, airdate }]);
}

async function extractEpisodes(url) {
  const slug = animeSlug(url);
  if (!slug) return JSON.stringify([]);

  const responseText = await fetchText(BASE_URL + "/ajax/film/sv?id=" + encodeURIComponent(slug));
  let html = responseText;
  try {
    html = JSON.parse(responseText).html || "";
  } catch {
    html = responseText;
  }

  const server = html.match(/<div class="server[^"]*"[^>]*data-name="([^"]+)"/)?.[1]
    || html.match(/<div class="server[^"]*"[^>]*data-id="([^"]+)"/)?.[1]
    || "vidstreaming.io";
  const episodes = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*data-id="([^"]+)"[^>]*data-base="([^"]+)"[^>]*href="([^"]+)"/g;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const episodeId = match[1];
    const number = Number.parseFloat(match[2]);
    if (!episodeId || seen.has(episodeId)) continue;
    seen.add(episodeId);
    episodes.push({
      href: episodeId + "/" + server,
      number: Number.isFinite(number) ? number : episodes.length + 1
    });
  }

  episodes.sort((a, b) => a.number - b.number);
  return JSON.stringify(episodes);
}

async function extractStreamUrl(id) {
  const data = JSON.parse(await fetchText(BASE_URL + "/ajax/episode/info?epr=" + encodeURIComponent(id)));
  if (!data.target || !/^https?:\/\//i.test(data.target)) return JSON.stringify({ streams: [] });

  return JSON.stringify({
    streams: [{
      title: data.name || "123Anime",
      streamUrl: data.target
    }]
  });
}
