async function searchResults(keyword) {
    const results = [];

    try {
        const url = "https://an1me.to/wp-admin/admin-ajax.php?action=instant_search&query=" + encodeURIComponent(keyword);
        const headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://an1me.to/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        };
        const response = await fetchv2(url, headers);
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            return JSON.stringify(results);
        }

        if (!data.success || !data.data || !data.data.html) {
            return JSON.stringify(results);
        }

        const html = data.data.html;
        const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g;
        let anchorMatch;
        let matchCount = 0;

        while ((anchorMatch = anchorPattern.exec(html)) !== null) {
            matchCount++;
            const href = anchorMatch[1];
            const title = anchorMatch[2];
            const innerHtml = anchorMatch[3];

            const imgMatch = innerHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/);

            if (imgMatch) {
                results.push({
                    title: title.trim(),
                    image: imgMatch[1].trim(),
                    href: href.trim()
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        console.log("Search error:", err.message);
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Referer": "https://an1me.to/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        };
        const response = await fetchv2(url, headers);
        const html = await response.text();

        const match = html.match(/aria-label="Anime Overview"[^>]*>([\s\S]*?)<\/section>/);

        const description = match
            ? match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            : "N/A";

        return JSON.stringify([{
            description,
            aliases: "N/A",
            airdate: "N/A"
        }]);
    } catch (err) {
        console.log("extractDetails error:", err.message);
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}


async function extractEpisodes(url) {
    const results = [];
    try {
        const headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://an1me.to/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        };
        const response = await fetchv2(url, headers);
        const html = await response.text();

        const postIdMatch = html.match(/postid-(\d+)/) ||
                          html.match(/post_id['"]\s*,\s*['"](\d+)['"]/) ||
                          html.match(/anime_id['"]\s*:\s*(\d+)/);

        if (!postIdMatch) {
            console.log("Could not find anime_id (postid)");
            return JSON.stringify(results);
        }

        const animeId = postIdMatch[1];

        const firstPageUrl = `https://an1me.to/wp-admin/admin-ajax.php?action=get_episodes&anime_id=${animeId}&page=1&order=desc`;
        const firstPageRes = await fetchv2(firstPageUrl, headers);
        const firstPageData = await firstPageRes.json();

        if (firstPageData.success && firstPageData.data && Array.isArray(firstPageData.data.episodes)) {
            firstPageData.data.episodes.forEach(ep => {
                results.push({
                    href: ep.url,
                    number: parseFloat(ep.meta_number)
                });
            });

            const maxPages = firstPageData.data.max_episodes_page || 1;

            if (maxPages > 1) {
                const promises = [];
                for (let i = 2; i <= maxPages; i++) {
                    const pageUrl = `https://an1me.to/wp-admin/admin-ajax.php?action=get_episodes&anime_id=${animeId}&page=${i}&order=desc`;
                    promises.push(fetchv2(pageUrl, headers).then(res => res.json()));
                }

                const otherPagesData = await Promise.all(promises);
                otherPagesData.forEach(data => {
                    if (data.success && data.data && Array.isArray(data.data.episodes)) {
                        data.data.episodes.forEach(ep => {
                            results.push({
                                href: ep.url,
                                number: parseFloat(ep.meta_number)
                            });
                        });
                    }
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        console.log("Error in extractEpisodes:", err);
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Referer": "https://an1me.to/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        };
        const response = await fetchv2(url, headers);
        const html = await response.text();

        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (!iframeMatch) throw new Error("Iframe not found");

        let iframeUrl = iframeMatch[1].replace(/&#038;/g, '&').replace(/&amp;/g, '&');
        const iframeResponse = await fetchv2(iframeUrl, headers);
        const iframeHtml = await iframeResponse.text();

        const paramsMatch = iframeHtml.match(/const\s+params\s*=\s*({.*?});/s);
        if (!paramsMatch) throw new Error("Params not found");

        const params = JSON.parse(paramsMatch[1]);
        const streamUrl = params.sources?.[0]?.url;

        console.log("Stream URL secured:", streamUrl);
        return streamUrl || "https://files.catbox.moe/avolvc.mp4";
    } catch (err) {
        console.log("extractStreamUrl error:", err.message);
        return "https://files.catbox.moe/avolvc.mp4";
    }
}
