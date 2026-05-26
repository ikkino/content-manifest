
const BASE_URL = "https://animebalkan.org";

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url.replace(/&amp;/g, "&");
  return BASE_URL + (url.startsWith("/") ? url : "/" + url);
}

async function searchResults(keyword) {
  const query = encodeURIComponent(String(keyword || "").trim());
  if (!query) return JSON.stringify([]);
  const response = await fetchv2(BASE_URL + "/wp-json/wp/v2/search?subtype=any&per_page=10&search=" + query);
  const items = await response.json();
  const results = [];
  for (const item of items || []) {
    if (!item || !item.url || !String(item.url).includes("/animesaprevodom/")) continue;
    results.push({
      title: decodeHtml(item.title),
      image: "",
      href: absoluteUrl(item.url)
    });
  }
  return JSON.stringify(results);
}

async function extractDetails(url) {
  const response = await fetchv2(url);
  const html = await response.text();
  const description = decodeHtml((html.match(/<p[^>]+id=["']tw-target-rmn["'][^>]*>([\s\S]*?)<\/p>/i) || [])[1])
    || decodeHtml((html.match(/<div[^>]+class=["'][^"']*desc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1])
    || "Not available";
  const airdate = decodeHtml((html.match(/<time[^>]+datetime=["']([^"']+)["']/i) || [])[1] || "Not available").split("T")[0];
  return JSON.stringify([{ description, aliases: "Not available", airdate }]);
}

async function extractEpisodes(url) {
  const response = await fetchv2(url);
  const html = await response.text();
  const episodes = [];
  const block = (html.match(/<div[^>]+class=["'][^"']*eplister[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i) || [])[1] || html;
  const regex = /<a[^>]+href=["']([^"']+)["'][\s\S]*?<div[^>]+class=["']epl-num["'][^>]*>\s*([^<]+)\s*<\/div>/gi;
  let match;
  while ((match = regex.exec(block)) !== null) {
    const number = parseFloat(String(match[2]).replace(/[^\d.]/g, "")) || episodes.length + 1;
    episodes.push({ href: absoluteUrl(match[1]), number });
  }
  episodes.sort((a, b) => a.number - b.number);
  return JSON.stringify(episodes);
}

async function extractStreamUrl(url) {
  const response = await fetchv2(url);
  const html = await response.text();
  const source = (html.match(/<source[^>]+src=["']([^"']+)["']/i) || [])[1];
  if (source) return absoluteUrl(source);
  const iframe = (html.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1];
  if (iframe) return absoluteUrl(iframe);
  return "https://error.org/";
}
