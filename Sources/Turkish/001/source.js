const BASE_URL = "https://animeler.pw";

function cleanText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value.replace(/\\\//g, "/");
  return BASE_URL + (value.startsWith("/") ? value : "/" + value);
}

async function fetchText(url, options = {}) {
  const response = await fetchv2(url, {
    "Accept": "text/html,application/json,*/*",
    "Referer": BASE_URL + "/",
    "X-Requested-With": options.xhr ? "XMLHttpRequest" : undefined,
    ...(options.headers || {})
  }, options.method, options.body);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.text();
}

async function searchResults(keyword) {
  const query = encodeURIComponent(String(keyword || "").trim());
  if (!query) return JSON.stringify([]);
  const text = await fetchText(BASE_URL + "/ajax/search?q=" + query, { xhr: true });
  const json = JSON.parse(text);
  const items = Array.isArray(json.results) ? json.results : [];
  return JSON.stringify(items.map((item) => ({
    title: cleanText(item.title),
    image: absoluteUrl(item.image),
    href: absoluteUrl(item.url)
  })).filter((item) => item.title && item.href));
}

async function extractDetails(url) {
  const html = await fetchText(url);
  const description = cleanText(
    html.match(/<meta name=["']description["'] content=["']([^"']+)["']/i)?.[1]
    || html.match(/<meta property=["']og:description["'] content=["']([^"']+)["']/i)?.[1]
    || "Not available"
  );
  const aliases = cleanText(
    html.match(/<meta name=["']keywords["'] content=["']([^"']+)["']/i)?.[1]
    || "Not available"
  );
  const airdate = cleanText(
    html.match(/<span[^>]*>\s*Yayın[^<]*<\/span>\s*<[^>]+>\s*([^<]+)/i)?.[1]
    || "Not available"
  );
  return JSON.stringify([{ description, aliases, airdate }]);
}

async function extractEpisodes(url) {
  const html = await fetchText(url);
  const episodes = [];
  const seen = new Set();

  const anchorRegex = /<a\s+href=["']([^"']+\/bolum-[^"']+)["'][^>]*data-ep-num=["']([^"']+)["']/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = absoluteUrl(match[1]);
    const number = Number.parseFloat(match[2]);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    episodes.push({ href, number: Number.isFinite(number) ? number : episodes.length + 1 });
  }

  if (!episodes.length) {
    const jsRegex = /\{\s*id:\s*\d+,\s*url:\s*["']([^"']+\/bolum-[^"']+)["'],\s*start:\s*([\d.]+)/g;
    while ((match = jsRegex.exec(html)) !== null) {
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
  const iframe = html.match(/<iframe[^>]+(?:id=["']fansubPlayerIframe["'][^>]+)?src=["']([^"']+)["']/i)?.[1]
    || html.match(/data-player-src=["']([^"']+)["']/i)?.[1];
  if (iframe) {
    const streamUrl = absoluteUrl(iframe);
    return JSON.stringify({
      streams: [{
        title: "Animeler",
        streamUrl,
        url: streamUrl,
        headers: { "Referer": url }
      }]
    });
  }

  const sourceId = html.match(/data-source-id=["'](\d+)["'][^>]*data-source-type=["']iframe["']/i)?.[1];
  const token = html.match(/<meta name=["']csrf-token["'] content=["']([^"']+)["']/i)?.[1];
  if (sourceId && token) {
    const body = "source_id=" + encodeURIComponent(sourceId) + "&_token=" + encodeURIComponent(token);
    const text = await fetchText(BASE_URL + "/ajax/get-source-url", {
      xhr: true,
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Origin": BASE_URL,
        "Referer": url,
        "X-CSRF-TOKEN": token
      }
    });
    const json = JSON.parse(text);
    if (json.url) {
      const streamUrl = absoluteUrl(json.url);
      return JSON.stringify({ streams: [{ title: "Animeler", streamUrl, url: streamUrl, headers: { "Referer": url } }] });
    }
  }

  return JSON.stringify({ streams: [] });
}
