// Sora module for VidUp using enc-dec.app API

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
                soraFetch(baseUrlTemplate(i + 1)).then(r => r.json())
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
                    .filter(result => result.title !== "Overflow")
                    .filter(result => result.title !== "My Marriage Partner Is My Student, a Cocky Troublemaker")
                    .filter(r => !shouldFilter || r.title.toLowerCase().includes(keyword.toLowerCase()))
            );
        }

        console.log("Transformed Results: " + JSON.stringify(transformedResults));
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

            console.log(JSON.stringify(transformedResults));
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

            console.log(movie);
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

            console.log(allEpisodes);
            return JSON.stringify(allEpisodes);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Fetch error in extractEpisodes: ' + error);
        return JSON.stringify([]);
    }
}

function getQualityWeight(title) {
    if (title.includes("2160p") || title.includes("4K")) return 2160;
    if (title.includes("1080p")) return 1080;
    if (title.includes("720p")) return 720;
    if (title.includes("480p")) return 480;
    if (title.includes("360p")) return 360;
    if (title.includes("Auto")) return 1;
    return 0;
}

async function extractStreamUrl(ID) {
    try {
        let isMovie = ID.includes('movie');
        let tmdbID, seasonNumber = "1", episodeNumber = "1";
        let mediaType = "";

        const idParts = ID.split('/').filter(Boolean);
        if (isMovie) {
            tmdbID = idParts[idParts.length - 1];
            mediaType = "movie";
        } else if (ID.includes('tv')) {
            tmdbID = idParts[1];
            seasonNumber = idParts[2];
            episodeNumber = idParts[3];
            mediaType = "tv";
        } else {
            return JSON.stringify({ streams: [] });
        }

        const base_url = mediaType === "movie" 
            ? `https://vidup.to/movie/${tmdbID}` 
            : `https://vidup.to/tv/${tmdbID}/${seasonNumber}/${episodeNumber}/`;

        const requestHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
            "Referer": "https://vidup.to/",
            "X-Requested-With": "XMLHttpRequest"
        };

        const pageRes = await soraFetch(base_url, { headers: requestHeaders });
        if (!pageRes) throw new Error("Failed to fetch VidUp page");
        const html = await pageRes.text();

        let match = html.match(/\\"(?:en|token)\\":\\"(.*?)\\"/) || html.match(/"(?:en|token)":"(.*?)"/);
        if (!match) throw new Error("No match for key in page response");
        const text = match[1];

        const API = "https://enc-dec.app/api";
        const enc_vidup = `${API}/enc-vidup?text=${encodeURIComponent(text)}`;
        const encRes = await soraFetch(enc_vidup);
        if (!encRes) throw new Error("Failed to encrypt vidup text");
        const encData = await encRes.json();
        
        if (encData.status !== 200) throw new Error("VidUp encryption API error");
        const parts = encData.result;
        const serversUrl = parts.servers;
        const streamBase = parts.stream;
        const token = parts.token;

        requestHeaders["X-CSRF-Token"] = token;

        const serversRes = await soraFetch(serversUrl, { method: "POST", headers: requestHeaders });
        if (!serversRes) throw new Error("Failed to fetch servers list");
        const servers_encrypted = await serversRes.text();

        const dec_vidup = `${API}/dec-vidup`;
        const decServersRes = await fetchv2(dec_vidup, { "Content-Type": "application/json" }, "POST", JSON.stringify({ text: servers_encrypted }));
        const decServersData = await decServersRes.json();
        if (decServersData.status !== 200) throw new Error("VidUp decryption API error for servers");
        const servers_decrypted = decServersData.result;

        let streamObjects = [];
        let allSubtitles = [];

        for (const server of servers_decrypted) {
            try {
                const streamUrl = `${streamBase}/${server.data}`;
                const streamRes = await soraFetch(streamUrl, { method: "POST", headers: requestHeaders });
                if (!streamRes) continue;
                const stream_encrypted = await streamRes.text();

                const decStreamRes = await fetchv2(dec_vidup, { "Content-Type": "application/json" }, "POST", JSON.stringify({ text: stream_encrypted }));
                const decStreamData = await decStreamRes.json();
                if (decStreamData.status !== 200) continue;
                const stream_decrypted = decStreamData.result;

                if (stream_decrypted && stream_decrypted.url) {
                    streamObjects.push({
                        title: `[VidUp - ${server.name}] ${server.description || 'HLS'}`,
                        streamUrl: stream_decrypted.url,
                        headers: {
                            "Origin": "https://vidup.to",
                            "Referer": stream_decrypted.noReferrer ? "" : "https://vidup.to/",
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
                            ...(stream_decrypted.headers || {})
                        }
                    });
                }

                if (stream_decrypted && stream_decrypted.tracks) {
                    stream_decrypted.tracks.forEach(track => {
                        if (track.file && !allSubtitles.some(existing => existing.file === track.file)) {
                            allSubtitles.push(track);
                        }
                    });
                }
            } catch (serverErr) {
                console.log(`Error processing VidUp server ${server.name}: ${serverErr}`);
            }
        }

        streamObjects.sort((a, b) => {
            const weightA = getQualityWeight(a.title);
            const weightB = getQualityWeight(b.title);
            return weightB - weightA;
        });

        const englishSubtitle = allSubtitles.find(sub => (sub.label || sub.lang || sub.language || '').toLowerCase() === 'english');
        let subtitleUrl = englishSubtitle ? englishSubtitle.file : "";

        if (subtitleUrl) {
            subtitleUrl = `https://passthrough-worker.simplepostrequest.workers.dev/?url=${encodeURIComponent(subtitleUrl)}&type=vtt&referer=https%3A%2F%2Fvidup.to%2F`;
        }

        return JSON.stringify({
            streams: streamObjects,
            subtitles: subtitleUrl
        });
    } catch (error) {
        console.log('Fetch error in extractStreamUrl: ' + error);
        return JSON.stringify({ streams: [], subtitles: "" });
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
