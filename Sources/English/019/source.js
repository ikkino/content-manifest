async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://www.tokyoinsider.com/anime/search?k=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<img class="a_img" src="([^"]*)"[^>]*><\/a>[\s\S]*?<a href="([^"]*)" style="font: bold 14px verdana;">([^<]*(?:<span[^>]*>[^<]*<\/span>[^<]*)*)<\/a>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            const titleText = match[3].replace(/<span class="searchhighlight">(.*?)<\/span>/g, '$1').replace(/&nbsp;/g, ' ');
            results.push({
                title: titleText.trim(),
                image: match[1].trim(),
                href: match[2].trim()
            });
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

async function extractDetails(slug) {
    try {
        const response = await fetchv2("https://www.tokyoinsider.com" + slug);
        const html = await response.text();

        let titles = "N/A";
        let airdate = "N/A";
        let description = "N/A";

        const titlesMatch = html.match(/<td width="80" valign="top"><b>Title\(s\):<\/b><\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/);
        if (titlesMatch) {
            titles = titlesMatch[1].replace(/<br>/g, ', ').replace(/\s+/g, ' ').trim();
        }

        const airdateMatch = html.match(/<td valign="top"><b>Vintage:<\/b><\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/);
        if (airdateMatch) {
            airdate = airdateMatch[1].replace(/\s+/g, ' ').trim();
        }

        const summaryMatch = html.match(/<td valign="top" style="border-bottom: 0;"><b>Summary:<\/b><\/td>\s*<td style="border-bottom: 0;">([\s\S]*?)<\/td>\s*<\/tr>/);
        if (summaryMatch) {
            description = summaryMatch[1].replace(/\s+/g, ' ').trim();
        }

        return JSON.stringify([{
            aliases: titles,
            airdate: airdate,
            description: description
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
        const response = await fetchv2("https://www.tokyoinsider.com" + url);
        const html = await response.text();

        const regex = /<div class="episode[^"]*">\s*<div><a class="download-link" href="([^"]*)">[^<]*<em>(\w+)<\/em>\s*<strong>(\d+)<\/strong>(?:<i[^>]*>\s*:\s*([^<]*)<\/i>)?/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            const number = parseInt(match[3], 10);

            results.push({
                href: match[1].trim(),
                number: number,
            });
        }

        return JSON.stringify(results.reverse());
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            type: "Error",
            number: "Error",
            title: "Error"
        }]);
    }
}

async function extractStreamUrl(slug) {
    try {
        const response = await fetchv2("https://www.tokyoinsider.com" + slug);
        const html = await response.text();

        const streams = [];
        
        const containerMatch = html.match(/<div\s+id="inner_page">([\s\S]*?)<div\s+class="fsplit">/);
        if (!containerMatch) {
            return JSON.stringify({
                streams: [],
                subtitle: "Error"
            });
        }
        
        const container = containerMatch[1];
        
        const downloadRegex = /<a\s+href="(https:\/\/media\.tokyoinsider\.com:8080\/[^"]+)"\s*>([^<]+)<\/a>/g;
        
        let match;
        while ((match = downloadRegex.exec(container)) !== null) {
            streams.push({
                title: match[2].trim(),
                streamUrl: match[1].trim(),
                headers: {}
            });
        }

        return JSON.stringify({
            streams: streams,
            subtitle: "None"
        });
    } catch (err) {
        return JSON.stringify({
            streams: [],
            subtitle: "Error"
        });
    }
}
