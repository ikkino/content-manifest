async function searchResults(keyword) {
    const results = [];
    try {
        const normalizeTitle = (value) => String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\b(the|a|an)\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const queryTitle = normalizeTitle(keyword);
        const sequelTerms = /\b(season|movie|film|ova|ona|special|new generation|execution)\b/i;

        const response = await fetchv2("https://api3.devcorp.me/vod/search?page=1&keyword=" + encodeURIComponent(keyword.toLowerCase()));
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedData = await decryptedResponse.json();
        console.log(JSON.stringify(decryptedData));
        if (decryptedData.status === 200 && Array.isArray(decryptedData.result)) {
            const mapped = decryptedData.result
                .filter(item => String(item.type || "").toLowerCase() === "anime")
                .map(item => ({
                title: item.title || "Unknown",
                image: item.image || "",
                href: item.id
            }));
            const exact = [];
            const broad = [];
            const sequels = [];
            for (const item of mapped) {
                const normalized = normalizeTitle(item.title);
                if (normalized === queryTitle) {
                    exact.push(item);
                } else if (!sequelTerms.test(keyword) && sequelTerms.test(item.title)) {
                    sequels.push(item);
                } else {
                    broad.push(item);
                }
            }
            results.push(...exact, ...broad, ...sequels);
        }
        console.log(results);
        return JSON.stringify(results);
    } catch (err) {
        console.error(err);
        return JSON.stringify([{ title: "Error", image: "Error", href: "Error" }]);
    }
}

async function extractDetails(ID) {
    try {
        const response = await fetchv2("https://api3.devcorp.me/web/vod/" + ID + "/detail");
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedText = await decryptedResponse.text();
        const decryptedData = JSON.parse(decryptedText);

        const result = decryptedData.result;

        return JSON.stringify([{
            description: result.description || "N/A",
            aliases: Array.isArray(result.otherTitles) ? result.otherTitles.join(", ") : "N/A",
            airdate: result.year || "N/A"
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
        const response = await fetchv2("https://api3.devcorp.me/web/vod/" + ID + "/detail");
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedText = await decryptedResponse.text();
        const decryptedData = JSON.parse(decryptedText);

        const episodes = decryptedData.result.episodes || [];

        for (const ep of episodes) {
            results.push({
                href: ep.id,
                number: parseInt(ep.episode, 10)
            });
        }

        return JSON.stringify(results.reverse());
    } catch (err) {
        return JSON.stringify([{ href: "Error", number: "Error" }]);
    }
}

async function extractStreamUrl(href) {
    try {
        const parts = href.split("-episode-");
        const id = parts[0];
        const episodeNumber = parts[1];

        const response = await fetchv2("https://api3.devcorp.me/web/vod/" + id + "/episode/" + episodeNumber);
        const encrypted = await response.text();

        const headers = { "Content-Type": "application/json" };
        const postData = JSON.stringify({ text: encrypted });

        const decryptedResponse = await fetchv2("https://enc-dec.app/api/dec-onetouchtv", headers, "POST", postData);
        const decryptedText = await decryptedResponse.text();
        const decryptedData = JSON.parse(decryptedText);

        const sources = decryptedData.result.sources;
        const tracks = decryptedData.result.track;

        const stream = sources.find(s => s.url && (s.url.includes(".mp4") || s.url.includes(".m3u8")));
        if (!stream?.url) {
            return JSON.stringify({ streams: [], subtitle: null });
        }
        const subtitle = tracks.find(t => t.name && t.name.toLowerCase().includes("english"));

        return JSON.stringify({
            streams: [{
                title: "Default",
                streamUrl: stream.url,
                headers: stream.headers || {}
            }],
            subtitle: subtitle ? subtitle.file : null
        });
    } catch (err) {
        return JSON.stringify({ streams: [], subtitle: null });
    }
}
