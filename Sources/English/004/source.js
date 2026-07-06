async function searchResults(keyword) {
    const results = [];
    const postData = `{"searchTerm":"${keyword}","page":1,"limit":100}`;
    try {
        const response = await fetchv2("https://senshi.live/anime/filter", { "Content-Type": "application/json", "Referer": "https://senshi.live/" }, "POST", postData);
        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
            for (const item of data.data) {
                results.push({
                    title: item.title,
                    image: "https://senshi.live" + item.anime_picture,
                    href: "https://senshi.live/anime/" + item.id
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const data = await response.json();

        return JSON.stringify([{
            description: data.ani_description,
            aliases: data.synonyms,
            airdate: data.created_at
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}

async function extractEpisodes(url) {
    const ID = url.split("/").pop();
    const results = [];
    try {
        const response = await fetchv2("https://senshi.live/episodes/" + ID, {"Referer": "https://senshi.live/"});
        const data = await response.json();

        if (Array.isArray(data)) {
            for (const ep of data) {
                results.push({
                    href: "https://senshi.live/episode-embeds/" + ep.mal_id + "/" + ep.ep_id,
                    number: ep.ep_id
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url, {"Referer": "https://senshi.live/"});
        const data = await response.json();

        const streams = [];
        const count = {};
        for (const item of data) {
            const status = item.status;
            if (!count[status]) count[status] = 0;
            count[status]++;
            const title = count[status] > 1 ? `${status} ${count[status]}` : status;
            streams.push({
                title: title,
                streamUrl: item.url,
                headers: { "Referer": "https://senshi.live/" }
            });
        }

        return JSON.stringify({
            streams: streams,
            subtitle: ""
        });
    } catch (err) {
        return JSON.stringify({
            streams: [],
            subtitle: ""
        });
    }
}
