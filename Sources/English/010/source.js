const ANIMEX_BASE = "https://animex.one";
const ANIMEX_GRAPHQL = "https://graphql.animex.one/graphql";
const ANIMEX_API = "https://pp.animex.one/rest/api";

async function animexJson(url, init) {
  const response = await fetchv2(url, {
    ...(init || {}),
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Origin": ANIMEX_BASE,
      "Referer": ANIMEX_BASE + "/",
      ...((init || {}).headers || {})
    }
  });
  if (!response.ok) throw new Error(`Animex HTTP ${response.status}`);
  return JSON.parse(await response.text());
}

async function animexGraphQL(query, variables) {
  return animexJson(ANIMEX_GRAPHQL, {
    method: "POST",
    body: JSON.stringify({ query, variables: variables || {} })
  });
}

function animexTitle(item) {
  return item?.titleEnglish || item?.titleRomaji || item?.titleNative || "Untitled";
}

function animexHref(item) {
  return JSON.stringify({
    id: item.id,
    anilistId: item.anilistId || null,
    malId: item.malId || null,
    title: animexTitle(item),
    format: item.format || ""
  });
}

function parseAnimexHref(href) {
  try {
    const parsed = JSON.parse(href);
    if (parsed?.id) return parsed;
  } catch (_) {}
  return { id: String(href || ""), title: "" };
}

async function searchResults(query) {
  const payload = await animexGraphQL(
    "query FastSearch($query: String, $limit: Int) { catalogAnime(filter: { query: $query }, limit: $limit) { items { id anilistId malId titleRomaji titleEnglish format } } }",
    { query, limit: 12 }
  );
  const items = payload?.data?.catalogAnime?.items || [];
  return items.map((item) => ({
    title: animexTitle(item),
    href: animexHref(item),
    image: "",
    source: "Animex"
  })).filter((item) => item.href);
}

async function extractDetails(href) {
  const data = parseAnimexHref(href);
  return [{
    title: data.title || data.id,
    description: `${data.title || "Animex anime"} from Animex catalog.`,
    aliases: [data.title, data.anilistId ? `AniList ${data.anilistId}` : "", data.malId ? `MAL ${data.malId}` : ""].filter(Boolean).join(", "),
    airdate: ""
  }];
}

async function extractEpisodes(href) {
  const data = parseAnimexHref(href);
  const servers = await animexJson(`${ANIMEX_API}/servers?id=${encodeURIComponent(data.id)}&epNum=1`, { method: "GET" });
  const total = Number(servers?.episodeCount || servers?.episodes || servers?.totalEpisodes || 0);
  const count = Number.isFinite(total) && total > 0 ? Math.min(total, 2000) : 60;
  const episodes = [];
  for (let index = 1; index <= count; index += 1) {
    episodes.push({
      number: index,
      title: `Episode ${index}`,
      href: JSON.stringify({ ...data, number: index })
    });
  }
  return episodes;
}

async function extractStreamUrl(href) {
  const data = parseAnimexHref(href);
  const episode = Number(data.number || 1);
  const servers = await animexJson(`${ANIMEX_API}/servers?id=${encodeURIComponent(data.id)}&epNum=${episode}`, { method: "GET" });
  const candidates = [];
  for (const provider of servers?.subProviders || []) candidates.push(["sub", provider]);
  for (const provider of servers?.dubProviders || []) candidates.push(["dub", provider]);
  candidates.sort((lhs, rhs) => Number(rhs[1]?.default === true) - Number(lhs[1]?.default === true));

  for (const [type, provider] of candidates) {
    if (!provider?.id) continue;
    try {
      const sourcePayload = await animexJson(`${ANIMEX_API}/sources?id=${encodeURIComponent(data.id)}&epNum=${episode}&type=${encodeURIComponent(type)}&providerId=${encodeURIComponent(provider.id)}`, { method: "GET" });
      const streams = (sourcePayload?.sources || [])
        .map((source) => ({
          title: `Animex ${type} ${provider.id} ${source.quality || ""}`.trim(),
          streamUrl: source.url,
          headers: { "Referer": sourcePayload?.headers?.Referer || ANIMEX_BASE + "/" }
        }))
        .filter((item) => /^https?:\/\//i.test(item.streamUrl || ""));
      if (streams.length) return streams;
    } catch (_) {}
  }

  throw new Error("Animex: no playable streams");
}
