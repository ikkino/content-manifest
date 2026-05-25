async function searchResults(keyword) {
    const results = [];
    const headers = {
        "Content-Type": "multipart/form-data; boundary=----geckoformboundary38c356867533a17de80e8c65d9125df5"
    };
    const postData = `------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="s_keyword"

${keyword}
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="orderby"

popular
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="order"

DESC
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="action"

advanced_search
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="page"

1
------geckoformboundary38c356867533a17de80e8c65d9125df5--`;

    try {
        const response = await fetchv2("https://an1me.to/wp-admin/admin-ajax.php", headers, "POST", postData);
        const data = await response.json();
        const html = data.data.html;
        const articlePattern = /<article[^>]*class="anime-card[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
        let articleMatch;
        
        while ((articleMatch = articlePattern.exec(html)) !== null) {
            const articleHtml = articleMatch[1];
            
            const imgMatch = articleHtml.match(/<img[^>]+src=['"]([^'"]+)['"][^>]+alt=['"]([^'"]+)['"]/);
            

            const linkMatch = articleHtml.match(/<h3[^>]*>[\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]*title=['"]([^'"]+)['"]/);
            
            if (imgMatch && linkMatch) {
                results.push({
                    title: linkMatch[2].trim(),
                    image: imgMatch[1].trim(),
                    href: linkMatch[1].trim()
                });
            }
        }
        
        return JSON.stringify(results);
    } catch (err) {
        console.log(err);
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const match = html.match(
            /<div class="anime-synopsis">[\s\S]*?<p>([\s\S]*?)<\/p>/
        );

        const description = match
            ? match[1].replace(/\s+/g, " ").trim()
            : "N/A";

        return JSON.stringify([{
            description,
            aliases: "N/A",
            airdate: "N/A"
        }]);
    } catch {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}


async function extractEpisodes(url) {
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        

        const regex = /<a href="([^"]+)"[^>]*class="episode-list-display-box episode-list-item[^"]*"[^>]*>[\s\S]*?<span class="episode-list-item-number">\s*(\d+)\s*<\/span>/g;
        
        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: match[1].trim(),
                number: parseInt(match[2], 10)
            });
        }
        
        if (results.length === 0 && url) {
            results.push({
                href: url,
                number: 1
            });
        }
        
        return JSON.stringify(results);
    } catch (err) {
        console.log(err);
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        const sources = await getSourcesFromEpisode(url);
        if(sources == null) return null;

        const streams = await extractStreamsFromSources(sources);
        if(streams == null) return null;
        console.log("Streams: " + JSON.stringify(streams));

        const streamUrl = streams[0].stream;
        console.log("Stream URL: " + streamUrl);
        return streamUrl;
    } catch (err) {
        return "https://files.catbox.moe/avolvc.mp4";
    }
}

async function getSourcesFromEpisode(url) {
    const sources = [];
    try {
        const res = await fetchv2(url);
        const html = await res.text();

        const regex = /<span[^>]+data-embed-id="([^"]+)"[^>]*>/gi;
        let match;

        while ((match = regex.exec(html)) !== null) {
            const dataEmbedId = match[1];
            const [_, iframeBase64] = dataEmbedId.split(":");
            if (!iframeBase64) continue;

            const iframeHtml = atob(iframeBase64);

            const srcMatch = iframeHtml.match(/src\s*=\s*["']([^"']+)["']/i);
            if (!srcMatch) continue;

            const isSub = /class="[^"]*player-sub[^"]*"/.test(match[0]);

            sources.push({
                source: srcMatch[1],
                audio: isSub ? 'original' : 'Greek'
            });
        }

        return sources;
    } catch (e) {
        console.error('Error extracting source: ' + e.message);
        return [];
    }
}

async function extractStreamsFromSources(sources) {
  const streams = [];

  for(let source of sources) {
      try {
          const res = await fetchv2(source.source);
          const html = await res.text();

          const jsonString = html.match(/params[\s]*=[\s]*(\{[^;]*);/)?.[1];
          if(jsonString == null) continue;

          const json = JSON.parse(jsonString);
          if(json?.sources == null || json.sources.length <= 0) continue;

          for(let s of json.sources) {
              const resolution = s?.html ?? null;
              let arrayLength = streams.push(source);
              let i = arrayLength - 1;

              streams[i].stream = s.url;
              streams[i].resolution = resolution != null ? resolution.slice(0, -1) : null;
          }

          
      } catch(e) {
          console.warn('Error extracting stream: ' + e.message);
      }
  }

  return streams.filter(source => source.stream != null);
}
