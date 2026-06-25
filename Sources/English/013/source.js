async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://123animehub.cc/search?keyword=" + encodeURIComponent(keyword));
        const html = await response.text();

        const filmListMatch = html.match(/<div class="film-list">([\s\S]*?)<div class="clearfix"><\/div>/);
        if (!filmListMatch) {
            return JSON.stringify(results);
        }

        const filmList = filmListMatch[1];
        const itemRegex = /<div class="item">[\s\S]*?<a href="([^"]+)"[^>]*class="poster"[\s\S]*?<img[^>]*alt="([^"]+)"[^>]*src="([^"]+)"/g;
        let match;
        while ((match = itemRegex.exec(filmList)) !== null) {
            results.push({
                title: match[2].trim(),
                image: "https://123animehub.cc" + match[3].trim(),
                href: "https://123animehub.cc" + match[1].trim()
            });
        }

        const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, " ").trim();
        results.sort((a, b) => {
            const titleA = a.title.toLowerCase().replace(/\s+\((dub|sub)\)$/i, "").trim();
            const titleB = b.title.toLowerCase().replace(/\s+\((dub|sub)\)$/i, "").trim();
            const exactA = titleA === normalizedKeyword ? 0 : 1;
            const exactB = titleB === normalizedKeyword ? 0 : 1;
            if (exactA !== exactB) return exactA - exactB;
            return a.title.length - b.title.length;
        });

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

        let description = "N/A";
        let aliases = "N/A";
        let airdate = "N/A";

        const descMatch = html.match(/<div class="desc">([\s\S]*?)<\/div>/);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        }

        const aliasMatch = html.match(/<p class="alias">([^<]*)<\/p>/);
        if (aliasMatch) {
            aliases = aliasMatch[1].trim();
        }

        const airdateMatch = html.match(/<dt>Released:<\/dt>\s*<dd>\s*<a[^>]*>(\d+)<\/a>/);
        if (airdateMatch) {
            airdate = airdateMatch[1].trim();
        }

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
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
        const animeId = url.split('/').pop();

        const response = await fetchv2("https://123animehub.cc/ajax/film/sv?id=" + animeId);
        const jsonData = await response.json();
        const html = jsonData.html;

        const episodesMatch = html.match(/<ul class="episodes range"[^>]*>([\s\S]*?)<\/ul>/);
        if (!episodesMatch) {
            return JSON.stringify(results);
        }

        const episodesHTML = episodesMatch[1];

        const episodeRegex = /data-pop='(\d+)'/g;
        let match;
        const seenEpisodes = new Set();

        while ((match = episodeRegex.exec(episodesHTML)) !== null) {
            const episodeNum = parseInt(match[1], 10);

            if (!seenEpisodes.has(episodeNum)) {
                seenEpisodes.add(episodeNum);
                results.push({
                    href: animeId + "/" + episodeNum + "/vidstreaming.io",
                    number: episodeNum
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(ID) {
    try {
        const response = await fetchv2("https://123animehub.cc/ajax/episode/info?epr=" + encodeURIComponent(ID));
        const data = await response.json();
        const target = data.target;

        if (!target) throw new Error("No target in response: " + JSON.stringify(data));

        const responseTarget = await fetchv2(target);
        const htmlTarget = await responseTarget.text();
        const zrpart2Match = htmlTarget.match(/var\s+zrpart2\s*=\s*'([^']+)';/);
        if (!zrpart2Match) throw new Error("zrpart2 not found");
        const zrpart2 = zrpart2Match[1];

        const originMatch = target.match(/^(https?:\/\/[^\/]+)/);
        const origin = originMatch ? originMatch[1] : "";

        const hsUrl = `${origin}/hs/${zrpart2}`;
        const responseHs = await fetchv2(hsUrl);
        const htmlHs = await responseHs.text();
        const dataIdMatch = htmlHs.match(/id="mg-player"[^>]*data-id="([^"]+)"/);
        if (!dataIdMatch) throw new Error("data-id not found");
        const dataId = dataIdMatch[1];

        const sourcesUrl = `${origin}/hs/getSources?id=${dataId}`;
        const responseSources = await fetchv2(sourcesUrl);
        const dataSources = await responseSources.json();
        const headers = {
            "Referer": origin + "/",
            "Origin": origin,
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        };

        if (Array.isArray(dataSources.sources)) {
            return dataSources.sources.map((source, index) => {
                const streamUrl = typeof source === "string" ? source : (source.file || source.url || source.streamUrl || source.stream);
                return {
                    title: source?.label || source?.title || `Server ${index + 1}`,
                    streamUrl,
                    headers
                };
            }).filter((source) => source.streamUrl);
        }

        if (typeof dataSources.sources === "string") {
            return { streamUrl: dataSources.sources, headers };
        }

        return {
            streamUrl: dataSources.sources?.file || dataSources.sources?.url || dataSources.sources?.streamUrl || dataSources.sources?.stream,
            headers
        };
    } catch (err) {
        console.log("Stream URL Error details:", err.message, err.stack);
        return "https://error.org/";
    }
}
