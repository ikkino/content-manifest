async function searchResults(keyword) {
    const results = [];

    const articleRegex = /<article[^>]*class="post-item[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    const imageRegex = /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/;
    const linkRegex = /<a[^>]*class="post-listing-title"[^>]*href="([^"]+)"[^>]*title="[^"]*">([^<]+)<\/a>/;
    
    try {
        const response = await fetchv2("https://www.1tamilcrow.net/?s=" + keyword);
        const html = await response.text();
        
        let match;
        while ((match = articleRegex.exec(html)) !== null) {
            const articleContent = match[1];
            

            const imageMatch = imageRegex.exec(articleContent);
            const image = imageMatch ? imageMatch[1].trim() : "No Image";
            

            const linkMatch = linkRegex.exec(articleContent);
            if (linkMatch) {
                results.push({
                    href: linkMatch[1].trim(),
                    title: decodeHtml(linkMatch[2].trim()),
                    image: image
                });
            }
        }
        
        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{ title: "Error", image: "Error", href: "Error" }]);
    }
}

function decodeHtml(str) {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&#8217;/g, "’")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}


async function extractDetails(url) {
    try {
        return JSON.stringify([{
            description: "No description on the website",
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

        const regex = /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi;
        let match;
        let foundUrl = null;
        
        while ((match = regex.exec(html)) !== null) {
            const iframeUrl = match[1].trim();
            if (!iframeUrl.includes('voe.sx')) {
                foundUrl = iframeUrl;
                break;
            }
        }
        
        if (foundUrl) {
            results.push({
                href: foundUrl,
                number: 1
            });
        } else {
            results.push({
                href: url,
                number: 1
            });
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
        const obfuscatedScript = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
        const unpackedScript = unpack(obfuscatedScript[1]);
        
        const hls2Match = unpackedScript.match(/["']hls2["']\s*:\s*["']([^"']+)["']/);
        
        if (hls2Match && hls2Match[1]) {
            const hlsUrl = hls2Match[1];
            console.log("HLS2 Link:", hlsUrl);
            return hlsUrl;
        }
        
        const m3u8Match = unpackedScript.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/);
        if (m3u8Match && m3u8Match[1]) {
            console.log("Fallback M3U8 Link:", m3u8Match[1]);
            return m3u8Match[1];
        }
        
        return "https://files.catbox.moe/avolvc.mp4";
    } catch (err) {
        console.log(err);
        return "https://files.catbox.moe/avolvc.mp4";
    }
}


/***********************************************************
 * UNPACKER MODULE
 * Credit to GitHub user "mnsrulz" for Unpacker Node library
 * https://github.com/mnsrulz/unpacker
 ***********************************************************/
class Unbaser {
    constructor(base) {
        /* Functor for a given base. Will efficiently convert
          strings to natural numbers. */
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        // fill elements 37...61, if necessary
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[base] ||
                this.ALPHABET[62].substr(0, base);
        }
        // If base can be handled by int() builtin, let it do it for us
        if (2 <= base && base <= 36) {
            this.unbase = (value) => parseInt(value, base);
        }
        else {
            // Build conversion dictionary cache
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
        /* Decodes a value to an integer. */
        let ret = 0;
        [...value].reverse().forEach((cipher, index) => {
            ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
        });
        return ret;
    }
}

function detect(source) {
    /* Detects whether `source` is P.A.C.K.E.R. coded. */
    return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

function unpack(source) {
    /* Unpacks P.A.C.K.E.R. packed js code. */
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
        /* Look up symbols in the synthetic symtab. */
        const word = match;
        let word2;
        if (radix == 1) {
            //throw Error("symtab unknown");
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
        /* Juice from a source file the four args needed by decoder. */
        const juicers = [
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
        ];
        for (const juicer of juicers) {
            //const args = re.search(juicer, source, re.DOTALL);
            const args = juicer.exec(source);
            if (args) {
                let a = args;
                if (a[2] == "[]") {
                    //don't know what it is
                    // a = list(a);
                    // a[1] = 62;
                    // a = tuple(a);
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
        /* Strip string lookup table (list) and replace values in source. */
        /* Need to work on this. */
        return source;
    }
}
