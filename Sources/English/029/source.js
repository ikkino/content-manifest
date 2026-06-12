async function searchResults(keyword) {
    const results = [];
    try {
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/;
        const youtubeMatch = keyword.match(youtubeRegex);
        
        if (youtubeMatch) {
            const videoId = youtubeMatch[1];
            try {
                const response = await fetchv2("https://invidious.nikkosphere.com/api/v1/videos/" + videoId);
                const data = await response.json();
                
                results.push({
                    title: data.title || "YouTube Video",
                    image: "https://proxy.piped.private.coffee" + (data.videoThumbnails && data.videoThumbnails.length > 0 ? data.videoThumbnails[0].url : ""),
                    href: videoId
                });
                
                return JSON.stringify(results);
            } catch (err) {
                console.error("Error fetching YouTube video:", err);
                return JSON.stringify([{
                    title: "Error",
                    image: "Error",
                    href: "Error"
                }]);
            }
        }
        
        const response = await fetchv2("https://api.piped.private.coffee/search?q=" + encodeURIComponent(keyword) + "&filter=all");
        const data = await response.json();

        if (data && Array.isArray(data.items)) {
            for (const item of data.items) {
                if (item.type === "stream") {
                    const videoId = item.url ? item.url.replace("/watch?v=", "") : "";
                    results.push({
                        title: item.title || "",
                        image: item.thumbnail || "",
                        href: videoId
                    });
                }
            }
        }

        let nextpage = data.nextpage;
        if (nextpage) {
            try {
                const response2 = await fetchv2("https://api.piped.private.coffee/nextpage/search?nextpage=" + encodeURIComponent(nextpage) + "&q=" + encodeURIComponent(keyword) + "&filter=all");
                const data2 = await response2.json();

                if (data2 && Array.isArray(data2.items)) {
                    for (const item of data2.items) {
                        if (item.type === "stream") {
                            const videoId = item.url ? item.url.replace("/watch?v=", "") : "";
                            results.push({
                                title: item.title || "",
                                image: item.thumbnail || "",
                                href: videoId
                            });
                        }
                    }
                }

                nextpage = data2.nextpage;
                if (nextpage) {
                    const response3 = await fetchv2("https://api.piped.private.coffee/nextpage/search?nextpage=" + encodeURIComponent(nextpage) + "&q=" + encodeURIComponent(keyword) + "&filter=all");
                    const data3 = await response3.json();

                    if (data3 && Array.isArray(data3.items)) {
                        for (const item of data3.items) {
                            if (item.type === "stream") {
                                const videoId = item.url ? item.url.replace("/watch?v=", "") : "";
                                results.push({
                                    title: item.title || "",
                                    image: item.thumbnail || "",
                                    href: videoId
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching additional pages:", err);
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        console.error(err);
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(ID) {
    try {
        const response = await fetchv2("https://invidious.nikkosphere.com/api/v1/videos/" + ID);
        const data = await response.json();

        return JSON.stringify([{
            description: data.description,
            aliases: data.author,
            airdate: data.publishedText
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}

async function extractEpisodes(ID) {
    const results = [];
    try {

            results.push({
                href: ID,
                number: 1
            });

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(ID) {
    try {
        const response = await fetchv2("https://invidious.nikkosphere.com/api/v1/videos/" + ID);
        const data = await response.json();

        if (data && Array.isArray(data.formatStreams) && data.formatStreams.length > 0) {
            return data.formatStreams[0].url || "https://error.org/";
        }

        return "https://error.org/";
    } catch (err) {
        return "https://error.org/";
    }
}
