async function getDomainsList() {
    try {
        const response = await fetchv2("https://anime-sama.pw/");
        const html = await response.text();

        const domainRegex = /{ name: '([^']+)' }/g;
        const domains = [];
        let match;
        while ((match = domainRegex.exec(html)) !== null) {
            domains.push(match[1]);
        }

        return domains.length > 0 ? domains : ["anime-sama.tv"];
    } catch (err) {
        return ["anime-sama.tv"];
    }
}

async function searchResults(keyword) {
    const domains = await getDomainsList();
    const regex = /<a[^>]+href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3[^>]*>(.*?)<\/h3>/gi;

    const firstDomain = domains[0];
    const firstResult = await trySearch(firstDomain, keyword, regex);
    if (firstResult && firstResult.length > 0) {
        return JSON.stringify(firstResult);
    }

    const otherDomains = domains.slice(1);
    const promises = otherDomains.map(domain => trySearch(domain, keyword, regex));
    const results = await Promise.all(promises);

    for (let result of results) {
        if (result && result.length > 0) {
            return JSON.stringify(result);
        }
    }

    return JSON.stringify([]);
}

async function trySearch(domain, keyword, regex) {
    try {
        const headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "referer": `https://${domain}/`
        };

        const response = await fetchv2(
            `https://${domain}/template-php/defaut/fetch.php`,
            headers,
            "POST",
            `query=${encodeURIComponent(keyword)}`
        );
        const html = await response.text();

        const results = [];
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[3].trim(),
                image: match[2].trim(),
                href: match[1].trim()
            });
        }
        
        return results;
    } catch (err) {
        return [];
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const regex = /<p class="text-sm text-gray-400 mt-2">(.*?)<\/p>/is;
        const match = regex.exec(html);

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
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        
        const seasonRegex = /panneauAnime\("([^"]+)",\s*"([^"]+)"\);/g;
        let match;
        
        const seasonUrls = [];
        while ((match = seasonRegex.exec(html)) !== null) {
            const seasonHref = match[2].trim();
            const fullSeasonUrl = url + '/' + seasonHref;
            
            seasonUrls.push(fullSeasonUrl);
        }
        
        const seasonPromises = seasonUrls.map(seasonUrl => fetchv2(seasonUrl));
        const seasonResponses = await Promise.all(seasonPromises);
        
        for (let i = 0; i < seasonResponses.length; i++) {
            const seasonResponse = seasonResponses[i];
            const seasonHtml = await seasonResponse.text();
            const seasonUrl = seasonUrls[i];
            
            const episodeScriptRegex = /<script[^>]+src=['"]([^'"]*episodes\.js[^'"]*?)['"][^>]*>/;
            const scriptMatch = episodeScriptRegex.exec(seasonHtml);
            
            if (scriptMatch) {
                const episodesSrc = scriptMatch[1].trim();
                const fullEpisodesUrl = seasonUrl + '/' + episodesSrc;
                                
                const episodesResponse = await fetchv2(fullEpisodesUrl);
                const episodesJs = await episodesResponse.text();

                let episodeNumber = 1;
                
                const oneuploadRegex = /'(https:\/\/oneupload\.to\/[^']+)'/g;
                let episodeMatch;
                let foundEpisodes = false;
                
                while ((episodeMatch = oneuploadRegex.exec(episodesJs)) !== null) {
                    const oneuploadUrl = episodeMatch[1].trim();
                    results.push({
                        href: oneuploadUrl,
                        number: episodeNumber
                    });
                    episodeNumber++;
                    foundEpisodes = true;
                }
                
                if (!foundEpisodes) {
                    episodeNumber = 1;
                    const sendvidRegex = /'(https:\/\/sendvid\.com\/[^']+)'/g;
                    
                    while ((episodeMatch = sendvidRegex.exec(episodesJs)) !== null) {
                        const sendvidUrl = episodeMatch[1].trim();
                        results.push({
                            href: sendvidUrl,
                            number: episodeNumber
                        });
                        episodeNumber++;
                        foundEpisodes = true;
                    }
                }
                
                if (!foundEpisodes) {
                    episodeNumber = 1;
                    const smoothpreRegex = /'(https:\/\/smoothpre\.com\/[^']+)'/gi;
                    
                    while ((episodeMatch = smoothpreRegex.exec(episodesJs)) !== null) {
                        const smoothpreUrl = episodeMatch[1].trim();
                        results.push({
                            href: smoothpreUrl,
                            number: episodeNumber
                        });
                        episodeNumber++;
                        foundEpisodes = true;
                    }
                }
                
                if (!foundEpisodes) {
                    episodeNumber = 1;
                    const mp4Regex = /'([^']+\.mp4[^']*)'/g;
                    
                    while ((episodeMatch = mp4Regex.exec(episodesJs)) !== null) {
                        const mp4Url = episodeMatch[1].trim();
                        results.push({
                            href: mp4Url,
                            number: episodeNumber
                        });
                        episodeNumber++;
                        foundEpisodes = true;
                    }
                }
                
                if (!foundEpisodes && seasonUrl.includes('film')) {
                    episodeNumber = 1;
                    const allVideoRegex = /'(https:\/\/[^']+\.(mp4|mkv|avi|mov|webm)[^']*)'/gi;
                    
                    while ((episodeMatch = allVideoRegex.exec(episodesJs)) !== null) {
                        const videoUrl = episodeMatch[1].trim();
                        results.push({
                            href: videoUrl,
                            number: 1 
                        });
                        foundEpisodes = true;
                        break; 
                    }
                }
            }
        }
        
        return JSON.stringify(results);
    } catch (err) {
        console.error(err);
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        if (/^https?:\/\/smoothpre\.com/i.test(url)) {
            const response = await fetchv2(url);
            const html = await response.text();
            const obfuscatedScript = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
            const unpackedScript = unpack(obfuscatedScript[1]);

            const hls2Match = unpackedScript.match(/"hls2"\s*:\s*"([^"]+)"/);
            const hls2Url = hls2Match ? hls2Match[1] : null;

            return hls2Url;
        } else if (/^https?:\/\/sendvid\.com/i.test(url)) {
            const response = await fetchv2(url);
            const html = await response.text();
            const match = html.match(/var\s+video_source\s*=\s*"([^"]+)"/);
            const videoUrl = match ? match[1] : null;

            return videoUrl;
        } else if (/^https?:\/\/oneupload\.to/i.test(url)) {
            const response = await fetchv2(url);
            const html = await response.text();
            const match = html.match(/sources:\s*\[\{file:"([^"]+)"\}\]/);
            const fileUrl = match ? match[1] : null;

            return fileUrl;
        } else if (/\.mp4$/i.test(url)) {

            return url;
        } else {
            return "https://error.org/";
        }
    } catch (err) {
        return "https://error.org/";
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
