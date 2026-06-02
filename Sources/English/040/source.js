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

async function extractStreamUrl(ID) {
  if (ID.includes('movie')) {
    const tmdbID = ID.replace('/movie/', '');
    const cinebyResponse = await soraFetch(`https://db.videasy.net/3/movie/${tmdbID}?append_to_response=credits,external_ids,videos,recommendations,translations,similar,images&language=en`);
    const cinebyData = await cinebyResponse.json();

    const title = encodeURIComponent(cinebyData.title);
    const year = new Date(cinebyData.release_date).getFullYear();
    const imdbId = cinebyData.external_ids?.imdb_id || '';
    const tmdbId = cinebyData.id;

    const server = "Berlin";
    const encUrl = `https://snowhouse.lordflix.club/?title=${title}&type=movie&year=${year}&imdb=${imdbId}&tmdb=${tmdbId}&server=${server}`;
    const encResponse = await soraFetch(`https://enc-dec.app/api/enc-lordflix?url=${encodeURIComponent(encUrl)}`);
    const encData = await encResponse.json();
    
    if (encData.status !== 200) throw new Error("Encryption failed");

    const encryptedUrl = encData.result.url;
    const sign = encData.result.sign;

    const LordflixHeaders = {
        "Origin": "https://lordflix.org",
        "Referer": "https://lordflix.org/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    };

    const mediaResponse = await soraFetch(encryptedUrl, { headers: LordflixHeaders });
    const encryptedText = await mediaResponse.text();

    const decheaders = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const postData = JSON.stringify({
        text: encryptedText,
        sign: sign
    });

    const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-lordflix", decheaders, "POST", postData);
    const decryptedData = await decryptedResponse.json();
    
    if (decryptedData.status !== 200) throw new Error("Decryption failed");
    
    const streamsResult = decryptedData.result.stream || [];
    
    const streamObjects = streamsResult.map(src => ({
      title: src.id || "Unknown",
      streamUrl: src.playlist,
      headers: {
        "Origin": "https://lordflix.org",
        "Referer": "https://lordflix.org/"
      }
    }));

    let subtitleUrl = "";
    if (streamsResult.length > 0 && streamsResult[0].captions) {
      const englishSubtitle = streamsResult[0].captions.find(sub => (sub.language || sub.id)?.toLowerCase().includes('en'));
      if (englishSubtitle) {
        subtitleUrl = englishSubtitle.url;
      }
    }
    console.log(JSON.stringify({
      streams: streamObjects,
      subtitles: subtitleUrl
    }));
    return JSON.stringify({
      streams: streamObjects,
      subtitles: subtitleUrl
    });
} else if (ID.includes('tv')) {
    const parts = ID.split('/'); 
    const tmdbID = parts[2];
    const seasonNumber = parts[3];
    const episodeNumber = parts[4];

    const cinebyResponse = await soraFetch(`https://db.videasy.net/3/tv/${tmdbID}?append_to_response=credits,external_ids,videos,recommendations,translations,similar,images&language=en`);
    const cinebyData = await cinebyResponse.json();

    const title = encodeURIComponent(cinebyData.name);
    const year = new Date(cinebyData.first_air_date).getFullYear();
    const imdbId = cinebyData.external_ids?.imdb_id || '';
    const tmdbId = cinebyData.id;

    const server = "Berlin";
    const encUrl = `https://snowhouse.lordflix.club/?title=${title}&type=series&year=${year}&imdb=${imdbId}&tmdb=${tmdbId}&server=${server}&season=${seasonNumber}&episode=${episodeNumber}`;
    const encResponse = await soraFetch(`https://enc-dec.app/api/enc-lordflix?url=${encodeURIComponent(encUrl)}`);
    const encData = await encResponse.json();
    
    if (encData.status !== 200) throw new Error("Encryption failed");

    const encryptedUrl = encData.result.url;
    const sign = encData.result.sign;

    const LordflixHeaders = {
        "Origin": "https://lordflix.org",
        "Referer": "https://lordflix.org/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    };

    const mediaResponse = await soraFetch(encryptedUrl, { headers: LordflixHeaders });
    const encryptedText = await mediaResponse.text();

    const decheaders = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    };

    const postData = JSON.stringify({
        text: encryptedText,
        sign: sign
    });

    const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-lordflix", decheaders, "POST", postData);
    const decryptedData = await decryptedResponse.json();
    
    if (decryptedData.status !== 200) throw new Error("Decryption failed");
    
    const streamsResult = decryptedData.result.stream || [];
    
    const streamObjects = streamsResult.map(src => ({
      title: src.id || "Unknown",
      streamUrl: src.playlist,
      headers: {
        "Origin": "https://lordflix.org",
        "Referer": "https://lordflix.org/"
      }
    }));

    let subtitleUrl = "";
    if (streamsResult.length > 0 && streamsResult[0].captions) {
      const englishSubtitle = streamsResult[0].captions.find(sub => (sub.language || sub.id)?.toLowerCase().includes('en'));
      if (englishSubtitle) {
        subtitleUrl = englishSubtitle.url;
      }
    }

    return JSON.stringify({
      streams: streamObjects,
      subtitles: subtitleUrl
    });
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
