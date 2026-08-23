class Anilist {
    static async search(keyword, filters = {}) {
        const query = `query (
                $search: String,
                $page: Int,
                $perPage: Int,
                $sort: [MediaSort],
                $genre_in: [String],
                $tag_in: [String],
                $type: MediaType,
                $format: MediaFormat,
                $status: MediaStatus,
                $countryOfOrigin: CountryCode,
                $isAdult: Boolean,
                $season: MediaSeason,
                $startDate_like: String,
                $source: MediaSource,
                $averageScore_greater: Int,
                $averageScore_lesser: Int
            ) {
                Page(page: $page, perPage: $perPage) {
                media(
                    search: $search,
                    type: $type,
                    sort: $sort,
                    genre_in: $genre_in,
                    tag_in: $tag_in,
                    format: $format,
                    status: $status,
                    countryOfOrigin: $countryOfOrigin,
                    isAdult: $isAdult,
                    season: $season,
                    startDate_like: $startDate_like,
                    source: $source,
                    averageScore_greater: $averageScore_greater,
                    averageScore_lesser: $averageScore_lesser
                ) {
                    id
                    idMal
                    averageScore
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    nextAiringEpisode {
                        airingAt
                        timeUntilAiring
                        episode
                    }
                    status
                    genres
                    format
                    description
                    startDate {
                        year
                        month
                        day
                    }
                    endDate {
                        year
                        month
                        day
                    }
                    popularity
                    coverImage {
                        color
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "page": 1,
            "perPage": 50,
            "sort": [
                "SEARCH_MATCH",
                "TITLE_ENGLISH_DESC",
                "TITLE_ROMAJI_DESC"
            ],
            "search": keyword,
            "type": "ANIME",
            ...filters
        }

        // console.log(filters, variables);

        return Anilist.anilistFetch(query, variables);
    }

    static async lookup(filters) {
        const query = `query (
                $id: Int,
                $idMal: Int
            ) {
                Page(page: 1, perPage: 1) {
                media(
                    id: $id,
                    idMal: $idMal
                ) {
                    id
                    idMal
                    averageScore
                    title {
                        romaji
                        english
                        native
                    }
                    episodes
                    nextAiringEpisode {
                        airingAt
                        timeUntilAiring
                        episode
                    }
                    status
                    genres
                    format
                    description
                    startDate {
                        year
                        month
                        day
                    }
                    endDate {
                        year
                        month
                        day
                    }
                    popularity
                    coverImage {
                        color
                        large
                        extraLarge
                    }
                }
            }
        }`;

        const variables = {
            "type": "ANIME",
            ...filters
        }

        return Anilist.anilistFetch(query, variables);
    }

    static async getLatest(filters) {
        let page = 0;
        let hasNextPage = true;
        const perPage = 50;
        const currentDate = new Date();

        filters.seasonYear = currentDate.getFullYear();
        filters.season = Anilist.monthToSeason(currentDate.getMonth());

        const results = [];

        do {
            page++;

            const query = `query (
                $page: Int,
                $perPage: Int,
                $sort: [MediaSort],
                $type: MediaType,
                $status: MediaStatus,
                $isAdult: Boolean,
                $seasonYear: Int,
                $season: MediaSeason
            ) {
                Page(page: $page, perPage: $perPage) {
                    media(
                        type: $type,
                        sort: $sort,
                        status: $status,
                        isAdult: $isAdult,
                        seasonYear: $seasonYear,
                        season: $season
                    ) {
                        id
                        idMal
                        averageScore
                        title {
                            romaji
                            english
                            native
                        }
                        episodes
                        nextAiringEpisode {
                            airingAt
                            timeUntilAiring
                            episode
                        }
                        status
                        genres
                        format
                        description
                        startDate {
                            year
                            month
                            day
                        }
                        endDate {
                            year
                            month
                            day
                        }
                        popularity
                        coverImage {
                            color
                            large
                            extraLarge
                        }
                    }
                    pageInfo {
                        hasNextPage
                    }
                }
            }`;

            const variables = {
                "page": page,
                "perPage": perPage,
                "sort": [
                    "POPULARITY_DESC"
                ],
                "type": "ANIME",
                "status": "RELEASING",
                ...filters
            }

            const fetchResults = await Anilist.anilistFetch(query, variables);
            results.push(fetchResults);

            if(fetchResults?.Page?.pageInfo?.hasNextPage !== true) {
                hasNextPage = false;
            }

        } while(hasNextPage);

        const mergedObject = { Page: { media: []}};

        for(let page of results) {
            mergedObject.Page.media = mergedObject.Page.media.concat(page.Page.media);
        }

        return mergedObject;
    }

    static async anilistFetch(query, variables) {
        const url = 'https://graphql.anilist.co/';
        const extraTimeoutMs = 250;

        try {
            const response = await soraFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    variables: variables
                })
            });

            if (response.status !== 200) {
                if (response.status === 429) {
                    console.info('=== RATE LIMIT EXCEEDED, SLEEPING AND RETRYING ===');
                    const retryTimeout = response.headers.get('Retry-After');
                    const timeout = Math.ceil((parseInt(retryTimeout))) * 1000 + extraTimeoutMs;
                    await sleep(timeout);
                    return await AnilistFetch(query, variables);

                }

                console.error('Error fetching Anilist data:', response.statusText);
                return null;
            }

            const json = await response.json();
            if (json?.errors) {
                console.error('Error fetching Anilist data:', json.errors);
            }

            return json?.data;

        } catch (error) {
            console.error('Error fetching Anilist data:', error);
            return null;
        }
    }

    static convertAnilistDateToDateStr(dateObject) {
        if (dateObject.year == null) {
            return null;
        }
        if (dateObject.month == null || parseInt(dateObject.month) < 1) {
            dateObject.month = 1;
        }
        if (dateObject.day == null || parseInt(dateObject.day) < 1) {
            dateObject.day = 1;
        }
        return dateObject.year + "-" + (dateObject.month).toString().padStart(2, '0') + "-" + (dateObject.day).toString().padStart(2, '0');
    }


    // Yes it's stupid, but I kinda love it which is why I'm not optimizing this
    static nextAnilistAirDateToCountdown(timestamp) {
        if (timestamp == null) return null;

        const airDate = new Date((timestamp * 1000));
        const now = new Date();

        if (now > airDate) return null;

        let [days, hourRemainder] = (((airDate - now) / 1000) / 60 / 60 / 24).toString().split('.');
        let [hours, minRemainder] = (parseFloat("0." + hourRemainder) * 24).toString().split('.');
        let minutes = Math.ceil((parseFloat("0." + minRemainder) * 60));

        return `Next episode will air in ${days} days, ${hours} hours and ${minutes} minutes at ${airDate.getFullYear()}-${(airDate.getMonth() + 1).toString().padStart(2, '0')}-${(airDate.getDate()).toString().padStart(2, '0')} ${airDate.getHours()}:${airDate.getMinutes()}`;
    }

    static monthToSeason(month) {
        // Month is 0 indexed
        const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
        if(month == 11) return seasons[0];
        if(month <= 1) return seasons[0];
        if(month <= 4) return seasons[1];
        if(month <= 7) return seasons[2];
        return seasons[3];
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchResults(keyword) {
    try {
        let aniData = null;

        // --- AniList Search ---
        if (keyword.startsWith('!anime') || keyword.startsWith('!a') || keyword.startsWith('!')) {
            aniData = await Anilist.getLatest({ isAdult: false });
        } else {
            aniData = await Anilist.search(keyword, { isAdult: false });
        }

        let transformedResults = [];

        if (aniData?.Page?.media?.length > 0) {
            transformedResults = aniData.Page.media.map(result => ({
                title:
                    result.title.english ||
                    result.title.romaji ||
                    result.title.native ||
                    "Untitled",
                image:
                    result.coverImage.extraLarge ||
                    result.coverImage.large ||
                    result.coverImage.medium ||
                    "",
                href: `anime/${result.id}`,
            }));
        }

        console.log("Transformed Results: " + JSON.stringify(transformedResults));
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log("Fetch error in searchResults: " + error);
        return JSON.stringify([{ title: "Error", image: "", href: "" }]);
    }
}

async function extractDetails(url) {
    try {
        if (url.includes('anime')) {
            const match = url.match(/anime\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const animeId = parseInt(match[1]);

            const aniData = await Anilist.lookup({ id: animeId });
            const anime = aniData.Page.media[0];

            const cleanDescription = anime.description
                ? anime.description.replace(/<[^>]+>/g, '').trim()
                : 'No description available';

            const transformedResults = [{
                description: cleanDescription,
                aliases: `Duration: ${anime.episodes ? 24 + " minutes" : 'Unknown'}`, // default 24 mins per episode
                airdate: `Aired: ${anime.startDate.year ? Anilist.convertAnilistDateToDateStr(anime.startDate) : 'Unknown'}`
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
        if(url.includes('anime')) {
            const match = url.match(/anime\/([^\/]+)/);
            if (!match) throw new Error("Invalid URL format");

            const animeId = parseInt(match[1]);
            const aniData = await Anilist.lookup({ id: animeId });
            const anime = aniData.Page.media[0];

            console.log(anime);

            if (!anime) return JSON.stringify([]);

            const episodesCount = anime.episodes || (anime.nextAiringEpisode.episode - 1) || 1;
            const episodesArray = [];
            for (let i = 1; i <= episodesCount; i++) {
                episodesArray.push({
                    href: `anime/${animeId}/${i}`,
                    number: i,
                    title: `Episode ${i}`
                });
            }

            console.log(episodesArray);
            return JSON.stringify(episodesArray);
        } else {
            throw new Error("Invalid URL format");
        }
    } catch (error) {
        console.log('Fetch error in extractEpisodes: ' + error);
        return JSON.stringify([]);
    }    
}

// searchResults("!trending");

// searchResults("clannad");
// extractDetails("tv/24835/1/1");
// extractEpisodes("tv/24835/1/1");
// extractStreamUrl("tv/24835/1/1");

// extractDetails("anime/2167");
// extractEpisodes("anime/2167");
// extractStreamUrl("anime/130003/1");

// searchResults("One piece");
// extractEpisodes("anime/21");
// extractStreamUrl("anime/21/1");

async function extractStreamUrl(url) {
    try {
        const match = url.match(/(anime)\/(.+)/);
        if (!match) throw new Error('Invalid URL format');
        const [, type, path] = match;
        const [anilistId, episodeNumber] = path.split('/');

        const providers = [
            "animepahe", "anikoto", "reanime", "animix", "allani", "senshi"
        ];

        const allStreams = [];
        let allSubtitles = [];
        let primarySubtitle = "";
        let primaryHeaders = {};

        const fetchProvider = async (provider) => {
            const apiUrl = `https://anikuro.ru/api/getsources/?id=${anilistId}&lol=${provider}&ep=${episodeNumber}`;
            console.log("[Anikuro] Fetching: " + apiUrl);

            const resp = await soraFetch(apiUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*"
                }
            });

            if (!resp || resp.status !== 200) {
                console.warn(`[Anikuro] ${provider} failed with status: ${resp ? resp.status : "null"}`);
                return null;
            }

            let json;
            try {
                if (typeof resp.json === "function") {
                    json = await resp.json();
                } else {
                    const text = await resp.text();
                    json = JSON.parse(text);
                }
            } catch (e) {
                console.error(`[Anikuro] ${provider} JSON parse error:`, e);
                return null;
            }

            const data = json?.data || json;
            if (!data) {
                console.warn(`[Anikuro] ${provider} returned empty data`);
                return null;
            }

            return data;
        };

        const results = await Promise.allSettled(providers.map(p => fetchProvider(p)));

        results.forEach((result, idx) => {
            if (result.status !== "fulfilled" || !result.value) return;
            const data = result.value;
            const providerName = providers[idx];

            // Try to get variants from providerResult (most providers use this)
            let variants = data?.providerResult?.variants || [];

            // If no variants, construct from top-level sub/dub manually
            if (variants.length === 0) {
                if (data.sub) {
                    variants.push({
                        variant: "sub",
                        sources: data.sub.sources || [],
                        subtitles: data.sub.subtitles || [],
                        headers: data.sub.headers || {}
                    });
                }
                if (data.dub) {
                    variants.push({
                        variant: "dub",
                        sources: data.dub.sources || [],
                        subtitles: data.dub.subtitles || [],
                        headers: data.dub.headers || {}
                    });
                }
            }

            variants.forEach((variant) => {
                const varType = variant.variant || "sub";
                const headers = variant.headers || {};
                const sources = variant.sources || [];

                sources.forEach((source) => {
                    if (source.quality === "Yt-mp4") return;

                    const quality = source.quality || "default";
                    // Use original URL if available, otherwise fall back to proxy
                    let streamUrl = source.originalUrl || source.url;

                    // Animepahe URL transformation (still applies to originalUrl)
                    if (providerName === "animepahe" && streamUrl) {
                        streamUrl = streamUrl
                            .replace("/stream/", "/hls/")
                            .replace("uwu.m3u8", "owo.m3u8");
                    }

                    // Build headers: use upstreamReferer as Referer if present
                    const streamHeaders = { ...(source.headers || headers) };
                    if (source.upstreamReferer) {
                        streamHeaders["Referer"] = source.upstreamReferer;
                    }

                    allStreams.push({
                        title: `${providerName} - ${varType.toUpperCase()} (${quality})`,
                        streamUrl: streamUrl,
                        headers: streamHeaders,
                    });
                });

                // Collect subtitles (unchanged)
                const subtitles = variant.subtitles || [];
                subtitles.forEach((sub) => {
                    allSubtitles.push({
                        url: sub.url,
                        label: sub.label || "Unknown",
                        kind: "captions",
                        headers: {}
                    });
                    if (!primarySubtitle && sub.label && sub.label.toLowerCase().includes("english") && sub.default) {
                        primarySubtitle = sub.url;
                        primaryHeaders = headers;
                    }
                });
            });
        });

        // Sort: SUB first, then DUB
        allStreams.sort((a, b) => {
            const aIsSub = a.title.toLowerCase().includes("sub") ? 0 : 1;
            const bIsSub = b.title.toLowerCase().includes("sub") ? 0 : 1;
            if (aIsSub !== bIsSub) return aIsSub - bIsSub;
            return a.title.localeCompare(b.title);
        });

        // Deduplicate subtitles
        const seenUrls = new Set();
        allSubtitles = allSubtitles.filter(sub => {
            if (seenUrls.has(sub.url)) return false;
            seenUrls.add(sub.url);
            return true;
        });

        // Fallback primary subtitle
        if (!primarySubtitle && allSubtitles.length > 0) {
            const engSub = allSubtitles.find(s => s.label && s.label.toLowerCase().includes("english"));
            primarySubtitle = engSub ? engSub.url : allSubtitles[0].url;
            primaryHeaders = {};
        }

        const result = {
            streams: allStreams,
            subtitles: primarySubtitle,
            subtitlesHeaders: primaryHeaders,
            allSubtitles: allSubtitles
        };

        console.log('Result: ' + JSON.stringify(result).substring(0, 500));
        return JSON.stringify(result);

    } catch (error) {
        console.log('Fetch error in extractStreamUrl: ' + error);
        return JSON.stringify({ streams: [], subtitles: "", subtitlesHeaders: {}, allSubtitles: [] });
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
