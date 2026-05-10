// Search, Details and Episodes function are from ibro's module.

async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await soraFetch(`https://kisskh.co/api/DramaList/Search?q=${encodedKeyword}&type=0`);
        const data = await responseText.json();

        const transformedResults = data.map(result => {
            const editedTitle = result.title.replace(/[\s()']/g, '-');

            return {
                title: result.title,
                image: result.thumbnail,
                href: `https://kisskh.co/Drama/${editedTitle}?id=${result.id}`
            };
        });

        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Fetch error in searchResults:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const match = url.match(/https:\/\/kisskh\.co\/Drama\/([^\/]+)\?id=([^\/]+)/);
        if (!match) throw new Error("Invalid URL format");

        const showId = match[2];
        const responseText = await soraFetch(`https://kisskh.co/api/DramaList/Drama/${showId}?isq=false`);
        const data = await responseText.json();

        const transformedResults = [{
            description: data.description || 'No description available',
            aliases: ``,
            airdate: `Released: ${data.releaseDate ? data.releaseDate : 'Unknown'}`
        }];

        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Duration: Unknown',
            airdate: 'Aired/Released: Unknown'
        }]);
    }
}

async function extractEpisodes(url) {
    try {
        const match = url.match(/https:\/\/kisskh\.co\/Drama\/([^\/]+)\?id=([^\/]+)/);
        if (!match) throw new Error("Invalid URL format");
        const showTitle = match[1];
        const showId = match[2];

        const showResponseText = await soraFetch(`https://kisskh.co/api/DramaList/Drama/${showId}?isq=false`);
        const showData = await showResponseText.json();

        const episodes = showData.episodes?.map(episode => ({
            href: `https://kisskh.co/Drama/${showTitle}/Episode-${episode.number}?id=${showId}&ep=${episode.id}`,
            number: episode.number,
            title: episode.name || `Episode ${episode.number}` ||  ""
        }));

        const reversedEpisodes = episodes.reverse();

        console.log(reversedEpisodes);
    
        return JSON.stringify(reversedEpisodes);
    } catch (error) {
        console.log('Fetch error in extractEpisodes:', error);
        return JSON.stringify([]);
    }    
}

async function extractStreamUrl(url) {
    try {
        const episodeID = url.split('&ep=')[1];

        const decryptedStreamResponse = await soraFetch(`https://enc-dec.app/api/enc-kisskh?text=${episodeID}&type=vid`);
        const decryptedStreamData = await decryptedStreamResponse.json();
        const streamkKey = decryptedStreamData.result;

        const decryptedSubtitlesResponse = await soraFetch(`https://enc-dec.app/api/enc-kisskh?text=${episodeID}&type=sub`);
        const decryptedSubtitlesData = await decryptedSubtitlesResponse.json();
        const subtitlesKey = decryptedSubtitlesData.result;

        const streamResponse = await soraFetch(`https://kisskh.co/api/DramaList/Episode/${episodeID}.png?err=false&ts=null&time=null&kkey=${streamkKey}`);
        const streamData = await streamResponse.json();
        const streamUrl = streamData.Video;

        const subtitlesResponse = await soraFetch(`https://kisskh.co/api/Sub/${episodeID}?kkey=${subtitlesKey}`);
        const subtitlesData = await subtitlesResponse.json();
        const englishSubtitle = subtitlesData.find(sub => sub.land === "en");
        const englishSubtitleUrl = englishSubtitle?.src || "none";

		let formattedSubtitleUrl = englishSubtitleUrl;
		if (/\?v=/.test(englishSubtitleUrl)) {
			formattedSubtitleUrl = "https://kisskh-five.vercel.app/api/proxy?url=" + encodeURIComponent(englishSubtitleUrl);
		}

        if (streamUrl) {
            const results = {
                streams: [{
                    title: "Stream",
                    streamUrl,  
                    headers: {
                        "Referer": "https://kisskh.co/",
                        "Origin": "https://kisskh.co"
                    },
                }],
            subtitles: formattedSubtitleUrl
            }

            return JSON.stringify(results);
        } else {
            return "";
        }
    } catch (error) {
        console.log('Fetch error in extractStreamUrl:', error);
        return null;
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

