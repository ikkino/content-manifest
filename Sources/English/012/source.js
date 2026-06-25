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

async function extractStreamUrl(ID) {
    const startTime = Date.now();

    if (ID.includes('movie')) {
        const tmdbID = ID.replace('/movie/', '');
        const headersOne = {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NTQ0MWU0MTg4NjhhMWI0NDZiM2I0Mzg1MmE4OWQ2NyIsIm5iZiI6MTYzMDg4NDI0My40NzMsInN1YiI6IjYxMzU1MTkzZmQ0YTk2MDA0NDVkMTJjNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Hm0W-hUx-7ph-ASvk2TpMxZbMtwVa5DEXWcgNgcqXJM",
            "Referer": "https://player.smashystream.com/",
            "Origin": "https://player.smashystream.com",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/"
        };
        const tmdbResponse = await fetchv2(`https://api.themoviedb.org/3/movie/${tmdbID}?append_to_response=external_ids`, headersOne);
        const tmdbData = await tmdbResponse.json();
        const imdbID = tmdbData.imdb_id;

        const streamResponse = await ilovefeet(imdbID, false, null, null, 'm3u8');

        const streams = [];

        if (streamResponse && streamResponse.defaultUrl) {
            streams.push("1080p", streamResponse.defaultUrl);
        }

        if (streamResponse && streamResponse.vFastUrl) {
            const fourKResult = await ilovearmpits(streamResponse.vFastUrl);
            if (fourKResult.available && fourKResult.url) {
                streams.push("4K", fourKResult.url);
            }
        }

        const final = {
            streams,
            subtitles: streamResponse.subtitles || "None"
        };

        const endTime = Date.now();
        const elapsed = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`Stream fetched in ${elapsed}s`);

        console.log(JSON.stringify(final));
        return JSON.stringify(final);
    } else if (ID.includes('tv')) {
        const parts = ID.split('/');
        const tmdbID = parts[2];
        const seasonNumber = parts[3];
        const episodeNumber = parts[4];
        console.log(`TMDB ID: ${tmdbID}, Season: ${seasonNumber}, Episode: ${episodeNumber}`);
        const headersOne = {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NTQ0MWU0MTg4NjhhMWI0NDZiM2I0Mzg1MmE4OWQ2NyIsIm5iZiI6MTYzMDg4NDI0My40NzMsInN1YiI6IjYxMzU1MTkzZmQ0YTk2MDA0NDVkMTJjNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Hm0W-hUx-7ph-ASvk2TpMxZbMtwVa5DEXWcgNgcqXJM",
            "Referer": "https://player.smashystream.com/",
            "Origin": "https://player.smashystream.com",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/"
        };
        const tmdbResponse = await fetchv2(`https://api.themoviedb.org/3/tv/${tmdbID}?append_to_response=external_ids`, headersOne);
        const tmdbData = await tmdbResponse.json();
        const imdbID = tmdbData.external_ids.imdb_id;

        const streamResponse = await ilovefeet(imdbID, true, seasonNumber, episodeNumber, 'm3u8');

        const streams = [];

        if (streamResponse && streamResponse.defaultUrl) {
            streams.push("1080p", streamResponse.defaultUrl);
        }

        if (streamResponse && streamResponse.vFastUrl) {
            const fourKResult = await ilovearmpits(streamResponse.vFastUrl);
            if (fourKResult.available && fourKResult.url) {
                streams.push("4K", fourKResult.url);
            }
        }

        const final = {
            streams,
            subtitles: streamResponse.subtitles || "None"
        };

        const endTime = Date.now();
        const elapsed = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`Stream fetched in ${elapsed}s`);

        console.log(JSON.stringify(final));
        return JSON.stringify(final);
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
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

