async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try { return await fetch(url, options); } catch (_) { return null; }
    }
}

function customAtob(base64Str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(base64Str).replace(/=+$/, '');
    let output = '';
    if (str.length % 4 === 1) throw new Error('Base64 string non-conforming');

    for (
        let bc = 0, bs, buffer, idx = 0;
        (buffer = str.charAt(idx++));
        ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
            ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
            : 0
    ) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

function TestAtob(base64Str) {
    try { return atob(base64Str); } catch (e) { return customAtob(base64Str); }
}

function xorDecode(encoded, key) {
    try {
        if (!encoded) return '';
        const decoded = TestAtob(encoded);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    } catch (e) { return ''; }
}

const hrefXor = (encoded, key = 'asxwqa147') => xorDecode(encoded, key);
const decryptXorBase64 = (data, key = 'AQWXZSCED@@POIUYTRR159') =>
    data ? xorDecode(data, key).replace(/^"|"$/g, '') : null;

const buildQueryString = obj =>
    Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`).join('&');

const grab = (html, re) => (html.match(re) || [])[1]?.trim() || '';

function numberToAlphabet(number) {
    let result = "";
    number = parseInt(number, 10);
    while (number > 0) {
        const remainder = (number - 1) % 26;
        result = String.fromCharCode(remainder + 97) + result;
        number = Math.floor((number - 1) / 26);
    }
    return result;
}

function generateAnimeUrlPath(animeName) {
    return (animeName || "")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();
}

function animeUrl(name, id) {
    return generateAnimeUrlPath(name) + "-" + numberToAlphabet(id);
}

async function searchResults(keyword) {
    try {
        const pageNumbers = Array.from({ length: 30 }, (_, i) => i + 1);

        const requests = pageNumbers.map(async (page) => {
            try {
                const qs = buildQueryString({ _api: 1, keyword, page });
                const res = await soraFetch(`https://animeslayer.to/browse?${qs}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animeslayer.to/' }
                });
                if (!res) return [];

                const json = JSON.parse(await res.text());
                if (!json.success || !Array.isArray(json.data)) return [];

                return json.data.map(item => ({
                    title: item.anime_name,
                    image: item.anime_cover_image_url,
                    href: `https://animeslayer.to/title/${animeUrl(item.anime_name, item.anime_id)}`
                }));
            } catch (_) {
                return [];
            }
        });

        const pagesResults = await Promise.all(requests);
        const flatResults = pagesResults.flat();

        return JSON.stringify(flatResults);
    } catch (e) {
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const html = await (await soraFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animeslayer.to/' } })).text();

        const description = grab(html, /property=["']og:description["']\s+content=["']([^"']+)["']/i)
            .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'") || 'لا يوجد وصف';

        const studio = grab(html, /الاستوديو<\/span>\s*<div class="tag-list"><span class="tag">([^<]+)/) || 'Unknown';
        const source = grab(html, /مقتبس من<\/span><span>([^<]+)/);
        const status = grab(html, /حالة الأنمي<\/span><span><a[^>]*>([^<]+)/) || 'Unknown';
        const airdate = grab(html, /الحلقة الأولى<\/span><span>([^<]+)/) || 'Unknown';

        return JSON.stringify({
            description,
            aliases: source ? `${studio} | ${source}` : studio,
            airdate: `${status} | ${airdate}`
        });
    } catch (e) {
        return JSON.stringify({ description: 'Error loading description', aliases: 'Unknown', airdate: 'Unknown' });
    }
}

async function extractEpisodes(url) {
    try {
        const res = await soraFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animeslayer.to/' } });
        if (!res) return JSON.stringify([]);

        const html = typeof res.text === 'function' ? await res.text() : String(res);
        if (!html || html.length < 100) return JSON.stringify([]);

        const epBlockMatch = html.match(/const\s+episodes\s*=\s*(\[[\s\S]*?\])/);
        if (epBlockMatch) {
            const epMatches = [...epBlockMatch[1].matchAll(/{\s*n\s*:\s*(\d+)\s*,[\s\S]*?href\s*:\s*["']([^"']+)["']/g)];
            if (epMatches.length > 0) {
                return JSON.stringify(epMatches.map(m => ({
                    href: 'https://animeslayer.to' + hrefXor(m[2]),
                    number: parseInt(m[1], 10)
                })));
            }
        }

        const cards = [...html.matchAll(/class="ep-card[^"]*"[^>]*data-href="([^"]+)"[\s\S]*?الحلقة\s*(\d+)/g)];
        if (cards.length > 0) {
            return JSON.stringify(cards.map(m => ({
                href: 'https://animeslayer.to' + hrefXor(m[1]),
                number: parseInt(m[2], 10)
            })));
        }

        return JSON.stringify([]);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function fetchVideoLinks(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
    try {
        const res = await soraFetch(url, { headers: { 'Referer': 'https://animeslayer.to/' } });
        if (!res) return null;

        const html = typeof res.text === 'function' ? await res.text() : String(res);
        const videos = [];
        const regex = /src:\s*['"]([^'"]+)['"][\s\S]*?res:\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            videos.push({ url: match[1], quality: match[2] });
        }
        return videos.length > 0 ? videos : null;
    } catch (e) {
        return null;
    }
}

async function extractStreamUrl(url) {
    try {
        if (!url) return JSON.stringify({ type: "servers", streams: [], subtitle: null });

        const hash = (url.match(/#([^?#]+)/) || [])[1] || "";
        const cleanPath = url.split('#')[0].split('?')[0];
        const parts = cleanPath.split('/');
        const lastSegment = parts[parts.length - 1] || parts[parts.length - 2] || "";
        const dashParts = lastSegment.split('-');
        const ep = dashParts.length > 1 ? dashParts[dashParts.length - 1] : "";

        const flareRes = await soraFetch("https://patrimoines-en-mouvement.org/lib/flare/v3.php", {
            headers: { 'Referer': 'https://animeslayer.to/' }
        });
        if (!flareRes) throw new Error("Flare API null");
        const apiUrls = JSON.parse(await flareRes.text());

        const firstRes = await soraFetch(apiUrls.first, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: buildQueryString({ pe: ep, hash })
        });
        if (!firstRes) throw new Error("First API null");
        const firstData = JSON.parse(await firstRes.text());

        const pageRes = await soraFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://animeslayer.to/' } });
        if (!pageRes) throw new Error("Page null");
        const pageHtml = await pageRes.text();

        const extract = k => (pageHtml.match(new RegExp(`const\\s+${k}\\s*=\\s*(['"])(.*?)\\1`)) || [])[2] || "";

        const secRes = await soraFetch(apiUrls.sec, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: buildQueryString({
                keyn: firstData.d,
                name: extract("name"),
                pe: firstData.c,
                bool: extract("bool") || "yes",
                id: firstData.a,
                info: firstData.b,
                san: extract("san"),
                mwsem: extract("mwsem")
            })
        });
        if (!secRes) throw new Error("Second API null");
        const finalObj = JSON.parse(await secRes.text());
        const streams = [];

        const processDecryptedUrl = async (decryptedUrl, titlePrefix) => {
            if (!decryptedUrl) return;
            const videos = await fetchVideoLinks(decryptedUrl);
            if (videos) {
                videos.forEach(v => streams.push({
                    title: `${titlePrefix} - ${v.quality}p`,
                    streamUrl: v.url,
                    headers: { Referer: "https://animeslayer.to/" }
                }));
            } else {
                streams.push({ title: titlePrefix, streamUrl: decryptedUrl, headers: { Referer: "https://animeslayer.to/" } });
            }
        };

        if (finalObj.data) await processDecryptedUrl(decryptXorBase64(finalObj.data), "Main");
        if (finalObj.servers && typeof finalObj.servers === 'object') {
            for (const [serverName, encLink] of Object.entries(finalObj.servers)) {
                await processDecryptedUrl(decryptXorBase64(encLink), serverName);
            }
        }

        return JSON.stringify({ type: "servers", streams, subtitle: null });
    } catch (error) {
        return JSON.stringify({ type: "servers", streams: [], subtitle: null });
    }
}
