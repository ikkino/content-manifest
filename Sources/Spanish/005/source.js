function cleanTitle(title) {
    return title
        .replace(/&#8217;/g, "'")  
        .replace(/&#8211;/g, "-")  
        .replace(/&#[0-9]+;/g, ""); 
}

async function searchResults(keyword) {
    const results = [];
    const response = await fetchv2(`https://animenix.com/?s=${keyword}`);
    const html = await response.text();

    const regex = /<article class="bs"[^>]*>.*?<a href="([^"]+)"[^>]*>.*?<img src="([^"]+)"[^>]*>.*?<h2[^>]*>(.*?)<\/h2>/gs;

    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            title: cleanTitle(match[3].trim()),
            image: match[2].trim(),
            href: match[1].trim()
        });
    }

    return JSON.stringify(results);
}

async function extractDetails(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();

    const match = html.match(/<div class="entry-content"[^>]*>([\s\S]*?)<\/div>/);

    let description = "N/A";
    if (match) {
        description = match[1]
            .replace(/<[^>]+>/g, '') 
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code)) 
            .replace(/&quot;/g, '"') 
            .replace(/&apos;/g, "'") 
            .replace(/&amp;/g, "&") 
            .trim();
    }

    results.push({
        description: description,
        aliases: 'N/A',
        airdate: 'N/A'
    });

    return JSON.stringify(results);
}

async function extractEpisodes(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();

    const regex = /<li data-index="\d+">[\s\S]*?<a href="([^"]+)">/g;

    let match;
    let count = 1;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            href: match[1].trim(),
            number: count
        });
        count++;
    }

    results.reverse();
    return JSON.stringify(results.reverse());
}


async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const optionMatch = html.match(/<option value="([^"]+)"[^>]*>\s*YourUpload\s*<\/option>/);
        if (!optionMatch) return "https://error.org/";

        const decodedHtml = atob(optionMatch[1]);

        const iframeMatch = decodedHtml.match(/<iframe[^>]+src="([^"]+)"/);
        if (!iframeMatch) return "https://error.org/";
        const iframeUrl = iframeMatch[1];

        const iframeResponse = await fetchv2(iframeUrl);
        const iframeHtml = await iframeResponse.text();

        const fileMatch = iframeHtml.match(/file:\s*'([^']+\.mp4)'/);
        if (!fileMatch) return "https://error.org/";

        return fileMatch[1];

    } catch (err) {
        return "https://error.org/";
    }
}

