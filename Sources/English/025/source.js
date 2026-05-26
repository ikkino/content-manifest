async function searchResults(query) {
  const encodeQuery = keyword => encodeURIComponent(keyword);
  const searchBaseUrl = "https://anikai.to/browser?keyword=";
  const baseUrl = "https://anikai.to";
  
  const posterHrefRegex = /href="[^"]*" class="poster"/g;
  const titleRegex = /class="title"[^>]*title="[^"]*"/g;
  const imageRegex = /data-src="[^"]*"/g;
  const extractHrefRegex = /href="([^"]*)"/;
  const extractImageRegex = /data-src="([^"]*)"/;
  const extractTitleRegex = /title="([^"]*)"/;
  
  try {
    const encodedQuery = encodeQuery(query);
    const searchUrl = searchBaseUrl + encodedQuery;
    const response = await fetchv2("https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(searchUrl));
    const htmlText = await response.text();
    
    const results = [];
    const posterMatches = htmlText.match(posterHrefRegex) || [];
    const titleMatches = htmlText.match(titleRegex) || [];
    const imageMatches = htmlText.match(imageRegex) || [];
    
    const minLength = Math.min(posterMatches.length, titleMatches.length, imageMatches.length);
    
    for (let index = 0; index < minLength; index++) {
      const hrefMatch = posterMatches[index].match(extractHrefRegex);
      const fullHref = hrefMatch ? 
        (hrefMatch[1].startsWith("http") ? hrefMatch[1] : baseUrl + hrefMatch[1]) : 
        null;
      
      const imageMatch = imageMatches[index].match(extractImageRegex);
      const imageSrc = imageMatch ? imageMatch[1] : null;
      
      const titleMatch = titleMatches[index].match(extractTitleRegex);
      const cleanTitle = titleMatch ? 
        decodeHtmlEntities(titleMatch[1]) : 
        null;
      
      if (fullHref && imageSrc && cleanTitle) {
        results.push({
          href: fullHref,
          image: "https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(imageSrc),
          title: cleanTitle
        });
      }
    }
    
    return JSON.stringify(results);
  } catch (error) {
    return JSON.stringify([{
      href: "",
      image: "",
      title: "Search failed: " + error.message
    }]);
  }
}

