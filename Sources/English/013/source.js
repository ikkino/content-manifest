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

        // let streams = [];
        let subtitles = "";

        const [anilistId, episodeNumber] = path.split('/');

        const preferredOrder = [
            "animepahe",
            "animekai",
            "animez",
            "allani",
            "anify",
            "animix",
            "anigg",
            // "anixl",
            // "animeheaven",
            // "anis",
            // "anitaku",
            // "anihq",
            // "anizone",
            // "masterani",
            // "kaa",
            "zoro",
            // "aniw",
            "animedunya",
        ];

        // build all requests in parallel
        const tasks = preferredOrder.flatMap(provider => [
            (async () => {
                const apiUrl = `https://anikuro.ru/api/getsources/?id=${anilistId}&lol=${provider}&ep=${episodeNumber}`;

                console.log("API URL: " + apiUrl);

                const res = await soraFetch(apiUrl);

                // console.log("Res: " + JSON.stringify(res));

                const data = await res.json();

                console.log("Data: " + JSON.stringify(data));

                if (data?.error) return null;

                let title = "";
                let streamUrl = "";
                let headers = "";
                if (provider === 'animepahe') {
                    title = "Animepahe - (HardSUB)"
                    streamUrl = data.sub.url
                        .replace("/stream/", "/hls/")
                        .replace("uwu.m3u8", "owo.m3u8");
                } else if (provider === 'animekai') {
                    title = "AnimeKai - (SoftSUB)"
                    streamUrl = data.sub.default;

                    if (data.sub.tracks && !subtitles) {
                        const subsYeah = data.sub.tracks.find(sub => sub.lang.toLowerCase().startsWith("english"));
                        subtitles = subsYeah ? subsYeah.url : "";
                    };

                    if (data.sub.referer) {
                        headers = {
                            "Referer": data.sub.referer
                        }
                    }
                } else if (provider === 'animez') {
                    title = "Animez - (HardSUB)"
                    streamUrl = data.sub;
                } else if (provider === 'allani') {
                    title = "AllAnime - (HardSUB)"
                    streamUrl = data.sub.preferred.url;
                } else if (provider === 'anify') {
                    title = "Anify - (HardSUB)"
                    streamUrl = data.sub.default;

                    if (data.sub.referer) {
                        headers = {
                            "Referer": data.sub.referer
                        }
                    }
                } else if (provider === 'zoro') {
                    title = "Zoro - (SoftSUB)"
                    streamUrl = data.sub.default;

                    if (data.sub.tracks && !subtitles) {
                        const subsYeah = data.sub.tracks.find(sub => sub.lang.toLowerCase().startsWith("english"));
                        subtitles = subsYeah ? subsYeah.url : "";
                    };

                    if (data.sub.referer) {
                        headers = {
                            "Referer": data.sub.referer
                        }
                    }
                } else if (provider === 'anixl') {
                    // title = "AniXL - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'animeheaven') {
                    title = "AnimeHeaven - (HardSUB)"
                    streamUrl = data.sub;
                } else if (provider === 'aniw') {
                    // title = "AniW - (SoftSUB)"
                    // streamUrl = data.sub.default;

                    // if (data.sub.subtitles && !subtitles) {
                    //     const subsYeah = data.sub.subtitles.find(sub => sub.label.toLowerCase().startsWith("english"));
                    //     subtitles = subsYeah ? subsYeah.src : "";
                    // };
                } else if (provider === 'anis') {
                    // title = "AniS - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'animedunya') {
                    title = "AnimeDunya - (SoftSUB)"
                    streamUrl = data.sub.default;

                    if (data.sub.subtitles && !subtitles) {
                        const subsYeah = data.sub.subtitles.find(sub => sub.label.toLowerCase().startsWith("en"));
                        subtitles = subsYeah ? subsYeah.src : "";
                    };
                } else if (provider === 'animix') {
                    title = "AniWave - (HardSUB)"
                    streamUrl = data.sub.default;
                } else if (provider === 'anitaku') {
                    // title = "AniTaku - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'anihq') {
                    // title = "AniHQ - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'anizone') {
                    // title = "AniZone - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'masterani') {
                    // title = "MasterAni - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'kaa') {
                    // title = "KAA - (HardSUB)"
                    // streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                } else if (provider === 'anigg') {
                    title = "AnimEGG - (HardSUB)"
                    streamUrl = data?.sub?.["1080p"] ||
                        data?.sub?.["720p"] ||
                        data?.sub?.["480p"] ||
                        data?.sub?.["360p"] || "";
                } else {
                    title = provider.toUpperCase() + " - (SUB)";
                    streamUrl = data.sub.url || data.sub.default || data.sub.preferred.url || data.sub;
                }

                // let headers = data.headers;

                return {
                    title,
                    streamUrl,
                    headers,
                };
            })(),

            (async () => {
                const apiUrl = `https://anikuro.ru/api/getsources/?id=${anilistId}&lol=${provider}&ep=${episodeNumber}`;

                console.log("API URL: " + apiUrl);

                const res = await soraFetch(apiUrl);

                // console.log("Res: " + JSON.stringify(res));

                const data = await res.json();

                console.log("Data: " + JSON.stringify(data));

                if (data?.error) return null;

                let title = "";
                let streamUrl = "";
                let headers = "";
                if (provider === 'animepahe') {
                    title = "Animepahe - (DUB)"
                    streamUrl = data.dub.url
                        .replace("/stream/", "/hls/")
                        .replace("uwu.m3u8", "owo.m3u8");
                } else if (provider === 'animekai') {
                    title = "AnimeKai - (DUB)"
                    streamUrl = data.dub.default;

                    // if (data.dub.tracks && !subtitles) {
                    //     const subsYeah = data.dub.tracks.find(sub => sub.lang.toLowerCase().startsWith("english"));
                    //     subtitles = subsYeah ? subsYeah.url : "";
                    // };

                    if (data.dub.referer) {
                        headers = {
                            "Referer": data.dub.referer
                        }
                    }
                } else if (provider === 'animez') {
                    title = "Animez - (DUB)"
                    streamUrl = data.dub;
                } else if (provider === 'allani') {
                    title = "AllAnime - (DUB)"
                    streamUrl = data.dub.preferred.url;
                } else if (provider === 'anify') {
                    title = "Anify - (DUB)"
                    streamUrl = data.dub.default;

                    if (data.dub.referer) {
                        headers = {
                            "Referer": data.dub.referer
                        }
                    }
                } else if (provider === 'zoro') {
                    title = "Zoro - (DUB)"
                    streamUrl = data.dub.default;

                    // if (data.dub.tracks && !subtitles) {
                    //     const subsYeah = data.dub.tracks.find(sub => sub.lang.toLowerCase().startsWith("english"));
                    //     subtitles = subsYeah ? subsYeah.url : "";
                    // };

                    if (data.dub.referer) {
                        headers = {
                            "Referer": data.dub.referer
                        }
                    }
                } else if (provider === 'anixl') {
                    // title = "AniXL - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'animeheaven') {
                    title = "AnimeHeaven - (DUB)"
                    streamUrl = data.dub;
                } else if (provider === 'aniw') {
                    // title = "AniW - (DUB)"
                    // streamUrl = data.dub.default;

                    // if (data.dub.subtitles && !subtitles) {
                    //     const subsYeah = data.dub.subtitles.find(sub => sub.label.toLowerCase().startsWith("english"));
                    //     subtitles = subsYeah ? subsYeah.src : "";
                    // };
                } else if (provider === 'anis') {
                    // title = "AniS - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'animedunya') {
                    title = "AnimeDunya - (DUB)"
                    streamUrl = data.dub.default;

                    // if (data.dub.subtitles && !subtitles) {
                    //     const subsYeah = data.dub.subtitles.find(sub => sub.label.toLowerCase().startsWith("en"));
                    //     subtitles = subsYeah ? subsYeah.src : "";
                    // };
                } else if (provider === 'animix') {
                    title = "AniWave - (DUB)"
                    streamUrl = data.dub.default;
                } else if (provider === 'anitaku') {
                    // title = "AniTaku - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'anihq') {
                    // title = "AniHQ - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'anizone') {
                    // title = "AniZone - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'masterani') {
                    // title = "MasterAni - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'kaa') {
                    // title = "KAA - (DUB)"
                    // streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                } else if (provider === 'anigg') {
                    title = "AnimEGG - (DUB)"
                    streamUrl = data?.dub?.["1080p"] ||
                        data?.dub?.["720p"] ||
                        data?.dub?.["480p"] ||
                        data?.dub?.["360p"] || "";
                } else {
                    title = provider.toUpperCase() + " - (DUB)";
                    streamUrl = data.dub.url || data.dub.default || data.dub.preferred.url || data.dub;
                }

                return {
                    title,
                    streamUrl,
                    headers: "",
                };
            })(),
        ]);

        const results = await Promise.allSettled(tasks);

        const streams = results
            .filter(r => r.status === "fulfilled" && r.value)
            .map(r => r.value);

        const result = { streams, subtitles };
        console.log('Result: ' + JSON.stringify(result));
        return JSON.stringify(result);
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
