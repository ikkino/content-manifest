async function searchResults(keyword) {
    const results = [];
    const headers = {
        "Content-Type": "multipart/form-data; boundary=----geckoformboundary38c356867533a17de80e8c65d9125df5"
    };
    const postData = `------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="s_keyword"

${keyword}
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="orderby"

popular
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="order"

DESC
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="action"

advanced_search
------geckoformboundary38c356867533a17de80e8c65d9125df5
Content-Disposition: form-data; name="page"

1
------geckoformboundary38c356867533a17de80e8c65d9125df5--`;

    try {
        const response = await fetchv2("https://anihq.org/wp-admin/admin-ajax.php", headers, "POST", postData);
        const data = await response.json();
        const html = data.data.html;
        const articlePattern = /<article[^>]*class="anime-card[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
        let articleMatch;
        
        while ((articleMatch = articlePattern.exec(html)) !== null) {
            const articleHtml = articleMatch[1];
            
            const imgMatch = articleHtml.match(/<img[^>]+src=['"]([^'"]+)['"][^>]+alt=['"]([^'"]+)['"]/);
            

            const linkMatch = articleHtml.match(/<h3[^>]*>[\s\S]*?<a[^>]+href=['"]([^'"]+)['"][^>]*title=['"]([^'"]+)['"]/);
            
            if (imgMatch && linkMatch) {
                results.push({
                    title: linkMatch[2].trim(),
                    image: imgMatch[1].trim(),
                    href: linkMatch[1].trim()
                });
            }
        }
        
        return JSON.stringify(results);
    } catch (err) {
        console.log(err);
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
        const html = await response.text();
        
        const descMatch = html.match(/<div\s+data-synopsis[^>]*>([\s\S]*?)<\/div>/);
        let description = "N/A";
        
        if (descMatch) {
            description = descMatch[1]
                .trim()
                .replace(/<[^>]+>/g, '') 
                .replace(/\s+/g, ' ')  
                .trim();
        }
        
        return JSON.stringify([{
            description: description,
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
        const response = await fetchv2(url);
        const html = await response.text();
        
        const watchUrlMatch = html.match(/<a href="([^"]+\/watch\/[^"]+)"/);
        
        if (!watchUrlMatch) {
            return JSON.stringify([{
                href: url,
                number: 1
            }]);
        }

        const watchUrl = watchUrlMatch[1];

        const watchResponse = await fetchv2(watchUrl);
        const watchHtml = await watchResponse.text();

        const episodeRegex = /<a href="([^"]+)"[^>]*class="[^"]*episode-list-item[^"]*"[^>]*data-episode-search-query="(\d+)"[\s\S]*?<span class="episode-list-item-number">\s*(\d+)\s*<\/span>/g;

        let match;
        while ((match = episodeRegex.exec(watchHtml)) !== null) {
            results.push({
                href: match[1].trim(),
                number: parseInt(match[2], 10)
            });
        }

        if (results.length === 0) {
            return JSON.stringify([{
                href: watchUrl,
                number: 1
            }]);
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error: " + err.message,
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
        if (iframeMatch && /^https?:\/\//i.test(iframeMatch[1])) {
            return iframeMatch[1].replace(/&amp;/g, "&");
        }

        const embedMatch = html.match(/data-embed-id=['"][^:'"]+:([^'"]+)['"]/i);
        if (embedMatch) {
            const decoded = atob(embedMatch[1]);
            if (/^https?:\/\//i.test(decoded)) return decoded;
        }

        const legacyMatch = html.match(/<iframe[^>]+src=['"]https:\/\/([^'"]+\.playerp2p\.com)\/#([^'"]+)['"]/);
        if (legacyMatch) {
            return "https://" + legacyMatch[1] + "/#" + legacyMatch[2];
        }

        return "https://error.org/";
    } catch (err) {
        console.log("Error: " + err.message);
        return "https://error.org/";
    }
}