async function ilovearmpits(m3u8Url) {
    try {
        const headers = {
            "Accept": "*/*",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
            "Referer": "https://vidfast.pro/",
            "X-Requested-With": "XMLHttpRequest"
        };

        const response = await fetchv2(m3u8Url, headers);
        const playlistContent = await response.text();

        const has4K = playlistContent.includes('RESOLUTION=3840x2160');

        if (!has4K) {
            console.log(`4K Check for ${m3u8Url}: NO`);
            return { available: false, url: null };
        }

        const lines = playlistContent.split('\n');
        let fourKPath = null;
        let fourKCount = 0;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('RESOLUTION=3840x2160')) {
                fourKCount++;
                if (fourKCount === 2 && i + 1 < lines.length) {
                    fourKPath = lines[i + 1].trim();
                    break;
                }
            }
        }

        if (!fourKPath && fourKCount === 1) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('RESOLUTION=3840x2160')) {
                    if (i + 1 < lines.length) {
                        fourKPath = lines[i + 1].trim();
                        break;
                    }
                }
            }
        }

        if (!fourKPath) {
            console.log('4K resolution found but could not extract path');
            return { available: false, url: null };
        }

        let baseUrl = '';
        if (m3u8Url.startsWith('https://')) {
            const afterProtocol = m3u8Url.substring(8);
            const hostEnd = afterProtocol.indexOf('/');
            const host = hostEnd !== -1 ? afterProtocol.substring(0, hostEnd) : afterProtocol;
            baseUrl = 'https://' + host;
        } else if (m3u8Url.startsWith('http://')) {
            const afterProtocol = m3u8Url.substring(7);
            const hostEnd = afterProtocol.indexOf('/');
            const host = hostEnd !== -1 ? afterProtocol.substring(0, hostEnd) : afterProtocol;
            baseUrl = 'http://' + host;
        }

        const full4KUrl = fourKPath.startsWith('http') ? fourKPath : `${baseUrl}${fourKPath}`;

        return { available: true, url: full4KUrl };
    } catch (error) {
        console.log('Error checking 4K availability: ' + error);
        return { available: false, url: null };
    }
}

