async function searchResults(keyword) {
    const results = [];
    const response = await soraFetch(`https://onepace.net/es/watch`);
    const html = await response.text();

    // First, extract all images in order
    const allImages = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/g)].map(m => m[1])
                      .concat([...html.matchAll(/background-image:\s*url\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
    
    const arcSections = html.split('<h2');
    
    results.push({
        title: "Utilice «todo» o «all» para obtener todo el contenido.",
        href: "",
        image: "https://git.luna-app.eu/ibro/services/raw/branch/main/onepace/onepaceEsInstructions.jpg"
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
            if (block.includes('Subtitulos en español')) {
                type = 'Subtitulos en español';
                if (block.includes('Extended')) {
                    type += ', Extended';
                }
                if (block.includes('Alternate')) {
                    type += ', Alternate';
                }
            } else if (block.includes('Doblaje en español con subtítulos')) {
                type = 'Doblaje en español con subtítulos';
                if (block.includes('Extended')) {
                    type += ', Extended';
                }
                if (block.includes('Alternate')) {
                    type += ', Alternate';
                }
            } else if (block.includes('Doblaje en español')) {
                type = 'Doblaje en español';
                if (block.includes('Extended')) {
                    type += ', Extended';
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
                    keyword.toLowerCase() === 'todo' || 
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
            href: "https://pixeldrain.net/l/XFQuyses",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Romance Dawn",
            href: "https://pixeldrain.net/l/RqyRKE4n",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Romance Dawn",
            href: "https://pixeldrain.net/l/bUmh1bd2",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Romance Dawn",
            href: "https://pixeldrain.net/l/BtYumdMB",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[DUB] [720p] Romance Dawn",
            href: "https://pixeldrain.net/l/sLHabKWQ",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[DUB] [480p] Romance Dawn",
            href: "https://pixeldrain.net/l/TK5j5jAR",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-1-Romance-Dawn-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Ciudad Orange",
            href: "https://pixeldrain.net/l/PRgveMgz",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Ciudad Orange",
            href: "https://pixeldrain.net/l/dxhamPZA",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Ciudad Orange",
            href: "https://pixeldrain.net/l/GUD5avTa",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Ciudad Orange",
            href: "https://pixeldrain.net/l/kRvqMKKB",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[DUB] [720p] Ciudad Orange",
            href: "https://pixeldrain.net/l/FsJqVF5y",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[DUB] [480p] Ciudad Orange",
            href: "https://pixeldrain.net/l/EzZQX8mQ",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-2-Orange-Town-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Villa Syrup",
            href: "https://pixeldrain.net/l/451MYt5v",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Villa Syrup",
            href: "https://pixeldrain.net/l/qXgnj83H",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Villa Syrup",
            href: "https://pixeldrain.net/l/hRm8DGop",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Villa Syrup",
            href: "https://pixeldrain.net/l/2sBkvfXU",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[DUB] [720p] Villa Syrup",
            href: "https://pixeldrain.net/l/5aGbiPev",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[DUB] [480p] Villa Syrup",
            href: "https://pixeldrain.net/l/MahMENCz",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-3-Syrup-Village-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Gaimon",
            href: "https://pixeldrain.net/l/VF7nYmPS",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-4-Gaimon-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Gaimon",
            href: "https://pixeldrain.net/l/xWbEfBvd",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-4-Gaimon-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Gaimon",
            href: "https://pixeldrain.net/l/24Z7j5T5",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-4-Gaimon-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Baratie",
            href: "https://pixeldrain.net/l/EAENQpzv",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Baratie",
            href: "https://pixeldrain.net/l/EyuwRaV2",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Baratie",
            href: "https://pixeldrain.net/l/TM3mohHE",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Baratie",
            href: "https://pixeldrain.net/l/WcxbRUc7",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-5-Baratie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Arlong Park",
            href: "https://pixeldrain.net/l/VJjxKX9K",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Arlong Park",
            href: "https://pixeldrain.net/l/Z9vWXgLV",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Arlong Park",
            href: "https://pixeldrain.net/l/Ss7VVm7j",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Arlong Park Extended",
            href: "https://pixeldrain.net/l/KeGiGTE2",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Arlong Park Extended",
            href: "https://pixeldrain.net/l/9ZG5uZG3",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Arlong Park Extended",
            href: "https://pixeldrain.net/l/aRzxoAp8",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Arlong Park",
            href: "https://pixeldrain.net/l/LsrBD1FD",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[DUB] [720p] Arlong Park",
            href: "https://pixeldrain.net/l/mGtm831W",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[DUB] [480p] Arlong Park",
            href: "https://pixeldrain.net/l/8c3CjPkK",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Arlong Park Extended",
            href: "https://pixeldrain.net/l/8y5JTHCt",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[DUB] [720p] Arlong Park Extended",
            href: "https://pixeldrain.net/l/AWv2D5rG",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[DUB] [480p] Arlong Park Extended",
            href: "https://pixeldrain.net/l/DfJwWunA",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-6-Arlong-Park-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Las aventuras de los Piratas de Buggy",
            href: "https://pixeldrain.net/l/9Ky2rqXW",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-7-The-Adventures-of-Buggys-Crew-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Las aventuras de los Piratas de Buggy",
            href: "https://pixeldrain.net/l/fu8mK9pz",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-7-The-Adventures-of-Buggys-Crew-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Loguetown",
            href: "https://pixeldrain.net/l/U8HzX43L",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-8-Loguetown-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Reverse Mountain",
            href: "https://pixeldrain.net/l/T5uWrig4",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-9-Reverse-Mountain-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Reverse Mountain",
            href: "https://pixeldrain.net/l/rpGLWoDC",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-9-Reverse-Mountain-ALT-2.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Reverse Mountain",
            href: "https://pixeldrain.net/l/SCSn9FRK",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-9-Reverse-Mountain-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [480p] Whisky Peak",
            href: "https://pixeldrain.net/l/MmFeocei",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-10-Whiskey-Peak-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] El diario de la lucha de Koby-Meppo",
            href: "https://pixeldrain.net/l/va3afk9E",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-11-The-Trials-of-Koby-Meppo-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] El diario de la lucha de Koby-Meppo",
            href: "https://pixeldrain.net/l/4piuXiCy",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-11-The-Trials-of-Koby-Meppo-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] El diario de la lucha de Koby-Meppo",
            href: "https://pixeldrain.net/l/hTCquzqA",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-11-The-Trials-of-Koby-Meppo-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Little Garden",
            href: "https://pixeldrain.net/l/Pi31Rch6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });
        
        results.push({
            title: "[SUB] [720p] Little Garden",
            href: "https://pixeldrain.net/l/QZLankV1",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [480p] Little Garden",
            href: "https://pixeldrain.net/l/EDvKHLUP",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Little Garden",
            href: "https://pixeldrain.net/l/ViFsPofx",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });
        
        results.push({
            title: "[DUB] [720p] Little Garden",
            href: "https://pixeldrain.net/l/KhBJghAH",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[DUB] [480p] Little Garden",
            href: "https://pixeldrain.net/l/GSRs1YQx",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-12-Little-Garden-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Isla de Drum",
            href: "https://pixeldrain.net/l/qp9zQdPR",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-13-Drum-Island-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Isla de Drum",
            href: "https://pixeldrain.net/l/aF55MzUg",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-13-Drum-Island-ALT-2.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Isla de Drum",
            href: "https://pixeldrain.net/l/Fr3H7Nxc",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-13-Drum-Island-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Arabasta",
            href: "https://pixeldrain.net/l/TBfyMTwy",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-14-Alabasta-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Arabasta",
            href: "https://pixeldrain.net/l/sMx5HsC8",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-14-Alabasta-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Arabasta",
            href: "https://pixeldrain.net/l/wDvXNLxR",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-14-Alabasta-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Jaya",
            href: "https://pixeldrain.net/l/6jcvAu9X",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-15-Jaya-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [720p] Jaya",
            href: "https://pixeldrain.net/l/MifrPdu1",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-15-Jaya-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Skypiea",
            href: "https://pixeldrain.net/l/b6m2XVBd",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Skypiea",
            href: "https://pixeldrain.net/l/T7oFy8gM",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Skypiea",
            href: "https://pixeldrain.net/l/MpURum7i",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Skypiea Alternate (G-8)",
            href: "https://pixeldrain.net/l/uFaeSu3C",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Skypiea Alternate (G-8)",
            href: "https://pixeldrain.net/l/137wGxBk",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Skypiea Alternate (G-8)",
            href: "https://pixeldrain.net/l/j2Kj1CKG",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-16-Skypiea-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Long Ring Long Land",
            href: "https://pixeldrain.net/l/Q5R3Z44u",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-17-Long-Ring-Long-Land-ALT-2.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Water Seven",
            href: "https://pixeldrain.net/l/LQVN7c2N",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-18-Water-Seven-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Water Seven",
            href: "https://pixeldrain.net/l/9GdRn7De",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-18-Water-Seven-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Enies Lobby",
            href: "https://pixeldrain.net/l/a7WJPWR8",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-19-Enies-Lobby-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Enies Lobby",
            href: "https://pixeldrain.net/l/mRywLHQr",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-19-Enies-Lobby-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Post-Enies Lobby",
            href: "https://pixeldrain.net/l/yynRPbkt",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-20-Post-Enies-Lobby-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Thriller Bark",
            href: "https://pixeldrain.net/l/16gHoWqc",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-21-Thriller-Bark-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Archipiélago Sabaody",
            href: "https://pixeldrain.net/l/AHejg5kA",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-22-Sabaody-Archipelago-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Amazon Lily",
            href: "https://pixeldrain.net/l/i3b8qdb5",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-23-Amazon-Lily-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Impel Down",
            href: "https://pixeldrain.net/l/hxnfZsPw",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-24-Impel-Down-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Si fueras a salir de viaje... Las aventuras de los Sombrero de Paja",
            href: "https://pixeldrain.net/l/jbG5Xjek",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Si fueras a salir de viaje... Las aventuras de los Sombrero de Paja",
            href: "https://pixeldrain.net/l/Vm4ZALqo",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Si fueras a salir de viaje... Las aventuras de los Sombrero de Paja",
            href: "https://pixeldrain.net/l/s6Kg45rM",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[DUB] [1080p] Si fueras a salir de viaje... Las aventuras de los Sombrero de Paja",
            href: "https://pixeldrain.net/l/CfFX2D3P",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[DUB] [720p] Si fueras a salir de viaje... Las aventuras de los Sombrero de Paja",
            href: "https://pixeldrain.net/l/rg1fW7cT",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[DUB] [480p] Si fueras a salir de viaje... Las aventuras de los Sombrero de Paja",
            href: "https://pixeldrain.net/l/EBfZaffN",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-25-If-You-Could-Go-Anywhere.-The-Adventures-of-the-Straw-Hats-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Marineford",
            href: "https://pixeldrain.net/l/jNXrBerQ",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-26-Marineford-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] 3D2Y",
            href: "https://pixeldrain.net/l/VVqHE6aG",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-27-Post-War-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] 3D2Y",
            href: "https://pixeldrain.net/l/yHhL89hk",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-27-Post-War-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Regreso a Sabaody",
            href: "https://pixeldrain.net/l/3NwZvwJ5",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-28-Return-to-Sabaody-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Regreso a Sabaody",
            href: "https://pixeldrain.net/l/uXjV6Pp6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-28-Return-to-Sabaody-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Isla Gyojin",
            href: "https://pixeldrain.net/l/TjsB32wU",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-29-Fishman-Island-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Punk Hazard",
            href: "https://pixeldrain.net/l/LunJMVNy",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-30-Punk-Hazard-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Dressrosa",
            href: "https://pixeldrain.net/l/CZo48kqJ",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-31-Dressrosa-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Zou",
            href: "https://pixeldrain.net/l/Us9cGESX",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-32-Zou-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Whole Cake",
            href: "https://pixeldrain.net/l/f5Nwx9WC",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-33-Whole-Cake-Island-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Levely",
            href: "https://pixeldrain.net/l/qyupHs6T",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-34-Reverie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] Levely",
            href: "https://pixeldrain.net/l/oLLoqQH6",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-34-Reverie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] Levely",
            href: "https://pixeldrain.net/l/JoHkvDde",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-34-Reverie-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] País de Wa",
            href: "https://pixeldrain.net/l/1EvFEuj9",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] País de Wa",
            href: "https://pixeldrain.net/l/tnZteFfr",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] País de Wa",
            href: "https://pixeldrain.net/l/umLGLmSf",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] País de Wa Extended",
            href: "https://pixeldrain.net/l/xuatxF1w",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [720p] País de Wa Extended",
            href: "https://pixeldrain.net/l/WeFTe5ne",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [480p] País de Wa Extended",
            href: "https://pixeldrain.net/l/qBcaQEM3",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-35-Wano-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Onigashima y Egghead",
            href: "https://pixeldrain.net/l/xfatHReF",
            image: "https://onepace.co/wp-content/uploads/2025/09/Season-36-Egghead-ALT.jpg"
        });

        results.push({
            title: "[SUB] [1080p] Warship Island 01 (April Fools 2025)",
            href: "https://pixeldrain.net/l/VxX3mces",
            image: ""
        });

        results.push({
            title: "[SUB] [1080p] Warship Island 01 (April Fools 2025)",
            href: "https://pixeldrain.net/l/uALoUKpB",
            image: ""
        });

        results.push({
            title: "[SUB] [1080p] Warship Island 01 (April Fools 2025)",
            href: "https://pixeldrain.net/l/2BiC7CVh",
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