async function extractDetails(url) {
  try {
    const response = await fetchv2("https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(url));
    const htmlText = await response.text();
    console.log(htmlText);
    
    const descriptionMatch = (/<div class="desc text-expand">([\s\S]*?)<\/div>/.exec(htmlText) || [])[1];
    const aliasesMatch = (/<small class="al-title text-expand">([\s\S]*?)<\/small>/.exec(htmlText) || [])[1];
    
    return JSON.stringify([{
      description: descriptionMatch ? cleanHtmlSymbols(descriptionMatch) : "Not available",
      aliases: aliasesMatch ? cleanHtmlSymbols(aliasesMatch) : "Not available",
      airdate: "If stream doesn't load try later or disable VPN/DNS"
    }]);
  } catch (error) {
    console.error("Error fetching details:" + error);
    return [{
      description: "Error loading description",
      aliases: "Aliases: Unknown",
      airdate: "Aired: Unknown"
    }];
  }
}

async function extractEpisodes(url) {  
  try {
      const actualUrl = url.replace("Animekai:", "").trim();
      const htmlText = await (await fetchv2("https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(actualUrl))).text();
      const animeIdMatch = (htmlText.match(/<div class="rate-box"[^>]*data-id="([^"]+)"/) || [])[1];
      if (!animeIdMatch) return JSON.stringify([{ error: "AniID not found" }]);

      const tokenResponse = await fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(animeIdMatch)}`);
      const tokenData = await tokenResponse.json();
      const token = tokenData.result;

      const episodeListUrl = `https://anikai.to/ajax/episodes/list?ani_id=${animeIdMatch}&_=${token}`;
      const episodeListData = await (await fetchv2("https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(episodeListUrl))).json();
      const cleanedHtml = cleanJsonHtml(episodeListData.result);

      const episodeRegex = /<a[^>]+num="([^"]+)"[^>]+token="([^"]+)"[^>]*>/g;
      const episodeMatches = [...cleanedHtml.matchAll(episodeRegex)];

      const episodes = episodeMatches.map(([_, episodeNum, episodeToken]) => ({
        number: parseInt(episodeNum, 10),
        href: `https://anikai.to/ajax/links/list?token=${episodeToken}&_=ENCRYPT_ME`
      }));

      return JSON.stringify(episodes);
  } catch (err) {
    console.error("Error fetching episodes:" + err);
    return [{
      number: 1,
      href: "Error fetching episodes"
    }];
  }
}

async function extractStreamUrl(url) {
    const headers = {
      "Referer": "https://anikai.to/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0",
      "Accept": "text/html, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.5",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache"
    };

    try {
      const tokenMatch = url.match(/token=([^&]+)/);
      if (!tokenMatch?.[1]) throw new Error("No token found in URL");
      const rawToken = tokenMatch[1];

      const encTokenRes = await fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(rawToken)}`);
      const encTokenData = await encTokenRes.json();
      const encryptedToken = encTokenData.result;

      const actualUrl = url.replace('&_=ENCRYPT_ME', `&_=${encryptedToken}`);

      const response = await fetchv2(actualUrl);
      const text = await response.text();

      let ajaxResultHtml = "";
      try {
        const parsedAjax = JSON.parse(text);
        ajaxResultHtml = parsedAjax?.result || "";
      } catch {}

      const cleanedHtml = cleanJsonHtml(text);
      const cleanedAjaxResultHtml = cleanJsonHtml(ajaxResultHtml);
      const serverHtmlSource = cleanedAjaxResultHtml || cleanedHtml;

      const extractServerIds = (type) => {
        const regex = new RegExp(`<div class="server-items lang-group" data-id="${type}"[^>]*>([\\s\\S]*?)<\\/div>`);
        const content = regex.exec(serverHtmlSource)?.[1] ?? "";
        const spanRegex = /<span class="server"[^>]*data-lid="([^"]+)"[^>]*>/g;
        const ids = [];
        let match;
        while ((match = spanRegex.exec(content)) !== null) ids.push(match[1]);
        return ids.length > 1 ? ids[1] : ids[0] ?? null;
      };

      const types = ["dub"];

      const servers = types
        .map(type => ({ type, lid: extractServerIds(type) }))
        .filter(s => s.lid);

      const streams = [];
      const subtitles = [];

      await Promise.all(servers.map(async ({ type, lid }) => {
        try {
          const decLidRes = await fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(lid)}`);
          const decLidData = await decLidRes.json();
          const decodedLid = decLidData.result;

          const viewUrl = `https://anikai.to/ajax/links/view?id=${lid}&_=${decodedLid}`;
          const viewRes = await fetchv2(viewUrl);
          const viewJson = await viewRes.json();
          const encodedResult = viewJson.result;

          const decRes = await fetchv2(
            "https://enc-dec.app/api/dec-kai",
            { "Content-Type": "application/json" },
            "POST",
            JSON.stringify({ text: encodedResult })
          );
          const decJson = await decRes.json();
          let iframeUrl = decJson.result?.url ?? null;

          if (!iframeUrl) return;

          if (iframeUrl.includes("anikai.to/iframe")) {
            const iframePageRes = await fetchv2(iframeUrl, headers);
            const iframePageText = await iframePageRes.text();
            const iframeSrcMatch = iframePageText.match(/<iframe[^>]+src="([^"]+)"/i);
            if (iframeSrcMatch && iframeSrcMatch[1]) {
              iframeUrl = iframeSrcMatch[1];
            }
          }

          const mediaUrl = iframeUrl.replace("/e/", "/media/").replace("/e2/", "/media/");

          const mediaRes = await fetchv2(mediaUrl, headers);
          const mediaJson = await mediaRes.json();
          const encodedM3u8 = mediaJson?.result;

          if (!encodedM3u8) return;

          const finalRes = await fetchv2(
            "https://enc-dec.app/api/dec-mega",
            { "Content-Type": "application/json" },
            "POST",
            JSON.stringify({ text: encodedM3u8, agent: headers["User-Agent"] })
          );
          const finalJson = await finalRes.json();

          const sources = finalJson?.result?.sources ?? [];
          const tracks = finalJson?.result?.tracks ?? [];

          const file = sources[0]?.file ?? null;

          if (file) {
            const titleMap = { dub: "Dubbed English" };
            let pushedQualities = 0;
            const baseTitle = titleMap[type] || type;

            try {
              const m3u8Response = await fetchv2("https://1anime.app/api/m3u8-proxy?url=" + encodeURIComponent(file));
              const m3u8Text = await m3u8Response.text();
              const lines = m3u8Text.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('#EXT-X-STREAM-INF:')) {
                  const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                  let quality = 'Unknown';
                  if (resolutionMatch) {
                    const [width, height] = resolutionMatch[1].split('x');
                    quality = `${height}p`;
                  }
                  if (i + 1 < lines.length) {
                    let streamPath = lines[i + 1].trim();
                    let absolutePath;
                    if (streamPath.startsWith('/api/')) {
                      absolutePath = 'https://1anime.app' + streamPath;
                    } else if (streamPath.startsWith('http')) {
                      absolutePath = 'https://1anime.app/api/m3u8-proxy?url=' + encodeURIComponent(streamPath);
                    } else {
                      const baseUrl = file.substring(0, file.lastIndexOf('/') + 1);
                      absolutePath = 'https://1anime.app/api/m3u8-proxy?url=' + encodeURIComponent(baseUrl + streamPath);
                    }
                    streams.push({
                      title: `${quality} - ${baseTitle}`,
                      streamUrl: absolutePath
                    });
                    pushedQualities++;
                  }
                }
              }
            } catch (e) {
              console.log("Failed to extract qualities:", e);
            }
            if (pushedQualities === 0) {
              streams.push({ title: baseTitle, streamUrl: "https://1anime.app/api/m3u8-proxy?url=" + encodeURIComponent(file) });
            }
          }

          for (const track of tracks) {
            if (track.file && track.label) {
              subtitles.push({ url: track.file, language: track.label });
            }
          }

        } catch (e) {
          console.log(`[extractStreamUrl] error for ${type}:`, e.toString());
        }
      }));

      return JSON.stringify({ streams, subtitles });
    } catch (error) {
      console.error("Animekai fetch error:" + error);
      return "https://error.org";
    }
}

function cleanHtmlSymbols(string) {
  if (!string) {
    return "";
  }
  return string
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#[0-9]+;/g, "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanJsonHtml(jsonHtml) {
  if (!jsonHtml) {
    return "";
  }
  return jsonHtml
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

function decodeHtmlEntities(text) {
  if (!text) {
    return "";
  }
  return text
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
