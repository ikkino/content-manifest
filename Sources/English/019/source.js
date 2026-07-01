//Thanks ibro for the TMDB search!

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

        // --- TMDB Section ---
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
        if(url.includes('movie')) {
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
        } else if(url.includes('tv')) {
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
        if(url.includes('movie')) {
            const match = url.match(/movie\/([^\/]+)/);
            
            if (!match) throw new Error("Invalid URL format");
            
            const movieId = match[1];
            
            const movie = [
                { href: `/movie/${movieId}`, number: 1, title: "Full Movie" }
            ];

            console.log(movie);
            return JSON.stringify(movie);
        } else if(url.includes('tv')) {
            const match = url.match(/tv\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
            
            if (!match) throw new Error("Invalid URL format");
            
            const showId = match[1];
            
            const showResponseText = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/${showId}?api_key=ad301b7cc82ffe19273e55e4d4206885`)}&simple=true`);
            const showData = await showResponseText.json();
            
            let allEpisodes = [];
            for (const season of showData.seasons) {
                const seasonNumber = season.season_number;

                if(seasonNumber === 0) continue;
                
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
    
    if (isMovie) {
        tmdbID = ID.replace('/movie/', '');
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

    const tmdbUrl = `https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/${mediaType}/${tmdbID}?api_key=ad301b7cc82ffe19273e55e4d4206885&append_to_response=external_ids&language=en`)}&simple=true`;
    const response = await soraFetch(tmdbUrl);
    if (!response) throw new Error("Failed to fetch TMDB details");
    const tmdbData = await response.json();

    const title = encodeURIComponent(tmdbData.title || tmdbData.name || "");
    const releaseDate = tmdbData.release_date || tmdbData.first_air_date || "";
    const year = releaseDate ? new Date(releaseDate).getFullYear() : "";
    const imdbId = tmdbData.external_ids?.imdb_id || "";
    const tmdbId = tmdbData.id;

    const servers = [
        { name: "Neon", endpoint: "mb-flix", flag: "🇺🇸" },
        { name: "Yoru", endpoint: "cdn", flag: "🇺🇸" },
        { name: "Tejo", endpoint: "tejo", flag: "🇺🇸" },
        { name: "Jett", endpoint: "jett", flag: "🇺🇸" },
        { name: "Cypher", endpoint: "downloader2", flag: "🇺🇸" },
        { name: "Sage", endpoint: "1movies", flag: "🇺🇸" },
        { name: "Breach", endpoint: "m4uhd", flag: "🇺🇸" },
        { name: "Vyse", endpoint: "hdmovie", flag: "🇺🇸" },
        { name: "Killjoy", endpoint: "meine", flag: "🇩🇪" },
        { name: "Fade", endpoint: "hdmovie", flag: "🇮🇳" },
        { name: "Omen", endpoint: "lamovie", flag: "🇲🇽" },
        { name: "Raze", endpoint: "superflix", flag: "🇧🇷" }
    ];

    let streamObjects = [];
    let allSubtitles = [];

    const serverPromises = servers.map(async (server) => {
        try {
            const fullUrl = `https://api.videasy.to/${server.endpoint}/sources-with-title?title=${title}&mediaType=${mediaType}&year=${year}&episodeId=${episodeNumber}&seasonId=${seasonNumber}&tmdbId=${tmdbId}&imdbId=${imdbId}`;
            
            const fetchOpts = {
                headers: {
                    "Referer": "https://player.videasy.to/",
                    "Origin": "https://player.videasy.to",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
            };
            const responseTwo = await soraFetch(fullUrl, fetchOpts);
            if (!responseTwo) return null;
            
            const encrypted = await responseTwo.text();
            if (!encrypted || encrypted.includes("Attention Required") || encrypted.includes("Cloudflare")) return null;

            const postData = JSON.stringify({
                text: encrypted.trim(),
                id: String(tmdbId)
            });

            const decryptHeaders = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
            };

            const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-videasy", decryptHeaders, "POST", postData);
            const decryptedData = await decryptedResponse.json();

            if (decryptedData && decryptedData.status === 200 && decryptedData.result) {
                let sources = decryptedData.result.sources || [];
                if (server.name === "Vyse") {
                    sources = sources.filter(e => e.quality === "English" || e.quality.includes("English"));
                } else if (server.name === "Fade") {
                    sources = sources.filter(e => e.quality === "Hindi" || e.quality.includes("Hindi"));
                }

                return {
                    serverName: server.name,
                    flag: server.flag,
                    sources: sources,
                    subtitles: decryptedData.result.subtitles || []
                };
            }
        } catch (err) {
            console.log(`Error fetching/decrypting stream for server ${server.name}: ` + err.message);
        }
        return null;
    });

    const results = await Promise.all(serverPromises);

    results.forEach(res => {
        if (!res) return;
        const { serverName, flag, sources, subtitles } = res;
        const nonHDRSources = sources.filter(s => !s.quality.includes("HDR"));

        nonHDRSources.forEach(src => {
            if (!streamObjects.some(existing => existing.streamUrl === src.url)) {
                streamObjects.push({
                    title: `[${serverName}] ${flag} ${src.quality}`,
                    streamUrl: src.url,
                    headers: {
                        "Origin": "https://player.videasy.to",
                        "Referer": "https://player.videasy.to/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    }
                });
            }
        });

        subtitles.forEach(sub => {
            if (!allSubtitles.some(existing => existing.url === sub.url)) {
                allSubtitles.push(sub);
            }
        });
    });

    // Sort by quality weight descending
    streamObjects.sort((a, b) => {
        const weightA = getQualityWeight(a.title);
        const weightB = getQualityWeight(b.title);
        return weightB - weightA;
    });

    const englishSubtitle = allSubtitles.find(sub => (sub.language || sub.lang)?.toLowerCase() === 'english');
    let subtitleUrl = englishSubtitle ? englishSubtitle.url : "";

    if (subtitleUrl) {
      subtitleUrl = `https://passthrough-worker.simplepostrequest.workers.dev/?url=${encodeURIComponent(subtitleUrl)}&type=vtt&referer=https%3A%2F%2Fplayer.videasy.to%2F`;
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

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null, encoding: 'utf-8' }) {
    try {
        return await fetchv2(
            url,
            options.headers ?? {},
            options.method ?? 'GET',
            options.body ?? null,
            true,
            options.encoding ?? 'utf-8'
        );
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
    }
}
