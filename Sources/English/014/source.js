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
    const response = await fetchv2(searchUrl);
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
      const imageSrc = imageMatch
        ? (imageMatch[1].startsWith("http") ? imageMatch[1] : baseUrl + imageMatch[1])
        : null;
      
      const titleMatch = titleMatches[index].match(extractTitleRegex);
      const cleanTitle = titleMatch ? 
        decodeHtmlEntities(titleMatch[1]) : 
        null;
      
      if (fullHref && imageSrc && cleanTitle) {
        results.push({
          href: fullHref,
          image: imageSrc,
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
    const response = await fetchv2(url);
    const htmlText = await response.text();
    
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
  const htmlText = await (await fetchv2(actualUrl)).text();
      const animeIdMatch = (htmlText.match(/<div class="rate-box"[^>]*data-id="([^"]+)"/) || [])[1];
      if (!animeIdMatch) return JSON.stringify([{ error: "AniID not found" }]);

      const tokenResponse = await fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(animeIdMatch)}`);
      const tokenData = await tokenResponse.json();
      const token = tokenData.result;

      const episodeListUrl = `https://anikai.to/ajax/episodes/list?ani_id=${animeIdMatch}&_=${token}`;
      const episodeListData = await (await fetchv2(episodeListUrl)).json();
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    };

    let actualUrl = url;
    try {
      const tokenMatch = actualUrl.match(/token=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        const rawToken = tokenMatch[1];
        const encryptResponse = await fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(rawToken)}`);
        const encryptData = await encryptResponse.json();
        const encryptedToken = encryptData.result;
        actualUrl = actualUrl.replace('&_=ENCRYPT_ME', `&_=${encryptedToken}`);
      }
      
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

      const subRegex = /<div class="server-items lang-group" data-id="sub"[^>]*>([\s\S]*?)<\/div>/;
      const softsubRegex = /<div class="server-items lang-group" data-id="softsub"[^>]*>([\s\S]*?)<\/div>/;
      const dubRegex = /<div class="server-items lang-group" data-id="dub"[^>]*>([\s\S]*?)<\/div>/;
      const subMatch = subRegex.exec(serverHtmlSource);
      const softsubMatch = softsubRegex.exec(serverHtmlSource);
      const dubMatch = dubRegex.exec(serverHtmlSource);

      const subContent = subMatch ? subMatch[1].trim() : "";
      const softsubContent = softsubMatch ? softsubMatch[1].trim() : "";
      const dubContent = dubMatch ? dubMatch[1].trim() : "";

      const extractServerId = (content) => {
        if (!content) return null;
        const preferred = /<span class="server"[^>]*data-lid="([^"]+)"[^>]*>\s*Server\s*1\s*<\/span>/i.exec(content);
        if (preferred?.[1]) return preferred[1];
        return /<span class="server"[^>]*data-lid="([^"]+)"/i.exec(content)?.[1] || null;
      };

      const serverIdDub = extractServerId(dubContent);
      const serverIdSoftsub = extractServerId(softsubContent);
      const serverIdSub = extractServerId(subContent);

      const tokenRequestData = [
        { name: "Dub", data: serverIdDub },
        { name: "Softsub", data: serverIdSoftsub },
        { name: "Sub", data: serverIdSub }
      ].filter(item => item.data);

      const tokenPromises = tokenRequestData.map(item => 
        fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(item.data)}`)
          .then(res => res.json())
          .then(json => ({ name: item.name, data: json.result }))
          .catch(err => ({ name: item.name, error: err.toString() }))
      );
      const tokenResults = await Promise.all(tokenPromises);

      const serverIdMap = {
        "Dub": serverIdDub,
        "Softsub": serverIdSoftsub,
        "Sub": serverIdSub
      };

      const streamUrls = tokenResults.map(result => ({
        type: result.name,
        url: `https://anikai.to/ajax/links/view?id=${serverIdMap[result.name]}&_=${result.data}`
      }));

      const streamResponses = await Promise.all(
        streamUrls.map(async ({ type, url }) => {
          try {
            const res = await fetchv2(url);
            const json = await res.json();
            return { type, result: json.result };
          } catch {
            return { type, result: null };
          }
        })
      );

      const decryptPromises = streamResponses
        .filter(item => item.result)
        .map(item =>
          fetchv2(`https://enc-dec.app/api/dec-kai?text=${item.result}`, headers)
            .then(res => res.json())
            .then(json => ({ name: item.type, url: json.result?.url || null }))
            .catch(() => ({ name: item.type, url: null }))
        );
      const decryptResults = await Promise.all(decryptPromises);

      const urlMap = Object.fromEntries(decryptResults.map(i => [i.name, i.url]));

      const decryptedSub = urlMap.Sub;
      const decryptedDub = urlMap.Dub;
      const decryptedRaw = urlMap.Softsub;

      async function getStream(url) {
        try {
          const response = await fetchv2(url.replace("/e/", "/media/"), headers);
          const responseJson = await response.json();
          const result = responseJson?.result;

          const finalResponse = await fetchv2(
            "https://enc-dec.app/api/dec-mega",
            { "Content-Type": "application/json" },
            "POST",
            JSON.stringify({ text: result, agent: headers["User-Agent"] })
          );

          const finalJson = await finalResponse.json();
          return finalJson?.result?.sources?.[0]?.file || null;
        } catch {
          return null;
        }
      }

      const [subStream, dubStream, rawStream] = await Promise.all([
        decryptedSub ? getStream(decryptedSub) : Promise.resolve(null),
        decryptedDub ? getStream(decryptedDub) : Promise.resolve(null),
        decryptedRaw ? getStream(decryptedRaw) : Promise.resolve(null)
      ]);

      console.log("[extractStreamUrl] Sub:", subStream, "Dub:", dubStream, "Softsub:", rawStream);

      const streams = [];
      if (subStream) streams.push({ title: "Hardsub English", streamUrl: subStream });
      if (dubStream) streams.push({ title: "Dubbed English",  streamUrl: dubStream });
      if (rawStream) streams.push({ title: "Original audio",  streamUrl: rawStream });

      return JSON.stringify({ streams, subtitles: "" });

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
