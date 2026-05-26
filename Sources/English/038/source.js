async function searchResults(keyword) {
    const results = [];
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    try {
        if (keyword.includes('tiktok.com')) {
            const detailResponse = await fetchv2(`https://tikwm.com/api/?url=${encodeURIComponent(keyword)}`);
            const detailData = await detailResponse.json();
            
            if (detailData.code === 0) {
                results.push({
                    title: detailData.data.title.trim(),
                    image: detailData.data.cover.trim(),
                    href: detailData.data.play.trim()
                });
            }
            return JSON.stringify(results);
        }
        
        const body = JSON.stringify({
            keywords: keyword,
            count: 20,
            cursor: 0
        });
        
        const response = await fetchv2('https://tikwm.com/api/feed/search', headers, "POST", body);
        const data = await response.json();

        for (const video of data.data.videos) {
            const videoUrl = `https://www.tiktok.com/@${video.author.unique_id}/video/${video.video_id}`;
            const detailResponse = await fetchv2(`https://tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`);
            const detailData = await detailResponse.json();

            if (detailData.code === 0) {
                results.push({
                    title: detailData.data.title.trim(),
                    image: detailData.data.cover.trim(),
                    href: detailData.data.play.trim()
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        console.error(err);
        return JSON.stringify([{
            title: "Please wait",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        return JSON.stringify([{
            description: "N/A",
            aliases: "N/A",
            airdate: "N/A"
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
    const results = [];
    try {

            results.push({
                href: url,
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

async function extractStreamUrl(url) {
    try {
        return url;
    } catch (err) {
        return "https://error.org/";
    }
}
