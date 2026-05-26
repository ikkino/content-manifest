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
  try {
    const tokenMatch = url.match(/token=([^&]+)/);
    if (tokenMatch && tokenMatch[1]) {
      const rawToken = tokenMatch[1];
      const encryptResponse = await fetchv2(`https://enc-dec.app/api/enc-kai?text=${encodeURIComponent(rawToken)}`);
      const encryptData = await encryptResponse.json();
      const encryptedToken = encryptData.result;
      url = url.replace('&_=ENCRYPT_ME', `&_=${encryptedToken}`);
    }
    
    const fetchUrl = `${url}`;
    const response = await fetchv2("https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(fetchUrl));
    const text = await response.text();
    const cleanedHtml = cleanJsonHtml(text);
    const subRegex = /<div class="server-items lang-group" data-id="sub"[^>]*>([\s\S]*?)<\/div>/;
    const softsubRegex = /<div class="server-items lang-group" data-id="softsub"[^>]*>([\s\S]*?)<\/div>/;
    const dubRegex = /<div class="server-items lang-group" data-id="dub"[^>]*>([\s\S]*?)<\/div>/;
    const subMatch = subRegex.exec(cleanedHtml);
    const softsubMatch = softsubRegex.exec(cleanedHtml);
    const dubMatch = dubRegex.exec(cleanedHtml);
    const subContent = subMatch ? subMatch[1].trim() : "";
    const softsubContent = softsubMatch ? softsubMatch[1].trim() : "";
    const dubContent = dubMatch ? dubMatch[1].trim() : "";
    const serverSpanRegex = /<span class="server"[^>]*data-lid="([^"]+)"[^>]*>Server 1<\/span>/;
    const serverIdDub = serverSpanRegex.exec(dubContent)?.[1];
    const serverIdSoftsub = serverSpanRegex.exec(softsubContent)?.[1];
    const serverIdSub = serverSpanRegex.exec(subContent)?.[1];

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

    const streamUrls = tokenResults.map(result => {
      const serverIdMap = {
        "Dub": serverIdDub,
        "Softsub": serverIdSoftsub,
        "Sub": serverIdSub
      };
      return {
        type: result.name,
        url: `https://anikai.to/ajax/links/view?id=${serverIdMap[result.name]}&_=${result.data}`
      };
    });

    const processStreams = async (streamUrls) => {
      const streamResponses = await Promise.all(
        streamUrls.map(async ({ type, url }) => {
          try {
            const res = await fetchv2("https://deno-proxies-sznvnpnxwhbv.deno.dev/?url=" + encodeURIComponent(url));
            const json = await res.json();
            return {
              type: type,
              result: json.result
            };
          } catch (error) {
            console.log(`Error fetching ${type} stream:`, error);
            return {
              type: type,
              result: null
            };
          }
        })
      );

      const decryptRequestData = streamResponses
        .filter(item => item.result)
        .map(item => ({
          name: item.type,
          data: item.result
        }));

      if (decryptRequestData.length === 0) {
        return {};
      }

      const decryptPromises = decryptRequestData.map(item => 
        fetchv2(`https://enc-dec.app/api/dec-kai?text=${encodeURIComponent(item.data)}`)
          .then(res => res.json())
          .then(json => ({ name: item.name, data: JSON.stringify(json.result) }))
          .catch(err => ({ name: item.name, error: err.toString() }))
      );
      const decryptResults = await Promise.all(decryptPromises);

      const finalResults = {};
      decryptResults.forEach(result => {
        try {
          const parsed = JSON.parse(result.data);
          finalResults[result.name] = parsed.url;
          console.log(`decrypted${result.name} URL:` + parsed.url);
        } catch (error) {
          console.log(`Error parsing ${result.name} result:`, error);
          finalResults[result.name] = null;
        }
      });

      return finalResults;
    };

    const decryptedUrls = await processStreams(streamUrls);
    const decryptedSoftsub = decryptedUrls.Softsub || decryptedUrls.Dub || decryptedUrls.Sub;

    const headers = {
      "Referer": "https://anikai.to/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    };

    if (decryptedSoftsub) {
      const mediaUrl = decryptedSoftsub.replace("/e/", "/media/");
      const response = await fetchv2(mediaUrl, headers);
      const responseJson = await response.json();
      const result = responseJson?.result;

      const postData = {
        "text": result,
        "agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
      }

      const finalResponse = await fetchv2("https://enc-dec.app/api/dec-mega", { "Content-Type": "application/json" }, "POST", JSON.stringify(postData));
      const finalJson = await finalResponse.json();

      const m3u8Link = finalJson?.result?.sources?.[0]?.file;

      const tracks = finalJson?.result?.tracks || [];
      const arabicSub = tracks.find(track => track.label && (track.label.includes("Arabic") || track.label.includes("العربية")));
      let subtitleUrl = null;
      if (arabicSub) {
        subtitleUrl = arabicSub.file;
      } else {
        const englishSub = tracks.find(track => track.label && track.label.includes("English"));
        if (englishSub) {
          subtitleUrl = englishSub.file;
        }
      }

      const finalResult = {
        stream: m3u8Link,
        subtitles: subtitleUrl ? "https://deno-proxies-sznvnpnxwhbv.deno.dev/?url="+ encodeURIComponent(subtitleUrl) : null
      };
      return JSON.stringify(finalResult);
    }

    return "error";
  } catch (error) {
    console.log("Fetch error:"+ error);
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
