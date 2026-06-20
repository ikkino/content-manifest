async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Referer': 'https://animetsu.live/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const encodedKeyword = encodeURIComponent(keyword);
    const response = await fetchv2(`https://animetsu.live/v2/api/anime/search/?query=${encodedKeyword}`, headers);
    const json = await response.json();

    json.results.forEach(anime => {
        const title = anime.title.english || anime.title.romaji || anime.title.native || "Unknown Title";
        const image = anime.cover_image.large;
        const href = `${anime.id}`;

        if (title && href && image) {
            results.push({
                title: title,
                image: image,
                href: href
            });
        } else {
            console.error("Missing or invalid data in search result item:", {
                title,
                href,
                image
            });
        }
    });

    return JSON.stringify(results);
}

async function extractDetails(id) {
    const results = [];
    const headers = {
        'Referer': 'https://animetsu.live/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const response = await fetchv2(`https://animetsu.live/v2/api/anime/info/${id}`, headers);
    const json = await response.json();

    const description = cleanHtmlSymbols(json.description) || "No description available";

    results.push({
        description: description.replace(/<br>/g, ''),
        aliases: json.synonyms ? json.synonyms.join(', ') : 'N/A',
        airdate: json.start_date || 'N/A'
    });

    return JSON.stringify(results);
}

async function extractEpisodes(id) {
    const results = [];
    const headers = {
        'Referer': 'https://animetsu.live/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const response = await fetchv2(`https://animetsu.live/v2/api/anime/eps/${id}`, headers);
    const json = await response.json();

    for (const ep of json) {
        results.push({
            number: ep.ep_num,
            href: `&id=${id}&num=${ep.ep_num}`
        });
    }

    return JSON.stringify(results);
}

async function extractStreamUrl(slug) {
    const headers = {
        'Referer': 'https://animetsu.live/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const id = (slug.match(/[?&]id=([^&]+)/) || [])[1];
    const num = (slug.match(/[?&]num=([^&]+)/) || [])[1];

    const streams = [];

    try {
        const serverListRes = await fetchv2(`https://animetsu.live/v2/api/anime/servers/${id}/${num}`, headers);
        const serverList = await serverListRes.json();

        const promises = [];
        for (const server of serverList) {
            for (const subType of ['sub', 'dub']) {
                promises.push((async () => {
                    try {
                        const url = `https://animetsu.live/v2/api/anime/oppai/${id}/${num}?server=${server.id}&source_type=${subType}`;
                        const res = await fetchv2(url, headers);
                        const data = await res.json();

                        if (data?.sources?.length) {
                            for (const source of data.sources) {
                                let streamUrl = `https://swiftstream.top/proxy${source.url}`;
                                let quality = source.quality;

                                if (server.id === 'kite') {
                                    try {
                                        const m3u8Res = await fetchv2(streamUrl, headers);
                                        const m3u8Content = await m3u8Res.text();
                                        const lines = m3u8Content.split('\n').filter(line => line.trim() !== '');
                                        const targetLine = lines.find(line => !line.startsWith('#'));
                                        if (targetLine) {
                                            streamUrl = `https://swiftstream.top/proxy/oppai/kite/${targetLine.trim()}`;
                                        }
                                        if (quality.toLowerCase() === 'master') {
                                            quality = '1080p';
                                        }
                                    } catch (e) {
                                        console.error("Error rewriting kite URL:", e);
                                    }
                                }

                                streams.push({
                                    title: `${server.id} - ${quality} - ${subType.toUpperCase()}`,
                                    streamUrl: streamUrl,
                                    headers: headers
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`Error fetching streams for server ${server.id} (${subType}):`, e);
                    }
                })());
            }
        }

        await Promise.all(promises);
    } catch (e) {
        console.error("Error fetching server list:", e);
    }

    const serverOrder = { 'pahe': 1, 'meg': 2, 'kite': 3 };
    const qualityOrder = (q) => {
        if (q.includes('1080')) return 1;
        if (q.includes('720')) return 2;
        if (q.includes('480')) return 3;
        if (q.includes('360')) return 4;
        if (q.includes('master')) return 5;
        return 6;
    };

    streams.sort((a, b) => {
        const partsA = a.title.split(' - ');
        const partsB = b.title.split(' - ');

        const sA = partsA[0].toLowerCase();
        const sB = partsB[0].toLowerCase();
        const qA = partsA[1].toLowerCase();
        const qB = partsB[1].toLowerCase();

        const qOrderA = qualityOrder(qA);
        const qOrderB = qualityOrder(qB);

        if (qOrderA !== qOrderB) return qOrderA - qOrderB;

        const sOrderA = serverOrder[sA] || 99;
        const sOrderB = serverOrder[sB] || 99;
        return sOrderA - sOrderB;
    });

    const finalStreams = streams.map((s, index) => ({
        ...s,
        title: `[Server ${index + 1}] ${s.title}`
    }));

    const final = {
        streams: finalStreams,
        subtitle: ""
    };

    return JSON.stringify(final);
}




function cleanHtmlSymbols(string) {
    if (!string) return "";

    return string
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#[0-9]+;/g, "")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .replace(/<i[^>]*>(.*?)<\/i>/g, "$1")
        .replace(/<b[^>]*>(.*?)<\/b>/g, "$1")
        .replace(/<[^>]+>/g, "")
        .trim();
}
