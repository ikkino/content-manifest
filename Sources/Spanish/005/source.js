const BASE_URL = "https://vww.monoschinos2.net";

function cleanText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#[0-9]+;/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value) {
  if (!value) return "";
  const clean = value.replace(/&amp;/g, "&");
  if (/^https?:\/\//i.test(clean)) return clean;
  return BASE_URL + "/" + clean.replace(/^\.?\//, "");
}

function normalizeTitle(value) {
  return cleanText(value).toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, "");
}

async function fetchText(url, options = {}) {
  const response = await fetchv2(url, {
    "Accept": "text/html,application/json,*/*",
    "Referer": options.referer || BASE_URL + "/",
    "X-Requested-With": options.xhr ? "XMLHttpRequest" : undefined,
    ...(options.headers || {})
  }, options.method, options.body);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.text();
}

function parseSearchItems(html) {
  const items = [];
  const regex = /<li class=["']col mb-5 ficha_efecto["'][\s\S]*?<a href=["']([^"']+)["'][^>]*title=["']([^"']+)["'][\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["'][\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    items.push({
      href: absoluteUrl(match[1]),
      title: cleanText(match[4] || match[2]).replace(/^Ver Anime\s+/i, "").replace(/\s+Online Gratis$/i, ""),
      image: absoluteUrl(match[3]),
      type: cleanText(match[5])
    });
  }
  return items;
}

async function searchResults(keyword) {
  const query = encodeURIComponent(String(keyword || "").trim());
  if (!query) return JSON.stringify([]);
  const pages = await Promise.all([
    fetchText(BASE_URL + "/animes?buscar=" + query + "&pag=1"),
    fetchText(BASE_URL + "/animes?buscar=" + query + "&pag=2").catch(() => "")
  ]);
  const wanted = normalizeTitle(keyword);
  const seen = new Set();
  const results = [];
  for (const item of pages.flatMap(parseSearchItems)) {
    if (!item.href || seen.has(item.href)) continue;
    seen.add(item.href);
    results.push(item);
  }
  results.sort((a, b) => {
    const aTitle = normalizeTitle(a.title);
    const bTitle = normalizeTitle(b.title);
    const aScore = (aTitle === wanted ? 0 : aTitle.startsWith(wanted) ? 1 : aTitle.includes(wanted) ? 2 : 3)
      + (/^anime$/i.test(a.type) ? 0 : 2);
    const bScore = (bTitle === wanted ? 0 : bTitle.startsWith(wanted) ? 1 : bTitle.includes(wanted) ? 2 : 3)
      + (/^anime$/i.test(b.type) ? 0 : 2);
    return aScore - bScore || a.title.length - b.title.length;
  });
  return JSON.stringify(results.map(({ type, ...item }) => item));
}

async function extractDetails(url) {
  const html = await fetchText(url);
  const description = cleanText(
    html.match(/<div class=["'][^"']*mb-3[^"']*["'][^>]*>\s*<p>([\s\S]*?)<\/p>/i)?.[1]
    || html.match(/<meta name=["']description["'] content=["']([^"']+)["']/i)?.[1]
    || "Not available"
  );
  const aliases = cleanText(
    html.match(/<dt>Nombre alternativo:<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1]
    || html.match(/<span>\s*([^<]+)\s*<\/span>\s*<div class=["']d-flex gap-3/i)?.[1]
    || "Not available"
  );
  const airdate = cleanText(
    html.match(/<dt>Fecha de emisión:<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1]
    || "Not available"
  );
  return JSON.stringify([{ description, aliases, airdate }]);
}

async function extractEpisodes(url) {
  const html = await fetchText(url);
  const section = html.match(/<section[^>]+class=["']caplist["'][^>]*>/i)?.[0] || "";
  const total = Number.parseInt(section.match(/data-e=["'](\d+)["']/i)?.[1] || "0", 10);
  const animeId = section.match(/data-i=["'](\d+)["']/i)?.[1];
  const slug = section.match(/data-u=["']([^"']+)["']/i)?.[1]
    || String(url).split("/anime/").pop().split(/[?#/]/)[0];

  if (!animeId || !slug) return JSON.stringify([]);

  const episodes = [];
  const seen = new Set();
  const pages = Math.max(1, Math.min(24, Math.ceil((total || 100) / 50)));

  for (let page = 1; page <= pages; page += 1) {
    const body = "acc=episodes&i=" + encodeURIComponent(animeId) + "&u=" + encodeURIComponent(slug) + "&p=" + page;
    const pageHtml = await fetchText(BASE_URL + "/ajax_pagination", {
      xhr: true,
      method: "POST",
      body,
      referer: url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": BASE_URL
      }
    });
    if (!pageHtml.trim()) break;
    const regex = /<a class=["']ko["'] href=["']([^"']+)["'][\s\S]*?Cap[íi]tulo\s*([\d.]+)/gi;
    let match;
    while ((match = regex.exec(pageHtml)) !== null) {
      const href = absoluteUrl(match[1]);
      const number = Number.parseFloat(match[2]);
      if (!href || seen.has(href)) continue;
      seen.add(href);
      episodes.push({ href, number: Number.isFinite(number) ? number : episodes.length + 1 });
    }
  }

  episodes.sort((a, b) => a.number - b.number);
  return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
  const html = await fetchText(url);
  const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  if (iframe) {
    const streamUrl = absoluteUrl(iframe);
    return JSON.stringify({ streams: [{ title: "Monoschinos2", streamUrl, url: streamUrl, headers: { Referer: url } }] });
  }

  const host = html.match(/href=["'](https?:\/\/(?:[^"']*(?:voe\.sx|mixdrop|mp4upload|dhcplay|bysesukior|movearnpre)[^"']*))["']/i)?.[1]
    || html.match(/href=["'](https?:\/\/[^"']+)["'][^>]*>\s*<svg[\s\S]*?Download/i)?.[1];
  if (host) {
    const streamUrl = host.replace(/&amp;/g, "&");
    return JSON.stringify({ streams: [{ title: "Monoschinos2 Host", streamUrl, url: streamUrl, headers: { Referer: url } }] });
  }

  return JSON.stringify({ streams: [] });
}