async function ilovefeet(imdbId, isSeries = false, season = null, episode = null, preferredFormat = null) {
    let baseUrl;
    if (isSeries) {
        baseUrl = `https://vidfast.pro/tv/${imdbId}/${season}/${episode}`;
    } else {
        baseUrl = `https://vidfast.pro/movie/${imdbId}`;
    }

    const headers = {
        "Accept": "*/*",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        "Referer": baseUrl,
        "X-Requested-With": "XMLHttpRequest"
    };

    console.log(`Requesting Base URL: ${baseUrl}`);
    const pageResponse = await fetchv2(baseUrl, headers);
    const pageText = await pageResponse.text();

    let match = pageText.match(/\\"en\\":\\"([^"]+)\\"/) ||
        pageText.match(/"en":"([^"]+)"/) ||
        pageText.match(/'en':'([^']+)'/) ||
        pageText.match(/["']en["']:\s*["']([^"']+)["']/);

    if (!match) {
        throw new Error('Could not find data in page');
    }
    const rawData = match[1];
    console.log("Raw Data extracted:", rawData);

    const apiUrl = `https://enc-dec.app/api/enc-vidfast?text=${encodeURIComponent(rawData)}&version=1`;
    console.log(`Requesting Decrypt API: ${apiUrl}`);
    const apiResponse = await soraFetch(apiUrl);
    const apiData = await apiResponse.json();
    console.log("API Data from enc-dec.app:", JSON.stringify(apiData));

    if (apiData.status !== 200 || !apiData.result) {
        throw new Error('Failed to decrypt data via enc-dec.app API');
    }

    const apiServers = apiData.result.servers;
    const streamBase = apiData.result.stream;
    const csrfToken = apiData.result.token;

    if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
    }

    console.log(`Requesting Servers URL: ${apiServers}`);
    const serversResponse = await soraFetch(apiServers, { method: 'POST', headers: headers });
    const serversEncrypted = await serversResponse.text();

    const decServersResponse = await soraFetch('https://enc-dec.app/api/dec-vidfast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: serversEncrypted, version: "1" })
    });
    const decServersData = await decServersResponse.json();

    if (decServersData.status !== 200 || !decServersData.result) {
        throw new Error('Failed to decrypt servers data via enc-dec.app API');
    }
    const serverList = decServersData.result;

    if (!serverList || serverList.length === 0) {
        throw new Error('No servers available');
    }

    const testServer = async (serverObj, index) => {
        const server = serverObj.data;
        const apiStream = streamBase + '/' + server;

        try {
            console.log(`Requesting Stream URL for server ${index}: ${apiStream}`);
            const streamResponse = await soraFetch(apiStream, { method: 'POST', headers: headers });

            const streamEncrypted = await streamResponse.text();

            const decStreamResponse = await soraFetch('https://enc-dec.app/api/dec-vidfast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: streamEncrypted, version: "1" })
            });
            const decStreamData = await decStreamResponse.json();

            if (decStreamData.status !== 200 || !decStreamData.result) {
                throw new Error(`Server ${index} failed to decrypt stream`);
            }

            let data = decStreamData.result;

            if (!data.url) {
                throw new Error(`Server ${index} has no URL`);
            }

            const format = data.url.includes('.m3u8') ? 'm3u8' : data.url.includes('.mpd') ? 'mpd' : 'unknown';

            const hasEnglishSubs = data.tracks && Array.isArray(data.tracks) &&
                data.tracks.some(track => track.label && track.label.toLowerCase().includes('english') && track.file);


            if (preferredFormat === 'm3u8' && format === 'm3u8' && hasEnglishSubs) {
                return { index, server, success: true, format, data, preferred: true, hasSubtitles: true };
            }

            if (preferredFormat === 'm3u8' && format === 'm3u8') {
                return { index, server, success: true, format, data, preferred: true, hasSubtitles: false };
            }

            return { index, server, success: true, format, data, preferred: false, hasSubtitles: hasEnglishSubs };

        } catch (error) {
            throw new Error(`Server ${index} failed: ${error.message}`);
        }
    };

    let selectedServer = null;
    let vFastServer = null;

    try {
        if (preferredFormat === 'm3u8') {
            const serverPromises = serverList.map((serverObj, index) => testServer(serverObj, index));

            const raceForSubtitles = new Promise((resolve, reject) => {
                let completedCount = 0;
                let firstWorkingServer = null;

                serverPromises.forEach(promise => {
                    promise.then(result => {
                        completedCount++;

                        if (result.hasSubtitles) {
                            console.log(`Found server ${result.index} with subtitles, stopping other requests`);
                            resolve(result);
                            return;
                        }

                        if (!firstWorkingServer && result.format === 'm3u8') {
                            firstWorkingServer = result;
                        }

                        if (completedCount === serverPromises.length) {
                            if (firstWorkingServer) {
                                console.log(`No servers with subtitles found, using fallback server ${firstWorkingServer.index}`);
                                resolve(firstWorkingServer);
                            } else {
                                reject(new Error('No working m3u8 servers found'));
                            }
                        }
                    }).catch(() => {
                        completedCount++;

                        if (completedCount === serverPromises.length) {
                            if (firstWorkingServer) {
                                console.log(`No servers with subtitles found, using fallback server ${firstWorkingServer.index}`);
                                resolve(firstWorkingServer);
                            } else {
                                reject(new Error('No working m3u8 servers found'));
                            }
                        }
                    });
                });
            });

            let vFastPromise = Promise.resolve(null);
            const vFastServerObj = serverList.find(server => server.name === 'vFast');
            if (vFastServerObj) {
                const vFastIndex = serverList.indexOf(vFastServerObj);
                vFastPromise = serverPromises[vFastIndex].catch(error => {
                    console.log('vFast server failed: ' + error.message);
                    return null;
                });
            } else {
                console.log('vFast server not found in server list');
            }

            const [selected, vFastResult] = await Promise.all([raceForSubtitles, vFastPromise]);
            selectedServer = selected;
            vFastServer = vFastResult;

        } else {
            const serverPromises = serverList.map((serverObj, index) => testServer(serverObj, index));
            selectedServer = await Promise.any(serverPromises);

            console.log(`Found working server ${selectedServer.index} with format ${selectedServer.format}`);
        }
    } catch (error) {
        console.log('All servers failed:' + error);
        throw new Error('No working servers found');
    }

    const workingServers = [selectedServer];

    if (preferredFormat === 'm3u8' && selectedServer.format === 'mpd') {
        selectedServer.data.url = selectedServer.data.url.replace('.mpd', '.m3u8');
        selectedServer.format = 'm3u8';
    }

    let finalUrl = selectedServer.data.url;

    let englishSubtitles = null;
    try {
        if (selectedServer.data.tracks && Array.isArray(selectedServer.data.tracks)) {
            const englishTrack = selectedServer.data.tracks.find(track =>
                track.label && track.label.toLowerCase().includes('english') && track.file
            );
            if (englishTrack) {
                englishSubtitles = englishTrack.file;
            } else {
                console.log('No English subtitle track found in tracks array');
            }
        } else {
            console.log('No tracks array found in server response');
        }
    } catch (error) {
        console.log('Error extracting subtitles:' + error);
    }

    return {
        defaultUrl: selectedServer.data.url,
        vFastUrl: vFastServer ? vFastServer.data.url : null,
        referer: baseUrl,
        format: selectedServer.format,
        subtitles: englishSubtitles,
        fullData: selectedServer.data,
        vFastData: vFastServer ? vFastServer.data : null,
        serverStats: {
            total: serverList.length,
            working: vFastServer ? 2 : 1,
            failed: serverList.length - (vFastServer ? 2 : 1),
            selectedServerIndex: selectedServer.index,
            vFastServerIndex: vFastServer ? vFastServer.index : null
        }
    };
}
