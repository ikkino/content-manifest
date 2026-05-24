async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2(`https://e.kortw.cc/vodsearch/-------------.html?keyword=${keyword}`);
        const html = await response.text();
        
        const regex = /<li class="qy-mod-li[^>]*>[\s\S]*?<a href="([^"]+)"[\s\S]*?background-image:\s*url\(([^)]+)\)[\s\S]*?<span class="text-score">[^<]*<\/span>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<\/li>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[3].trim(),
                image: "https://www.nivod.cc" + match[2].trim(),
                href: "https://www.nivod.cc" + match[1].trim()
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
        const response = await fetchv2(url);
        const html = await response.text();

        const match = html.match(/id="show-desc">([\s\S]*?)<\/div>/);
        const description = match ? match[1].trim() : "N/A";

        return JSON.stringify([{
            description: description,
            aliases: "N/A",
            airdate: "N/A"
        }]);
    } catch (err) {
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

        const regex = /<a\s+href="([^"]+)">\s*<div\s+class="item"\s*>第(\d+)集<\/div>\s*<\/a>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: match[1].trim().startsWith('/') ? 'https://www.nivod.cc' + match[1].trim() : match[1].trim(),
                number: parseInt(match[2], 10)
            });
        }

        return JSON.stringify(results.reverse());
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const match = url.match(/\/vodplay\/(\d+)\/(ep\d+)/);
        if (!match) {
            return JSON.stringify({
                streams: [],
                subtitle: ""
            });
        }
        
        const videoId = match[1];
        const episodeId = match[2];
        const apiUrl = `https://www.nivod.cc/xhr_playinfo/${videoId}-${episodeId}`;
        
        const response = await fetchv2(apiUrl);
        const data = await response.json();
        console.log(JSON.stringify(data));
        const streams = [];
        
        if (data.pdatas && Array.isArray(data.pdatas)) {
            data.pdatas.forEach((item, index) => {
                const streamUrl = item.playurl;
                
                let hostname = '';
                const match = streamUrl.match(/^https?:\/\/([^\/]+)/);
                if (match) {
                    hostname = match[1];
                }
                
                streams.push({
                    title: `Server ${index + 1}`,
                    streamUrl: streamUrl,
                    headers: {
                        "Host": hostname,
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0",
                        "Accept": "*/*",
                        "Accept-Language": "en-US,en;q=0.5",
                        "Accept-Encoding": "gzip, deflate, br, zstd",
                        "Referer": "https://www.nivod.cc/",
                        "Origin": "https://www.nivod.cc",
                        "Connection": "keep-alive",
                        "Sec-Fetch-Dest": "empty",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Site": "cross-site"
                    }
                });
            });
        }
        
        return JSON.stringify({
            streams: streams,
            subtitle: ""
        });
    } catch (err) {
        return JSON.stringify({
            streams: [],
            subtitle: ""
        });
    }
}
