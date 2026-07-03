const ANIKAGE_BASE = "https://anikage.cc";
const ANIKAGE_PROXY = "https://prox.anikage.cc";

async function anikageJson(url) {
  const response = await fetchv2(url, {
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Referer": ANIKAGE_BASE + "/",
      "Origin": ANIKAGE_BASE
    }
  });
  if (!response.ok) throw new Error(`Anikage HTTP ${response.status}`);
  return JSON.parse(await response.text());
}

function anikageTitle(item) {
  return item?.title?.english || item?.title?.romaji || item?.title?.native || "Untitled";
}

function anikageHref(slug, extra) {
  return JSON.stringify({ slug, ...(extra || {}) });
}

function parseAnikageHref(href) {
  try {
    const parsed = JSON.parse(href);
    if (parsed && parsed.slug) return parsed;
  } catch (_) {}
  return { slug: String(href || "").split("/").filter(Boolean).pop() };
}

async function searchResults(query) {
  const url = `${ANIKAGE_BASE}/api/media/anime/advanced-search?per_page=25&page=1&query=${encodeURIComponent(query)}`;
  const payload = await anikageJson(url);
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((item) => ({
    title: anikageTitle(item),
    href: anikageHref(item.slug, { anilistId: item.anilistId }),
    image: item?.coverImage?.extraLarge || item?.coverImage?.large || item?.coverImage?.medium || "",
    source: "Anikage"
  })).filter((item) => item.href);
}

async function extractDetails(href) {
  const data = parseAnikageHref(href);
  const payload = await anikageJson(`${ANIKAGE_BASE}/api/media/anime/${encodeURIComponent(data.slug)}`);
  const anime = payload?.anime || payload;
  return [{
    title: anikageTitle(anime),
    description: String(anime?.description || "").replace(/<[^>]+>/g, "").trim(),
    image: anime?.coverImage?.extraLarge || anime?.coverImage?.large || "",
    aliases: [anime?.title?.romaji, anime?.title?.english, anime?.title?.native].filter(Boolean).join(", "),
    airdate: anime?.year ? String(anime.year) : ""
  }];
}

async function extractEpisodes(href) {
  const data = parseAnikageHref(href);
  const payload = await anikageJson(`${ANIKAGE_BASE}/api/media/anime/${encodeURIComponent(data.slug)}/episodes`);
  const episodes = Array.isArray(payload) ? payload : Array.isArray(payload?.episodes) ? payload.episodes : [];
  return episodes
    .map((episode) => ({
      number: Number(episode.number || episode.episode),
      title: episode.title || `Episode ${episode.number || episode.episode}`,
      href: anikageHref(data.slug, { number: Number(episode.number || episode.episode), lang: "sub" }),
      image: episode.img || "",
      description: episode.description || "",
      airdate: episode.airDate || ""
    }))
    .filter((episode) => Number.isFinite(episode.number) && episode.href)
    .sort((lhs, rhs) => lhs.number - rhs.number);
}

async function extractStreamUrl(href) {
  const data = parseAnikageHref(href);
  const episode = Number(data.number || data.episode || 1);
  const languages = data.lang ? [data.lang] : ["sub", "dub"];
  const streams = [];

  for (const lang of languages) {
    let providers = [];
    try {
      const serverPayload = await anikageJson(`${ANIKAGE_BASE}/api/media/anime/${encodeURIComponent(data.slug)}/episodes/${episode}/servers?lang=${encodeURIComponent(lang)}`);
      providers = (Array.isArray(serverPayload) ? serverPayload : [])
        .map((item) => item.id)
        .filter(Boolean);
    } catch (_) {}
    if (!providers.length) providers = ["megg", "miko", "anya", "verse", "neko"];

    for (const provider of providers) {
      try {
        const sourcePayload = await anikageJson(`${ANIKAGE_BASE}/api/media/anime/${encodeURIComponent(data.slug)}/episodes/${episode}/sources?lang=${encodeURIComponent(lang)}&provider=${encodeURIComponent(provider)}`);
        const sources = Array.isArray(sourcePayload?.sources) ? sourcePayload.sources : [];
        for (const source of sources) {
          if (!source?.url) continue;
          const kind = source.isM3U8 ? "m3u8" : "stream";
          streams.push({
            title: `Anikage ${provider} ${lang} ${source.quality || "auto"}`.trim(),
            streamUrl: `${ANIKAGE_PROXY}/${kind}/${source.url}`,
            headers: { "Referer": ANIKAGE_BASE + "/", "Origin": ANIKAGE_BASE }
          });
        }
        if (streams.length) return streams;
      } catch (_) {}
    }
  }

  throw new Error("Anikage: no playable streams");
}
