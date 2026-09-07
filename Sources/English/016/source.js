// Hexa Media Source Module

async function searchResults(keyword) {
    try {
        let transformedResults = [];

        const keywordGroups = {
            trending: ["!trending", "!hot", "!tr", "!!"],
            topRatedMovie: ["!top-rated-movie", "!topmovie", "!tm", "??"],
            topRatedTV: ["!top-rated-tv", "!toptv", "!tt", "::"],
            popularMovie: ["!popular-movie", "!popmovie", "!pm", ";;"],
            popularTV: ["!popular-tv", "!poptv", "!pt", "++"],
        };

        const skipTitleFilter = Object.values(keywordGroups).flat();
        const shouldFilter = !matchesKeyword(keyword, skipTitleFilter);

        const encodedKeyword = encodeURIComponent(keyword);
        let baseUrlTemplate = null;

        if (matchesKeyword(keyword, keywordGroups.trending)) {
            baseUrlTemplate = (page) => `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/trending/all/week?api_key=9801b6b0548ad57581d111ea690c85c8&include_adult=false&page=${page}`)}&simple=true`;
        } else if (matchesKeyword(keyword, keywordGroups.topRatedMovie)) {
            baseUrlTemplate = (page) => `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/movie/top_rated?api_key=9801b6b0548ad57581d111ea690c85c8&include_adult=false&page=${page}`)}&simple=true`;
        } else if (matchesKeyword(keyword, keywordGroups.topRatedTV)) {
            baseUrlTemplate = (page) => `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/top_rated?api_key=9801b6b0548ad57581d111ea690c85c8&include_adult=false&page=${page}`)}&simple=true`;
        } else if (matchesKeyword(keyword, keywordGroups.popularMovie)) {
            baseUrlTemplate = (page) => `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/movie/popular?api_key=9801b6b0548ad57581d111ea690c85c8&include_adult=false&page=${page}`)}&simple=true`;
        } else if (matchesKeyword(keyword, keywordGroups.popularTV)) {
            baseUrlTemplate = (page) => `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/popular?api_key=9801b6b0548ad57581d111ea690c85c8&include_adult=false&page=${page}`)}&simple=true`;
        } else {
            baseUrlTemplate = (page) => `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/search/multi?api_key=9801b6b0548ad57581d111ea690c85c8&query=${encodedKeyword}&include_adult=false&page=${page}`)}&simple=true`;
        }

        let dataResults = [];

        if (baseUrlTemplate) {
            const pagePromises = Array.from({ length: 5 }, (_, i) =>
                soraFetch(baseUrlTemplate(i + 1)).then(r => r ? r.json() : { results: [] })
            );
            const pages = await Promise.all(pagePromises);
            dataResults = pages.flatMap(p => p.results || []);
        }

        if (dataResults.length > 0) {
            transformedResults = transformedResults.concat(
                dataResults
                    .map(result => {
                        if (result.media_type === "movie" || result.title) {
                            return {
                                title: result.title || result.name || result.original_title || result.original_name || "Untitled",
                                image: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : "",
                                href: `movie/${result.id}`,
                            };
                        } else if (result.media_type === "tv" || result.name) {
                            return {
                                title: result.name || result.title || result.original_name || result.original_title || "Untitled",
                                image: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : "",
                                href: `tv/${result.id}/1/1`,
                            };
                        }
                    })
                    .filter(Boolean)
                    .filter(r => !shouldFilter || r.title.toLowerCase().includes(keyword.toLowerCase()))
            );
        }

        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log("Fetch error in searchResults: " + error);
        return JSON.stringify([{ title: "Error", image: "", href: "" }]);
    }
}

function matchesKeyword(keyword, commands) {
    const lower = keyword.toLowerCase();
    return commands.some(cmd => lower.startsWith(cmd.toLowerCase()));
}

