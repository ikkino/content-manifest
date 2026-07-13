const ANIZONE_BASE = "https://anizone.to";

function absoluteUrl(value) {
  if (!value) return "";
  const cleaned = String(value).replace(/&amp;/g, "&").trim();
  if (/^\/\//.test(cleaned)) return "https:" + cleaned;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (cleaned.startsWith("/")) return ANIZONE_BASE + cleaned;
  return ANIZONE_BASE + "/" + cleaned;
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTags(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseTitle(block, fallback) {
  const direct = block.match(/window\.getTitle\(this\.(?:anmTitles|epsTitles),\s*'([^']+)'/);
  if (direct) return decodeEntities(direct[1]).trim();

  const titleJson = block.match(/(?:anmTitles|epsTitles):\s*JSON\.parse\('([^']+)'\)/);
  if (titleJson) {
    try {
      const titles = JSON.parse(decodeEntities(titleJson[1]));
      const preferred = titles["1"] || titles["5"] || titles["8"];
      if (preferred) return String(preferred).trim();
      const ascii = Object.values(titles).find((title) => /^[\x20-\x7E]+$/.test(String(title)));
      if (ascii) return String(ascii).trim();
      const first = Object.values(titles)[0];
      if (first) return String(first).trim();
    } catch (error) {
      console.log("AniZone title parse failed: " + error.message);
    }
  }

  const attrTitle = block.match(/\btitle="([^"]+)"/);
  if (attrTitle && !attrTitle[1].includes("display")) return decodeEntities(attrTitle[1]).trim();
  return fallback;
}

function cardBlockAround(html, index) {
  const articleStart = html.lastIndexOf("<article", index);
  const start = articleStart >= 0 ? articleStart : Math.max(0, index - 2200);
  const articleEnd = html.indexOf("</article>", index);
  const end = articleEnd > index ? articleEnd + 10 : Math.min(html.length, index + 1800);
  return html.slice(start, end);
}

async function searchResults(keyword) {
  try {
    const response = await fetchv2(ANIZONE_BASE + "/anime?search=" + encodeURIComponent(keyword));
    const html = await response.text();
    const results = [];
    const seen = new Set();
    const hrefRegex = /href="(https:\/\/anizone\.to\/anime\/[a-z0-9]+|\/anime\/[a-z0-9]+)"/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = absoluteUrl(match[1]);
      if (seen.has(href)) continue;
      seen.add(href);

      const block = cardBlockAround(html, match.index);
      const slug = href.split("/").filter(Boolean).pop() || "";
      const title = chooseTitle(block, slug);
      const image = absoluteUrl(block.match(/src="([^"]*\/images\/anime\/[^"]+)"/i)?.[1] || "");
      if (title && href) results.push({ title, image, href });
    }

    return JSON.stringify(results.slice(0, 12));
  } catch (error) {
    console.log("AniZone search error: " + error.message);
    return JSON.stringify([]);
  }
}

async function extractDetails(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();
    const title = stripTags(html.match(/<title>(.*?)\s+[\u2014-]\s+AniZone<\/title>/i)?.[1] || "") || "AniZone";
    const image = absoluteUrl(html.match(/src="([^"]*\/images\/anime\/[^"]+)"/i)?.[1] || "");
    const episodeCount = html.match(/>\s*(\d+)\s+Episodes?\s*</i)?.[1] || "";
    const descriptionBlock = html.match(/<p[^>]*class="[^"]*(?:description|line-clamp)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "";
    const description = stripTags(descriptionBlock) || (episodeCount ? episodeCount + " episodes available on AniZone." : "AniZone anime source.");
    return JSON.stringify([{ description, aliases: title, airdate: "", image, episodeCount }]);
  } catch (error) {
    console.log("AniZone details error: " + error.message);
    return JSON.stringify([{ description: "AniZone anime source.", aliases: "", airdate: "" }]);
  }
}

async function extractEpisodes(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();
    const episodes = [];
    const seen = new Set();
    const episodeRegex = /href="(https:\/\/anizone\.to\/anime\/[a-z0-9]+\/\d+|\/anime\/[a-z0-9]+\/\d+)"/gi;
    let match;

    while ((match = episodeRegex.exec(html)) !== null) {
      const href = absoluteUrl(match[1]);
      if (seen.has(href)) continue;
      seen.add(href);
      const number = Number(href.split("/").pop() || episodes.length + 1);
      const block = cardBlockAround(html, match.index);
      const subtitle = chooseTitle(block, "");
      const title = subtitle && !/^episode\s*\d+$/i.test(subtitle) ? "Episode " + number + ": " + subtitle : "Episode " + number;
      const image = absoluteUrl(block.match(/src="([^"]*(?:snapshot|teaser)\.webp)"/i)?.[1] || "");
      episodes.push({ href, number, title, image });
    }

    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes);
  } catch (error) {
    console.log("AniZone episodes error: " + error.message);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(url) {
  try {
    const response = await fetchv2(url);
    const html = await response.text();
    const streamUrl = absoluteUrl(html.match(/<media-player[^>]+src="([^"]+\.m3u8[^"]*)"/i)?.[1] || "");
    if (!streamUrl) return JSON.stringify({ streams: [] });

    const subtitles = [];
    const trackRegex = /<track[^>]+src="?([^"\s>]+)"?[^>]*(?:label="([^"]*)")?[^>]*(?:srclang="([^"]*)")?[^>]*>/gi;
    let track;
    while ((track = trackRegex.exec(html)) !== null) {
      subtitles.push({
        url: absoluteUrl(track[1]),
        label: decodeEntities(track[2] || track[3] || "Subtitle"),
        language: track[3] || ""
      });
    }

    return JSON.stringify({
      streams: [{
        title: "AniZone HLS",
        streamUrl,
        url: streamUrl,
        headers: {
          "Referer": url,
          "User-Agent": "Mozilla/5.0"
        }
      }],
      subtitles
    });
  } catch (error) {
    console.log("AniZone stream error: " + error.message);
    return JSON.stringify({ streams: [] });
  }
}
