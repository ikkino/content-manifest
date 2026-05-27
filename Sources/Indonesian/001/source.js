const ANIMEINDO_BASE = "https://animeindo.skin";

function htmlDecode(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return ANIMEINDO_BASE + (url.startsWith("/") ? url : "/" + url);
}

function parseVideoLinks(html) {
  const snapshotMatch = html.match(/wire:snapshot="([^"]+)"/);
  if (!snapshotMatch) return [];
  try {
    const decoded = htmlDecode(snapshotMatch[1]).replace(/\\\//g, "/");
    const data = JSON.parse(decoded);
    const videos = data?.data?.videos?.[0] ?? [];
    const links = [];
    for (const entry of videos) {
      const item = Array.isArray(entry) ? entry[0] : entry;
      if (!item?.link) continue;
      links.push({
        title: item.label || "Embed",
        streamUrl: absoluteUrl(item.link),
        url: absoluteUrl(item.link),
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": ANIMEINDO_BASE + "/"
        }
      });
    }
    return links;
  } catch (error) {
    console.log("AnimeIndo video parse failed: " + error.message);
    return [];
  }
}

async function searchResults(keyword) {
  try {
    const response = await fetchv2(ANIMEINDO_BASE + "/search/" + encodeURIComponent(keyword), {
      "User-Agent": "Mozilla/5.0",
      "Referer": ANIMEINDO_BASE + "/"
    });
    const html = await response.text();
    const results = [];
    const cardRegex = /<div class="relative group overflow-hidden">([\s\S]*?)(?=<div class="relative group overflow-hidden"|<div>\s*<!--\[if BLOCK\]|<\/div>\s*<\/div>\s*<div>)/g;
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const card = match[1];
      const href = card.match(/<a href="([^"]+)"/)?.[1];
      const image = card.match(/<img[^>]+(?:data-src|src)="([^"]+)"/)?.[1];
      const title = card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
      if (href && image && title) {
        results.push({
          href: absoluteUrl(href),
          image: absoluteUrl(image),
          title: htmlDecode(title)
        });
      }
    }
    return JSON.stringify(results);
  } catch (error) {
    console.log("AnimeIndo search failed: " + error.message);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    const response = await fetchv2(url, { "User-Agent": "Mozilla/5.0", "Referer": ANIMEINDO_BASE + "/" });
    const html = await response.text();
    const description = html.match(/<p class="text-gray-400 mt-3">([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, "").trim() || "No description available";
    const alias = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "N/A";
    const airdate = html.match(/<span>\s*(\d{4})\s*<\/span>/)?.[1] || "N/A";
    return JSON.stringify([{ description: htmlDecode(description), aliases: htmlDecode(alias), airdate }]);
  } catch (error) {
    console.log("AnimeIndo details failed: " + error.message);
    return JSON.stringify([{ description: "Error", aliases: "Error", airdate: "Error" }]);
  }
}

async function extractEpisodes(url) {
  try {
    const response = await fetchv2(url, { "User-Agent": "Mozilla/5.0", "Referer": ANIMEINDO_BASE + "/" });
    const html = await response.text();
    const episodes = [];
    const episodeRegex = /<a href="([^"]+)"[\s\S]*?<span>\s*Episode\s+(\d+)\s*<\/span>/gi;
    let match;
    while ((match = episodeRegex.exec(html)) !== null) {
      episodes.push({ href: absoluteUrl(match[1]), number: Number(match[2]) });
    }
    if (episodes.length === 0 && parseVideoLinks(html).length > 0) {
      episodes.push({ href: url, number: 1 });
    }
    return JSON.stringify(episodes);
  } catch (error) {
    console.log("AnimeIndo episodes failed: " + error.message);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const response = await fetchv2(url, { "User-Agent": "Mozilla/5.0", "Referer": ANIMEINDO_BASE + "/" });
    const html = await response.text();
    const streams = parseVideoLinks(html);
    if (streams.length > 0) return JSON.stringify({ streams, subtitles: "" });
    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];
    return iframe ? absoluteUrl(iframe) : "https://error.org/";
  } catch (error) {
    console.log("AnimeIndo stream failed: " + error.message);
    return "https://error.org/";
  }
}
