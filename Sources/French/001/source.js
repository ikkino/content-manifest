async function searchResults(keyword) {
    const results = [];
    const response = await soraFetch(`https://onepace.net/fr/watch`);
    const html = await response.text();

    // First, extract all images in order
    const allImages = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/g)].map(m => m[1])
                      .concat([...html.matchAll(/background-image:\s*url\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
    
    const arcSections = html.split('<h2');
    
    results.push({
        title: "Utilisez «tout» ou «all» pour obtenir tout le contenu.",
        href: "",
        image: "https://git.luna-app.eu/ibro/services/raw/branch/main/onepace/onepaceFrInstructions.jpg"
    });

    // Process each arc section starting from index 1 (skip the first split result)
    for (let i = 1; i < arcSections.length; i++) {
        const currentSection = arcSections[i];
        
        // Extract title from current section
        const titleMatch = currentSection.match(/>([^<]+)<\/a>/);
        if (!titleMatch) continue;
        let arcTitle = titleMatch[1].trim()
            .replace(/&#x27;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"');
        
        // Get image for this arc - shifted by 1 to align correctly
        let arcImage = '';
        if (allImages[i]) {  // Using i instead of i-1 to shift image index forward
            arcImage = allImages[i].replace(/&amp;/g, '&');
            if (arcImage.startsWith('/_next')) {
                arcImage = 'https://onepace.net' + arcImage;
            }
        }
        
        // For the last arc, use the last image from the array
        if (i === arcSections.length - 1 && allImages[0]) {
            arcImage = allImages[0].replace(/&amp;/g, '&');
            if (arcImage.startsWith('/_next')) {
                arcImage = 'https://onepace.net' + arcImage;
            }
        }

        const episodeBlocks = currentSection.split('<span class="flex-1">');
        for (let j = 1; j < episodeBlocks.length; j++) {
            const block = episodeBlocks[j];
            
            let type = '';
            if (block.includes('Sous-titres Français')) {
                type = 'Sous-titres Français';
                if (block.includes('Version Longue')) {
                    type += ', Version Longue';
                }
                if (block.includes('Alternate')) {
                    type += ', Alternate';
                }
            } else if (block.includes('Doublage français avec sous-titres codés')) {
                type = 'Doublage français avec sous-titres codés';
                if (block.includes('Version Longue')) {
                    type += ', Version Longue';
                }
                if (block.includes('Alternate')) {
                    type += ', Alternate';
                }
            } else if (block.includes('Doublage français')) {
                type = 'Doublage français';
                if (block.includes('Version Longue')) {
                    type += ', Version Longue';
                }
                if (block.includes('Alternate')) {
                    type += ', Alternate';
                }
            } else {
                continue;
            }

            // Get quality-specific links
            let qualityLinks = new Map();
            const qualityMatches = [...block.matchAll(/>\s*(480p|720p|1080p)\s*</g)];
            const linkMatches = [...block.matchAll(/href="(https:\/\/pixeldrain\.net\/l\/[^"]+)"/g)];
            
            // Match links with qualities in order
            if (qualityMatches.length > 0 && linkMatches.length > 0) {
                // Make sure we have at most one link per quality
                const uniqueQualities = [...new Set(qualityMatches.map(m => m[1]))];
                uniqueQualities.forEach((quality, index) => {
                    if (index < linkMatches.length) {
                        qualityLinks.set(quality, linkMatches[index][1]);
                    }
                });
            }
            
            // Add entries for all found qualities
            for (const [quality, href] of qualityLinks) {
                const title = `${arcTitle}, ${type}, ${quality.trim()}`;
                if (!keyword || title.toLowerCase().includes(keyword.toLowerCase()) || 
                    keyword.toLowerCase() === 'all' ||
                    keyword.toLowerCase() === 'tout' || 
                    keyword.toLowerCase() === 'everything') {
                    results.push({
                        title: title,
                        href: href,
                        image: arcImage
                    });
                }
            }
        }
    }

    if (results.length === 1) {
        results.push({
            title: "[SUB] [1080p] Romance Dawn",
            href: "https://pixeldrain.net/l/H6S4Wx4X",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Romance Dawn",
            href: "https://pixeldrain.net/l/pKYpST8P",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Romance Dawn",
            href: "https://pixeldrain.net/l/vNW7Hdif",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Village d'Orange",
            href: "https://pixeldrain.net/l/JRjMsPuh",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Village d'Orange",
            href: "https://pixeldrain.net/l/1m5LycDa",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Village d'Orange",
            href: "https://pixeldrain.net/l/XWihsa8r",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Village de Sirop",
            href: "https://pixeldrain.net/l/XaYFFs72",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Village de Sirop",
            href: "https://pixeldrain.net/l/jp3Vpn9T",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Village de Sirop",
            href: "https://pixeldrain.net/l/AaZnjef6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Gaimon",
            href: "https://pixeldrain.net/l/mqJFuoGM",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-4-Gaimon-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Gaimon",
            href: "https://pixeldrain.net/l/aPG6xT2N",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-4-Gaimon-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Gaimon",
            href: "https://pixeldrain.net/l/ba5rkjAt",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-4-Gaimon-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Baratie",
            href: "https://pixeldrain.net/l/iNhmF7P6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Baratie",
            href: "https://pixeldrain.net/l/3JfKX4jV",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Baratie",
            href: "https://pixeldrain.net/l/9mkfjsrR",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Arlong Park",
            href: "https://pixeldrain.net/l/YWzpJCC3",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Arlong Park",
            href: "https://pixeldrain.net/l/9Z8qf7ao",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Arlong Park",
            href: "https://pixeldrain.net/l/A3Uo7KkZ",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Arlong Park Version Longue",
            href: "https://pixeldrain.net/l/V3FfsFAN",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Arlong Park Version Longue",
            href: "https://pixeldrain.net/l/GF9ALC6n",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Arlong Park Version Longue",
            href: "https://pixeldrain.net/l/v9rQam7F",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Les Aventures de la Bande à Baggy",
            href: "https://pixeldrain.net/l/L9kv6MqM",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-7-The-Adventures-of-Buggys-Crew-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Loguetown",
            href: "https://pixeldrain.net/l/opNXdLKd",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-8-Loguetown-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Reverse Mountain",
            href: "https://pixeldrain.net/l/URt26Et1",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-9-Reverse-Mountain-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [480p] Whisky Peak",
            href: "https://pixeldrain.net/l/HDNpbaNF",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-10-Whiskey-Peak-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Le Combat Quotidien de Kobby et Hermep",
            href: "https://pixeldrain.net/l/4uHb89DB",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-11-The-Trials-of-Koby-Meppo-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Little Garden",
            href: "https://pixeldrain.net/l/g6qoDNuT",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Little Garden",
            href: "https://pixeldrain.net/l/djeN6hsh",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [480p] Little Garden",
            href: "https://pixeldrain.net/l/cUgBgf7N",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Île de Drum",
            href: "https://pixeldrain.net/l/Ufj3Pygx",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-13-Drum-Island-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Alabasta",
            href: "https://pixeldrain.net/l/w7FvfvKH",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-14-Alabasta-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Alabasta",
            href: "https://pixeldrain.net/l/CZqB17az",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-14-Alabasta-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Alabasta",
            href: "https://pixeldrain.net/l/8G57d4Jv",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-14-Alabasta-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Jaya",
            href: "https://pixeldrain.net/l/9atQ8mfC",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-15-Jaya-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Skypiea",
            href: "https://pixeldrain.net/l/3PcGBkaM",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Skypiea",
            href: "https://pixeldrain.net/l/obEqXTav",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Skypiea",
            href: "https://pixeldrain.net/l/6WfTy83i",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Skypiea Alternate (G-8)",
            href: "https://pixeldrain.net/l/p2sD43SS",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Skypiea Alternate (G-8)",
            href: "https://pixeldrain.net/l/eYXhAeq6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Skypiea Alternate (G-8)",
            href: "https://pixeldrain.net/l/uiYWx8Tq",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Water Seven",
            href: "https://pixeldrain.net/l/3N7mb2ty",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-18-Water-Seven-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Enies Lobby",
            href: "https://pixeldrain.net/l/RFpMDGTk",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-19-Enies-Lobby-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Amazon Lily",
            href: "https://pixeldrain.net/l/VPXkPbXz",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-23-Amazon-Lily-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Si tu pouvais voyager... Des Nouvelles de l'Équipage",
            href: "https://pixeldrain.net/l/3bZFXVkX",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Si tu pouvais voyager... Des Nouvelles de l'Équipage",
            href: "https://pixeldrain.net/l/1qjraYcj",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Marineford",
            href: "https://pixeldrain.net/l/WXkKtKis",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-26-Marineford-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Post-Guerre",
            href: "https://pixeldrain.net/l/95kTXhT5",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-27-Post-War-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Retour à Sabaody",
            href: "https://pixeldrain.net/l/Jrm3Ma6M",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-28-Return-to-Sabaody-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Zo",
            href: "https://pixeldrain.net/l/yXLVcDgo",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-32-Zou-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Whole Cake Island",
            href: "https://pixeldrain.net/l/tqDyHLp3",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-33-Whole-Cake-Island-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Rêverie",
            href: "https://pixeldrain.net/l/GeGmz1B7",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-34-Reverie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Rêverie",
            href: "https://pixeldrain.net/l/UBqh7edW",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-34-Reverie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Rêverie",
            href: "https://pixeldrain.net/l/9EqGMxgL",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-34-Reverie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Wano",
            href: "https://pixeldrain.net/l/n83vuQRD",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Wano",
            href: "https://pixeldrain.net/l/EPGxaMq6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Wano",
            href: "https://pixeldrain.net/l/oDFoHdF5",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Wano Version Longue",
            href: "https://pixeldrain.net/l/cfjuMYwm",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Wano Version Longue",
            href: "https://pixeldrain.net/l/7Q9f4HQh",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Wano Version Longue",
            href: "https://pixeldrain.net/l/bG2GAZLT",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Egghead",
            href: "https://pixeldrain.net/l/8S1fWWqD",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Egghead",
            href: "https://pixeldrain.net/l/uf2SwitW",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Egghead",
            href: "https://pixeldrain.net/l/nzJdayDq",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Egghead Version Longue",
            href: "https://pixeldrain.net/l/4fap9Z1s",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Egghead Version Longue",
            href: "https://pixeldrain.net/l/p1nucKM7",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Egghead Version Longue",
            href: "https://pixeldrain.net/l/DGn1XMyq",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] One Piece Fan Letter",
            href: "https://pixeldrain.net/l/9JNNTHhg",
            image: ""
        });

        results.push({
            title: "[SUB] [720p] One Piece Fan Letter",
            href: "https://pixeldrain.net/l/muoYLttM",
            image: ""
        });

        results.push({
            title: "[SUB] [480p] One Piece Fan Letter",
            href: "https://pixeldrain.net/l/CEZbhGgN",
            image: ""
        });
    }
    
    console.log(`Results: ${JSON.stringify(results)}`);
    return JSON.stringify(results);
}

async function extractDetails(url) {
    const match = url.match(/https:\/\/pixeldrain\.net\/l\/([^\/]+)/);
    if (!match) throw new Error("Invalid URL format");
            
    const arcId = match[1];

    const response = await soraFetch(`https://pixeldrain.net/api/list/${arcId}`);
    const data = await response.json();    

    const transformedResults = [{
        description: `Title: ${data.title}\nFile Count: ${data.file_count}`,
        aliases: `Title: ${data.title}\nFile Count: ${data.file_count}`,
        airdate: ''
    }];

    console.log(`Details: ${JSON.stringify(transformedResults)}`);
    return JSON.stringify(transformedResults);
}

async function extractEpisodes(url) {
    const match = url.match(/https:\/\/pixeldrain\.net\/l\/([^\/]+)/);
    if (!match) throw new Error("Invalid URL format");
            
    const arcId = match[1];

    const response = await soraFetch(`https://pixeldrain.net/api/list/${arcId}`);
    const data = await response.json();

    const transformedResults = data.files.map((result, index) => {
        return {
            href: `${result.id}`,
            number: index + 1,
        };
    });

    console.log(`Episodes: ${JSON.stringify(transformedResults)}`);
    return JSON.stringify(transformedResults);
}

// searchResults("all");
// extractDetails("https://pixeldrain.net/l/sT25hhHR");
// extractEpisodes("https://pixeldrain.net/l/sT25hhHR");

async function extractStreamUrl(url) {
    return `https://pixeldrain.net/api/file/${url}?download`;
}

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