async function extractDetails(url) {
    try {
        if (url.includes('movie')) {
            const match = url.match(/movie\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const movieId = match[1];
            const responseText = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/movie/${movieId}?api_key=ad301b7cc82ffe19273e55e4d4206885`)}&simple=true`);
            const data = await responseText.json();

            const transformedResults = [{
                description: data.overview || 'No description available',
                aliases: `Duration: ${data.runtime ? data.runtime + " minutes" : 'Unknown'}`,
                airdate: `Released: ${data.release_date ? data.release_date : 'Unknown'}`
            }];

            return JSON.stringify(transformedResults);
        } else if (url.includes('tv')) {
            const match = url.match(/tv\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const showId = match[1];
            const responseText = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/${showId}?api_key=ad301b7cc82ffe19273e55e4d4206885`)}&simple=true`);
            const data = await responseText.json();

            const transformedResults = [{
                description: data.overview || 'No description available',
                aliases: `Duration: ${data.episode_run_time && data.episode_run_time.length ? data.episode_run_time.join(', ') + " minutes" : 'Unknown'}`,
                airdate: `Aired: ${data.first_air_date ? data.first_air_date : 'Unknown'}`
            }];

            return JSON.stringify(transformedResults);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Details error: ' + error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired/Released: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        if (url.includes('movie')) {
            const match = url.match(/movie\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");
            const movieId = match[1];

            const movie = [
                { href: `/movie/${movieId}`, number: 1, title: "Full Movie" }
            ];
            return JSON.stringify(movie);
        } else if (url.includes('tv')) {
            const match = url.match(/tv\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");
            const showId = match[1];

            const showResponseText = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/${showId}?api_key=ad301b7cc82ffe19273e55e4d4206885`)}&simple=true`);
            const showData = await showResponseText.json();

            let allEpisodes = [];
            for (const season of showData.seasons) {
                const seasonNumber = season.season_number;
                if (seasonNumber === 0) continue;

                const seasonResponseText = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=ad301b7cc82ffe19273e55e4d4206885`)}&simple=true`);
                const seasonData = await seasonResponseText.json();

                if (seasonData.episodes && seasonData.episodes.length) {
                    const episodes = seasonData.episodes.map(episode => ({
                        href: `/tv/${showId}/${seasonNumber}/${episode.episode_number}`,
                        number: episode.episode_number,
                        title: episode.name || ""
                    }));
                    allEpisodes = allEpisodes.concat(episodes);
                }
            }
            return JSON.stringify(allEpisodes);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Fetch error in extractEpisodes: ' + error);
        return JSON.stringify([]);
    }
}

function generateHexKey() {
    let hex = "";
    const chars = "0123456789abcdef";
    for (let i = 0; i < 64; i++) {
        hex += chars[Math.floor(Math.random() * 16)];
    }
    return hex;
}

async function extractStreamUrl(ID) {
    try {
        let isMovie = ID.includes('movie');
        let tmdbID, seasonNumber = "1", episodeNumber = "1";
        let mediaType = "";

        if (isMovie) {
            tmdbID = ID.replace('/movie/', '').replace('/', '');
            mediaType = "movie";
        } else if (ID.includes('tv')) {
            const parts = ID.split('/');
            tmdbID = parts[2];
            seasonNumber = parts[3];
            episodeNumber = parts[4];
            mediaType = "tv";
        } else {
            return JSON.stringify({ streams: [] });
        }

        const key = generateHexKey();

        const encHexaRes = await soraFetch("https://enc-dec.app/api/enc-hexa");
        if (!encHexaRes) throw new Error("Failed to get challenge token");
        const encHexaJson = await encHexaRes.json();
        const token = encHexaJson.result.token;

        const targetUrl = mediaType === "movie"
            ? `https://theemoviedb.hexa.su/api/tmdb/movie/${tmdbID}/images`
            : `https://theemoviedb.hexa.su/api/tmdb/tv/${tmdbID}/season/${seasonNumber}/episode/${episodeNumber}/images`;

        const response = await soraFetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
                "Referer": "https://hexa.su/",
                "Accept": "text/plain",
                "X-Fingerprint-Lite": "e9136c41504646444",
                "X-Api-Key": key,
                "X-Cap-Token": token
            }
        });
        if (!response) throw new Error("Failed to fetch encrypted source data");
        const encryptedText = await response.text();

        const decHeaders = {
            "Content-Type": "application/json"
        };
        const postData = JSON.stringify({
            text: encryptedText,
            key: key
        });
        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-hexa", decHeaders, "POST", postData);
        const decryptedJson = await decryptedResponse.json();

        if (decryptedJson.status !== 200 || !decryptedJson.result) {
            throw new Error(decryptedJson.error || "Decryption failed");
        }

        const sources = decryptedJson.result.sources || [];
        const streamObjects = sources.map(src => ({
            title: `[Hexa] ${src.server}`,
            streamUrl: src.url,
            headers: {
                "Referer": "https://hexa.su/",
                "Origin": "https://hexa.su"
            }
        }));

        if (streamObjects.length === 0) {
            const fallbackUrl = mediaType === "movie"
                ? `https://vidlink.pro/movie/${tmdbID}`
                : `https://vidlink.pro/tv/${tmdbID}/${seasonNumber}/${episodeNumber}`;
            streamObjects.push({
                title: "VidLink Backup",
                streamUrl: fallbackUrl,
                headers: { "Referer": "https://vidlink.pro/" }
            });
        }

        return JSON.stringify({
            streams: streamObjects,
            subtitles: ""
        });
    } catch (e) {
        console.log("Error in extractStreamUrl: " + e.message);
        let fallbackUrl = "https://vidlink.pro/";
        if (ID.includes('movie')) {
            const mId = ID.replace('/movie/', '').replace('/', '');
            fallbackUrl = `https://vidlink.pro/movie/${mId}`;
        } else if (ID.includes('tv')) {
            const parts = ID.split('/');
            fallbackUrl = `https://vidlink.pro/tv/${parts[2]}/${parts[3]}/${parts[4]}`;
        }
        return JSON.stringify({ streams: [{ title: "VidLink Backup", streamUrl: fallbackUrl, headers: { Referer: "https://vidlink.pro/" } }], subtitles: "" });
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    if (!headers["User-Agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }
    try {
        return await fetchv2(url, headers, options.method || 'GET', options.body || null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}
