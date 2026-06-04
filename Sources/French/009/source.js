async function searchResults(keyword) {
    try {
        const response = await fetchv2(`https://coflix.cc/suggest.php?query=${encodeURIComponent(keyword)}`);
        const data = await response.json();

        if (!Array.isArray(data)) {
            return JSON.stringify([]);
        }

        const results = [];

        for (const item of data) {
            let imgUrl = '';
            const imgMatch = item.image.match(/src="([^"]+)"/);
            if (imgMatch && imgMatch[1]) {
                const src = imgMatch[1].trim();
                imgUrl = src.startsWith('//') ? 'https:' + src : src;
            }

            const href = item.url.trim();

            results.push({
                title: item.title.trim(),
                image: imgUrl,
                href: href
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        console.error("Search failed:", err);
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const match = html.match(/<div aria-label="Description"[^>]*>\s*<p>(.*?)<\/p>/s);
        const description = match ? match[1].trim() : "N/A";

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
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const seasonMatch = html.match(/<span class="fz12 ttu fwb db mb1 primary-co">(\d+) seasons?/i);
        const totalSeasons = seasonMatch ? parseInt(seasonMatch[1], 10) : null;

        const postIdMatch = html.match(/<body[^>]+postid-(\d+)/i);
        const postId = postIdMatch ? postIdMatch[1] : null;

        const results = [];

        if (!totalSeasons || !postId) {
            results.push({
                href: url,
                number: 1
            });
        } else {
            for (let season = 1; season <= totalSeasons; season++) {
                const apiUrl = `https://coflix.cc/wp-json/apiflix/v1/series/${postId}/${season}`;
                const seasonResp = await fetchv2(apiUrl);
                const seasonData = await seasonResp.json();

                if (seasonData.episodes && Array.isArray(seasonData.episodes)) {
                    seasonData.episodes.forEach(ep => {
                        results.push({
                            href: ep.links,
                            number: parseInt(ep.number, 10)
                        });
                    });
                }
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
        const response = await fetchv2(url);
        const html = await response.text();

        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
        const iframeUrl = iframeMatch ? iframeMatch[1] : null;
        if (!iframeUrl) throw new Error("Iframe not found");
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Referer": "https://coflix.dance",
            "origin": "https://coflix.dance"
        };
        console.log("Iframe URL: " + iframeUrl);    
        const iframeResp = await fetchv2(iframeUrl, headers);
        const iframeHtml = await iframeResp.text();

        const uqloadMatch = iframeHtml.match(/showVideo\('([^']+)'[^\)]+\)">\s*<img[^>]+uqload/i);
        if (uqloadMatch) {
            const uqload = atob(uqloadMatch[1]);
            console.log("Uqload URL:" + uqload);
            const uqResp = await fetchv2(uqload);
            const uqHtml = await uqResp.text();
            
            let uqMatchUrl = null;
            const obfuscatedScriptMatch = uqHtml.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
            if (obfuscatedScriptMatch) {
                const deobfuscated = unpack(obfuscatedScriptMatch[1]);
                const m3u8Match = deobfuscated.match(/file:\s*"([^"]+\.m3u8[^"]*)"/i) || deobfuscated.match(/sources:\s*\[\s*\{\s*file:\s*"([^"]+\.m3u8[^"]*)"/i);
                if (m3u8Match) {
                    uqMatchUrl = m3u8Match[1];
                } else {
                    const mp4Match = deobfuscated.match(/sources:\s*\[\s*"([^"]+\.mp4)"/);
                    if (mp4Match) uqMatchUrl = mp4Match[1];
                }
            } else {
                const mp4Match = uqHtml.match(/sources:\s*\[\s*"([^"]+\.mp4)"/);
                if (mp4Match) uqMatchUrl = mp4Match[1];
            }

            if (uqMatchUrl) {
                console.log("Found Uqload Video URL: " + uqMatchUrl);
                return JSON.stringify({
                    streams: [{
                        title: "Uqload",
                        streamUrl: uqMatchUrl,
                        headers: { "Referer": uqload }
                    }],
                    subtitle: ""
                });
            }
        }

        return JSON.stringify({ streams: [], subtitle: "" });

    } catch (err) {
        return JSON.stringify({ streams: [], subtitle: "" });
    }
}

class Unbaser {
    constructor(base) {
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[base] ||
                this.ALPHABET[62].substr(0, base);
        }
        if (2 <= base && base <= 36) {
            this.unbase = (value) => parseInt(value, base);
        }
        else {
            try {
                [...this.ALPHABET[base]].forEach((cipher, index) => {
                    this.dictionary[cipher] = index;
                });
            }
            catch (er) {
                throw Error("Unsupported base encoding.");
            }
            this.unbase = this._dictunbaser;
        }
    }
    _dictunbaser(value) {
        let ret = 0;
        [...value].reverse().forEach((cipher, index) => {
            ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
        });
        return ret;
    }
}


function unpack(source) {
    let { payload, symtab, radix, count } = _filterargs(source);
    if (count != symtab.length) {
        throw Error("Malformed p.a.c.k.e.r. symtab.");
    }
    let unbase;
    try {
        unbase = new Unbaser(radix);
    }
    catch (e) {
        throw Error("Unknown p.a.c.k.e.r. encoding.");
    }
    function lookup(match) {
        const word = match;
        let word2;
        if (radix == 1) {
            word2 = symtab[parseInt(word)];
        }
        else {
            word2 = symtab[unbase.unbase(word)];
        }
        return word2 || word;
    }
    source = payload.replace(/\b\w+\b/g, lookup);
    return _replacestrings(source);
    function _filterargs(source) {
        const juicers = [
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
        ];
        for (const juicer of juicers) {
            const args = juicer.exec(source);
            if (args) {
                let a = args;
                if (a[2] == "[]") {
                }
                try {
                    return {
                        payload: a[1],
                        symtab: a[4].split("|"),
                        radix: parseInt(a[2]),
                        count: parseInt(a[3]),
                    };
                }
                catch (ValueError) {
                    throw Error("Corrupted p.a.c.k.e.r. data.");
                }
            }
        }
        throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
    }
    function _replacestrings(source) {
        return source;
    }
}


/**
 * Uses Sora's fetchv2 on ipad, fallbacks to regular fetch on Windows
 * @author ShadeOfChaos
 *
 * @param {string} url The URL to make the request to.
 * @param {object} [options] The options to use for the request.
 * @param {object} [options.headers] The headers to send with the request.
 * @param {string} [options.method='GET'] The method to use for the request.
 * @param {string} [options.body=null] The body of the request.
 *
 * @returns {Promise<Response|null>} The response from the server, or null if the
 * request failed.
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
    }
}
/* REMOVE_END */

/* SCHEME END */

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charAt(i);
        if (char === '=') break;
        const index = chars.indexOf(char);
        if (index === -1) continue;
        buffer = (buffer << 6) | index;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            str += String.fromCharCode((buffer >> bits) & 0xFF);
            buffer &= (1 << bits) - 1;
        }
    }
    return str;
}
