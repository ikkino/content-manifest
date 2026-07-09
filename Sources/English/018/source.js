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
    const cinebyResponse = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/movie/${tmdbID}?api_key=ad301b7cc82ffe19273e55e4d4206885&append_to_response=external_ids&language=en`)}&simple=true`);
    if (!cinebyResponse) throw new Error("Failed to fetch TMDB details");
    const cinebyData = await cinebyResponse.json();

    const title = encodeURIComponent(cinebyData.title || "");
    const year = cinebyData.release_date ? new Date(cinebyData.release_date).getFullYear() : "";
    const imdbId = cinebyData.external_ids?.imdb_id || '';
    const tmdbId = cinebyData.id;

    const serversRes = await soraFetch("https://snowhouse.lordflix.club/servers", {
        headers: {
            "Origin": "https://lordflix.org",
            "Referer": "https://lordflix.org/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        }
    });
    if (!serversRes) throw new Error("Failed to fetch servers");
    const serversData = await serversRes.json();
    const server = serversData.servers && serversData.servers.length > 0 ? serversData.servers[0].name : "Berlin";

    const encUrl = `https://snowhouse.lordflix.club/?title=${title}&type=movie&year=${year}&imdb=${imdbId}&tmdb=${tmdbId}&server=${server}`;
    const encResponse = await soraFetch(`https://enc-dec.app/api/enc-lordflix?url=${encodeURIComponent(encUrl)}`);
    if (!encResponse) throw new Error("Failed to get encryption token");
    const encData = await encResponse.json();

    if (encData.status !== 200) throw new Error("Encryption failed");

    const encryptedUrl = encData.result.url;
    const sign = encData.result.sign;

    const attest = await solveChallenge();
    const LordflixHeaders = {
        "Origin": "https://lordflix.org",
        "Referer": "https://lordflix.org/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "x-attest": attest
    };

    const mediaResponse = await soraFetch(encryptedUrl, { headers: LordflixHeaders });
    if (!mediaResponse) throw new Error("Failed to fetch media data");
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
    if (!decryptedResponse) throw new Error("Failed to decrypt media data");
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

    const cinebyResponse = await soraFetch(`https://post-eosin.vercel.app/api/proxy?url=${encodeURIComponent(`https://api.themoviedb.org/3/tv/${tmdbID}?api_key=ad301b7cc82ffe19273e55e4d4206885&append_to_response=external_ids&language=en`)}&simple=true`);
    if (!cinebyResponse) throw new Error("Failed to fetch TMDB details");
    const cinebyData = await cinebyResponse.json();

    const title = encodeURIComponent(cinebyData.name || "");
    const year = cinebyData.first_air_date ? new Date(cinebyData.first_air_date).getFullYear() : "";
    const imdbId = cinebyData.external_ids?.imdb_id || '';
    const tmdbId = cinebyData.id;

    const serversRes = await soraFetch("https://snowhouse.lordflix.club/servers", {
        headers: {
            "Origin": "https://lordflix.org",
            "Referer": "https://lordflix.org/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        }
    });
    if (!serversRes) throw new Error("Failed to fetch servers");
    const serversData = await serversRes.json();
    const server = serversData.servers && serversData.servers.length > 0 ? serversData.servers[0].name : "Berlin";

    const encUrl = `https://snowhouse.lordflix.club/?title=${title}&type=series&year=${year}&imdb=${imdbId}&tmdb=${tmdbId}&server=${server}&season=${seasonNumber}&episode=${episodeNumber}`;
    const encResponse = await soraFetch(`https://enc-dec.app/api/enc-lordflix?url=${encodeURIComponent(encUrl)}`);
    if (!encResponse) throw new Error("Failed to get encryption token");
    const encData = await encResponse.json();

    if (encData.status !== 200) throw new Error("Encryption failed");

    const encryptedUrl = encData.result.url;
    const sign = encData.result.sign;

    const attest = await solveChallenge();
    const LordflixHeaders = {
        "Origin": "https://lordflix.org",
        "Referer": "https://lordflix.org/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "x-attest": attest
    };

    const mediaResponse = await soraFetch(encryptedUrl, { headers: LordflixHeaders });
    if (!mediaResponse) throw new Error("Failed to fetch media data");
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
    if (!decryptedResponse) throw new Error("Failed to decrypt media data");
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

async function solveChallenge() {
    const challengeRes = await soraFetch("https://snowhouse.lordflix.club/challenge", {
        headers: {
            "Origin": "https://lordflix.org",
            "Referer": "https://lordflix.org/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        }
    });
    if (!challengeRes) throw new Error("Failed to fetch challenge");
    const challenge = await challengeRes.json();

    const maxNumber = challenge.maxnumber;
    const challengeHash = challenge.challenge;
    const salt = challenge.salt;

    let number = 0;
    for (let i = 0; i <= maxNumber; i++) {
        const hash = sha256(salt + i);
        if (hash === challengeHash) {
            number = i;
            break;
        }
    }

    const payload = {
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number: number,
        salt: challenge.salt,
        signature: challenge.signature
    };

    return btoa(JSON.stringify(payload));
}

function sha256(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = 0xffffffff;
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiLength = ascii[lengthProperty] * 8;
    var hash = [], k = [];
    var primeCounter = 0;
    var isPrime = function(n) {
        for (var factor = 2; factor * factor <= n; factor++) {
            if (n % factor === 0) return false;
        }
        return true;
    };
    var getFractionalBits = function(n) {
        return ((n - Math.floor(n)) * mathPow(2, 32)) | 0;
    };
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (isPrime(candidate)) {
            if (primeCounter < 8) {
                hash[primeCounter] = getFractionalBits(mathPow(candidate, 1/2));
            }
            k[primeCounter] = getFractionalBits(mathPow(candidate, 1/3));
            primeCounter++;
        }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
        j = ascii.charCodeAt(i);
        if (j >> 8) return;
        words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiLength / mathPow(2, 32)) | 0);
    words[words[lengthProperty]] = (asciiLength | 0);
    var h0 = hash[0], h1 = hash[1], h2 = hash[2], h3 = hash[3],
        h4 = hash[4], h5 = hash[5], h6 = hash[6], h7 = hash[7];
    for (i = 0; i < words[lengthProperty]; i += 16) {
        var w = [];
        for (j = 0; j < 16; j++) w[j] = words[i + j];
        for (j = 16; j < 64; j++) {
            var s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
            var s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
            w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
        }
        var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (j = 0; j < 64; j++) {
            var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            var ch = (e & f) ^ (~e & g);
            var temp1 = (h + S1 + ch + k[j] + (w[j] || 0)) | 0;
            var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            var maj = (a & b) ^ (a & c) ^ (b & c);
            var temp2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
        }
        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0;
        h5 = (h5 + f) | 0;
        h6 = (h6 + g) | 0;
        h7 = (h7 + h) | 0;
    }
    var resultWords = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (i = 0; i < 8; i++) {
        var word = resultWords[i];
        for (j = 3; j >= 0; j--) {
            var byteVal = (word >>> (j * 8)) & 0xff;
            result += (byteVal < 16 ? '0' : '') + byteVal.toString(16);
        }
    }
    return result;
}

function btoa(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    for (let i = 0, c = str.length; i < c; i += 3) {
        let char1 = str.charCodeAt(i),
            char2 = i + 1 < c ? str.charCodeAt(i + 1) : NaN,
            char3 = i + 2 < c ? str.charCodeAt(i + 2) : NaN;

        let byte1 = char1 >> 2,
            byte2 = ((char1 & 3) << 4) | (isNaN(char2) ? 0 : char2 >> 4),
            byte3 = isNaN(char2) ? 64 : ((char2 & 15) << 2) | (isNaN(char3) ? 0 : char3 >> 6),
            byte4 = isNaN(char3) ? 64 : char3 & 63;

        output += chars.charAt(byte1) + chars.charAt(byte2) + chars.charAt(byte3) + chars.charAt(byte4);
    }
    return output;
}
