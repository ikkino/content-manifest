async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://eng.animeapps.top/api/search2.php?keyword=" + encodeURIComponent(keyword) + "&page=1&limit=200"); 
        const json = await response.json();
        
        if (json.status === "success" && json.data) {
            json.data.forEach(item => {
                let title = item.postname.trim();
                title = title.replace(/\s*\(Uncensored\)\s*$/i, '');
                title = title.replace(/\s*BD\s*$/i, '');
                title = title.trim();
                
                results.push({
                    title: title,
                    image: item.ani_cover_large,
                    href: "https://anibd.app/" + item.postid + "?anilist=" + item.anilist
                });
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const html = await (await fetchv2(url)).text();
        const match = html.match(/<div class="full-description">[\s\S]*?<h4[^>]*>Synopsis<\/h4>([\s\S]*?)<\/div>/);
        let description = "N/A";
        if (match && match[1]) {
            description = match[1]
                .replace(/<p[^>]*>/g, '').replace(/<\/p>/g, ' ').replace(/<br\s*\/?>/gi, ' ')
                .replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
                .replace(/\(Source:.*?\)\s*/gi, '').replace(/\s+/g, ' ').trim();
        }
        return JSON.stringify([{ description, aliases: "N/A", airdate: "N/A" }]);
    } catch (err) {
        return JSON.stringify([{ description: "Error", aliases: "Error", airdate: "Error" }]);
    }
}

async function extractEpisodes(url) {
    try {
        const postid = url.match(/(\d+)/)?.[1];
        if (!postid) return JSON.stringify([]);
        
        let anilist = url.match(/anilist=([\d]+)/)?.[1];
        if (!anilist) {
            const html = await (await fetchv2(url)).text();
            anilist = html.match(/const\s+EP_ID\s*=\s*["'](\d+)["']/)?.[1];
        }
        if (!anilist) return JSON.stringify([]);
        
        const json = await (await fetchv2("https://epeng.animeapps.top/api2.php?epid=" + anilist)).json();
        const results = [];
        if (Array.isArray(json)) {
            json.forEach(server => {
                server.server_data?.forEach(ep => {
                    results.push({
                        number: parseInt(ep.name, 10),
                        href: "https://anibd.app/playid/" + postid + "/?server=" + server.id + "&slug=" + ep.slug
                    });
                });
            });
        }
        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const pageHtml = await (await fetchv2(url)).text();
        const iframeUrl = pageHtml.match(/id="video-player-iframe"\s+src="([^"]+)"/)?.[1]?.replace(/&#038;/g, '&');
        if (!iframeUrl) return JSON.stringify({ streams: [], subtitle: "" });
        
        const iframeHtml = await (await fetchv2(iframeUrl, { "Referer": "https://anibd.app/" })).text();
        let streamUrl = iframeHtml.match(/url:\s*['"]([^'"]+\.m3u8)['"]/)?.[1] || iframeHtml.match(/videoUrl:\s*["']([^"']+\.m3u8)['"]/)?.[1];
        
        if (streamUrl) {
            const fullUrl = streamUrl.startsWith("/") ? "https://playeng.animeapps.top" + streamUrl : streamUrl.startsWith("http") ? streamUrl : "https://playeng.animeapps.top/r2/" + streamUrl;
            return JSON.stringify({
                streams: [{
                    title: "Server 1",
                    streamUrl: fullUrl,
                    headers: { "Referer": "https://anibd.app/" }
                }],
                subtitle: ""
            });
        }
        return JSON.stringify({ streams: [], subtitle: "" });
    } catch (err) {
        return JSON.stringify({ streams: [], subtitle: "" });
    }
}
