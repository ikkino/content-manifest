// ==========================================
// ⚙️ MODULE SORA — VOIRANIME (Tracker Pro + Filemoon + Logs Console)
// ==========================================

const BASE_URL = "https://voir-anime.to";

// ==========================================
// 🗄️ TRACKER SUPABASE (Base de données)
// ==========================================
const SUPABASE_URL = "https://qyeisgowjisqbatrmqta.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_F68CBjFVPh71U0SdD9BQJg_UJgL9-Fj";

async function sendSupabaseLog(moduleName, actionType, dataPayload) {
    try {
        const payload = {
            module: moduleName,
            action: actionType,
            data: dataPayload
        };

        const headers = { 
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "return=minimal" 
        };
        
        if (typeof fetchv2 !== 'undefined') {
            await fetchv2(`${SUPABASE_URL}/rest/v1/app_logs`, headers, "POST", JSON.stringify(payload));
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/app_logs`, { method: "POST", headers: headers, body: JSON.stringify(payload) });
        }
    } catch (e) { 
        console.log(`[Tracker] 🚨 Erreur d'envoi vers Supabase : ${e.message}`); 
    }
}

// ==========================================
// ⚙️ LOGIQUE DU MODULE VOIRANIME
// ==========================================

// --- 1. RECHERCHE ---
async function searchResults(keyword) {
    console.log(`[Recherche] 🔍 Recherche classique pour : "${keyword}"`);
    try {
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(keyword)}&post_type=wp-manga`;
        console.log(`[Recherche] 🔗 URL appelée : ${searchUrl}`);

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://voir-anime.to"
        };

        const response = await soraFetch(searchUrl, { headers });
        const html = await response.text();

        if (html.includes("Just a moment...") || html.includes("Cloudflare") || html.includes("DDoS")) {
            console.log(`[Recherche] ⛔ AÏE ! L'application est bloquée par Cloudflare.`);
            sendSupabaseLog("VoirAnime", "BLOCKED", { keyword: keyword, reason: "Cloudflare" });
            return JSON.stringify([]);
        }

        const results = [];
        const blocks = html.split(/c-tabs-item__content|page-item-detail|class=["']c-image["']/i);

        for (let i = 1; i < blocks.length; i++) {
            let block = blocks[i];
            
            let hrefMatch = block.match(/href=["']([^"']+)["']/i);
            let titleMatch = block.match(/title=["']([^"']+)["']/i) || block.match(/alt=["']([^"']+)["']/i);
            let imgMatch = block.match(/data-src=["']([^"']+)["']/i) || block.match(/src=["']([^"']+)["']/i);
            let yearMatch = block.match(/release-year[^>]*>\s*<a[^>]*>(\d{4})<\/a>/i);

            if (hrefMatch && titleMatch) {
                let href = hrefMatch[1];
                let title = titleMatch[1];
                
                if (href.includes('.css') || href.includes('.js') || href.includes('wp-') || title.includes('RSD') || !href.includes(BASE_URL)) {
                    continue;
                }

                title = title.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&#8211;/g, "-").trim();
                let rawImage = imgMatch ? imgMatch[1] : "";
                if (rawImage.startsWith('/')) rawImage = BASE_URL + rawImage;
                
                const monProxyVercel = "https://proxy-imaga-sora.kurzmathis4.workers.dev/?url=";
                let image = rawImage ? `${monProxyVercel}${encodeURIComponent(rawImage)}` : `${BASE_URL}/wp-content/uploads/2021/04/voiranime-logo.png`;

                let year = yearMatch ? yearMatch[1] : null;

                if (!results.find(r => r.href === href)) {
                    let item = { title: title, image: image, href: href };
                    if (year) item.year = year; 
                    results.push(item);
                }
            }
        }
        
        console.log(`[Recherche] ✅ ${results.length} animes trouvés.`);
        sendSupabaseLog("VoirAnime", "SEARCH", { 
            keyword: keyword, 
            results_count: results.length,
            top_results: results.slice(0, 3).map(r => r.title)
        });

        return JSON.stringify(results);

    } catch (e) { 
        console.error(`[Recherche] 🚨 Erreur :`, e);
        sendSupabaseLog("VoirAnime", "ERROR", { keyword: keyword, error_message: String(e) });
        return JSON.stringify([]); 
    }
}

// --- 2. DÉTAILS ---
async function extractDetails(url) {
    console.log(`[Détails] 📖 Analyse de : ${url}`);
    sendSupabaseLog("VoirAnime", "DETAILS", { anime_url: url });

    try {
        const response = await soraFetch(url);
        const html = await response.text();

        let description = "Pas de description disponible.";
        const descMatch = html.match(/<div class=["']summary__content[^>]*>([\s\S]*?)<\/div>/i) || html.match(/<div class=["']description-summary[^>]*>([\s\S]*?)<\/div>/i);

        if (descMatch && descMatch[1]) {
            description = descMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&#8217;/g, "'").replace(/&#8230;/g, "...").replace(/&quot;/g, '"').replace(/&#8220;?/g, '"').replace(/&#8221;?/g, '"').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').trim();
        }

        let airdate = "N/A";
        const fullDateMatch = html.match(/(?:Start\s*date|End\s*date|Année\s*de\s*sortie|Année|Release|Sortie|Year)[^<]*<\/h5>[\s\S]{1,150}?<div[^>]*class=["'][^"']*summary-content[^"']*["'][^>]*>\s*([^<]+?)\s*<\/div>/i);
        
        if (fullDateMatch && fullDateMatch[1]) { airdate = fullDateMatch[1].trim(); } 
        else {
            const yearFallback = html.match(/(?:Start\s*date|End\s*date|Année\s*de\s*sortie|Année|Release|Sortie|Year)[\s\S]{1,150}?\b(19\d{2}|20\d{2})\b/i);
            if (yearFallback && yearFallback[1]) { airdate = yearFallback[1]; } 
            else {
                const altMatch = html.match(/href=["'][^"']*(?:anime-release|release|year|\/annee\/)[^"']*["'][^>]*>\s*(19\d{2}|20\d{2})\s*<\/a>/i);
                if (altMatch && altMatch[1]) { airdate = altMatch[1]; }
            }
        }

        console.log(`[Détails] ✅ Description et année (${airdate}) récupérées.`);
        return JSON.stringify([{ description, aliases: "Voiranime", airdate }]);
    } catch (e) { 
        console.error(`[Détails] 🚨 Erreur :`, e);
        return JSON.stringify([{ description: "Erreur de chargement", aliases: "Voiranime", airdate: "N/A" }]); 
    }
}

// --- 3. ÉPISODES ---
async function extractEpisodes(url) {
    console.log(`[Episodes] 📂 Recherche des épisodes pour : ${url}`);
    try {
        const response = await soraFetch(url);
        let html = await response.text();
        let results = [];
        
        const epRegex = /<li class=["'][^"']*wp-manga-chapter[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = epRegex.exec(html)) !== null) {
            let epHref = match[1];
            let epTitle = match[2].replace(/<[^>]+>/g, '').trim();
            let numMatch = epTitle.match(/(?:Épisode|Episode|Ep|OAV)\s*(\d+)/i) || epHref.match(/-(\d+)(?:-vostfr|-vf)?\/?$/i);
            let epNumber = numMatch ? parseInt(numMatch[1]) : (results.length + 1);

            results.push({ href: epHref, title: epTitle, number: epNumber });
        }

        results.sort((a, b) => a.number - b.number);
        console.log(`[Episodes] ✅ ${results.length} épisodes trouvés.`);
        return JSON.stringify(results);
    } catch (e) { 
        console.error(`[Episodes] 🚨 Erreur :`, e);
        return JSON.stringify([]); 
    }
}

// --- 4. LECTEUR (Tracker Ultra Détaillé avec Console.log & Filemoon) ---
async function extractStreamUrl(url) {
    let extractionLogs = [];
    
    // Fonction Helper pour écrire en même temps dans la console et dans Supabase
    function logDebug(msg) {
        console.log(`[Extrait Vidéo] ${msg}`);
        extractionLogs.push(msg);
    }

    logDebug(`🎬 --- NOUVELLE EXTRACTION ---`);
    logDebug(`🌐 URL Cible : ${url}`);
    let startTime = Date.now();

    try {
        logDebug(`📡 Requête HTTP pour récupérer le code source de la page...`);
        const response = await soraFetch(url);
        const html = await response.text();
        logDebug(`✅ Code source récupéré (${html.length} octets).`);
        
        let streams = [];
        let embedUrls = [];
        let failedLinks = [];

        // 1️⃣ Recherche des iframes directes
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        let match;
        while ((match = iframeRegex.exec(html)) !== null) {
            let iframeUrl = match[1];
            if (iframeUrl.startsWith('//')) iframeUrl = "https:" + iframeUrl;
            if (iframeUrl.startsWith('http') && !embedUrls.includes(iframeUrl)) embedUrls.push(iframeUrl);
        }
        logDebug(`🔍 Iframes directes trouvées : ${embedUrls.length}`);
        if(embedUrls.length > 0) logDebug(`↳ Liens : ${embedUrls.join(', ')}`);

        // 2️⃣ Recherche des redirections (data-redirect)
        const redirectRegex = /data-redirect=["']([^"']+\?host=[^"']+)["']/gi;
        let pagesToFetch = [];
        
        while ((match = redirectRegex.exec(html)) !== null) {
            let redirectUrl = match[1].replace(/&amp;/g, '&');
            if (redirectUrl.startsWith('/')) redirectUrl = BASE_URL + redirectUrl;
            if (!pagesToFetch.includes(redirectUrl)) pagesToFetch.push(redirectUrl);
        }
        logDebug(`🔄 Liens 'data-redirect' trouvés : ${pagesToFetch.length}`);

        if (pagesToFetch.length > 0) {
            logDebug(`⏳ Résolution des liens redirect...`);
            const pagesHtml = await Promise.all(
                pagesToFetch.map(async p => {
                    try {
                        let res = await soraFetch(p, { headers: { "Referer": url } });
                        return await res.text();
                    } catch (e) {
                        logDebug(`❌ Échec de résolution du redirect: ${p} - Erreur: ${e.message}`);
                        return "";
                    }
                })
            );

            for (let i = 0; i < pagesHtml.length; i++) {
                const pageSource = pagesHtml[i];
                const frameMatch = pageSource.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                if (frameMatch) {
                    let frameUrl = frameMatch[1];
                    if (frameUrl.startsWith('//')) frameUrl = "https:" + frameUrl;
                    if (frameUrl.startsWith('http') && !embedUrls.includes(frameUrl)) {
                        embedUrls.push(frameUrl);
                        logDebug(`✅ Nouvelle Iframe trouvée via redirect : ${frameUrl}`);
                    }
                }
            }
        }

        if (embedUrls.length === 0) {
            failedLinks.push({ server_name: "Extracteur Global", url: "Aucun lecteur détecté sur la page" });
            logDebug(`🛑 CRITIQUE : Aucun lecteur (iframe) n'a pu être extrait. Fin de l'extraction.`);
        }

        // --- TRAITEMENT DES LECTEURS ---
        for (let embedUrl of embedUrls) {
            let urlLower = embedUrl.toLowerCase();
            logDebug(`⚙️ Analyse du lecteur : ${embedUrl}`);

            // --- MOTEUR FILEMOON / FILELIONS ---
            if (urlLower.includes("filemoon") || urlLower.includes("filelions") || urlLower.includes("alions") || urlLower.includes("weneverbeenfree")) {
                logDebug(`[MOTEUR] Sélection de Filemoon/Filelions`);
                try {
                    logDebug(`[Filemoon] Exécution de filemoonExtractor...`);
                    // 🌟 CORRECTION 1 : On passe l'URL parent (voir-anime.to/...) à l'extracteur
                    let fmResult = await filemoonExtractor(embedUrl, url, logDebug);
                    
                    if (fmResult && fmResult.url) {
                        let qLabel = fmResult.quality ? ` [${fmResult.quality}]` : "";
                        const typeStr = fmResult.url.includes(".m3u8") ? "HLS" : "MP4";
                        streams.push({ title: `Filemoon${qLabel} (${typeStr})`, streamUrl: fmResult.url, headers: { "Referer": embedUrl } });
                        logDebug(`[Filemoon] 🟢 SUCCÈS ! Flux final trouvé : ${fmResult.url}`);
                    } else if (typeof fmResult === 'string') {
                        const typeStr = fmResult.includes(".m3u8") ? "HLS" : "MP4";
                        streams.push({ title: `Filemoon (${typeStr})`, streamUrl: fmResult, headers: { "Referer": embedUrl } });
                        logDebug(`[Filemoon] 🟢 SUCCÈS ! Flux final trouvé : ${fmResult}`);
                    } else {
                        failedLinks.push({ server_name: "Filemoon (Lien Introuvable)", url: embedUrl });
                        logDebug(`[Filemoon] ❌ Aucun flux final généré.`);
                    }
                } catch (e) {
                    failedLinks.push({ server_name: "Filemoon (Crash)", url: embedUrl, error: e.message });
                    logDebug(`[Filemoon] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR VOE ---
            else if (urlLower.includes("voe.sx") || urlLower.includes("voe.network") || urlLower.includes("voe") || urlLower.includes("lancewhosedifficult")) {
                logDebug(`[MOTEUR] Sélection de VOE`);
                try {
                    let voeRes = await soraFetch(embedUrl, { headers: { "Referer": BASE_URL } });
                    if (voeRes) {
                        let voeHtml = await voeRes.text();
                        const redirectMatch = voeHtml.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
                        if (redirectMatch && redirectMatch[1]) {
                            logDebug(`[VOE] Redirection domain-hopping détectée : ${redirectMatch[1]}`);
                            voeRes = await soraFetch(redirectMatch[1], { headers: { "Referer": BASE_URL } });
                            voeHtml = await voeRes.text();
                        }
                        
                        logDebug(`[VOE] Tentative de décodage JSON...`);
                        const streamUrl = voeExtractor(voeHtml);
                        if (streamUrl) {
                            const typeStr = streamUrl.includes(".m3u8") ? "HLS" : "MP4";
                            streams.push({ title: `VOE (${typeStr})`, streamUrl: streamUrl, headers: { "Referer": embedUrl } });
                            logDebug(`[VOE] 🟢 SUCCÈS ! Flux final trouvé : ${streamUrl}`);
                        } else {
                            failedLinks.push({ server_name: "VOE (Décodage Échoué)", url: embedUrl });
                            logDebug(`[VOE] ❌ Échec du déchiffrement du script JSON.`);
                        }
                    } else {
                        failedLinks.push({ server_name: "VOE (Page inaccessible)", url: embedUrl });
                        logDebug(`[VOE] ❌ Page hors-ligne ou inaccessible.`);
                    }
                } catch(e) { 
                    failedLinks.push({ server_name: "VOE (Crash)", url: embedUrl, error: e.message }); 
                    logDebug(`[VOE] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR STREAMTAPE ---
            else if (urlLower.includes("streamtape.com") || urlLower.includes("streamta.pe")) {
                logDebug(`[MOTEUR] Sélection de Streamtape`);
                try {
                    const stRes = await soraFetch(embedUrl);
                    const stHtml = await stRes.text();
                    
                    logDebug(`[Streamtape] Recherche du robotlink...`);
                    
                    let directUrl = null;
                    
                    // 🌟 L'ULTIME MÉTHODE : Streamtape met un FAUX lien dans la balise HTML pour piéger les bots (Erreur 500).
                    // Le VRAI lien est calculé en Javascript juste en dessous. On va exécuter ce calcul !
                    const robotLineMatch = stHtml.match(/document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*([^;]+)/i);

                    if (robotLineMatch) {
                        let expression = robotLineMatch[1].trim();
                        
                        try {
                            // On évalue dynamiquement le calcul Javascript de Streamtape (ex: "lien" + ("lettres").substring(2))
                            let tokenStr = new Function("return " + expression)();
                            
                            directUrl = tokenStr.startsWith('http') ? tokenStr : (tokenStr.startsWith('//') ? 'https:' + tokenStr : 'https://streamtape.com' + tokenStr);
                            logDebug(`[Streamtape] Lien calculé avec succès en contournant le piège HTML.`);
                        } catch(err) {
                            logDebug(`[Streamtape] ⚠️ Erreur d'évaluation JS : ${err.message}`);
                        }
                    }

                    if (directUrl) {
                        if (!directUrl.includes("&stream=1")) directUrl += "&stream=1";
                        
                        logDebug(`[Streamtape] Lien intermédiaire reconstruit : ${directUrl}`);
                        logDebug(`[Streamtape] 🔄 Suivi de la redirection (Location) vers le fichier MP4...`);

                        // 🌟 2. On fait un "HEAD" pour suivre le statut 302 et capturer le lien final tapecontent
                        try {
                            const redirectReq = await soraFetch(directUrl, {
                                headers: { "Referer": embedUrl, "User-Agent": "Mozilla/5.0" },
                                method: "HEAD"
                            });
                            
                            if (redirectReq && redirectReq.url && redirectReq.url !== directUrl) {
                                directUrl = redirectReq.url;
                                logDebug(`[Streamtape] 🟢 SUCCÈS ! Lien MP4 direct obtenu : ${directUrl.substring(0, 40)}...`);
                            } else {
                                logDebug(`[Streamtape] ⚠️ Redirection non suivie, utilisation du lien intermédiaire.`);
                            }
                        } catch(e) {
                            logDebug(`[Streamtape] ⚠️ Erreur lors du suivi de la redirection, on garde le lien intermédiaire.`);
                        }

                        const typeStr = directUrl.includes(".m3u8") ? "HLS" : "MP4";
                        streams.push({ 
                            title: `Streamtape (${typeStr})`, 
                            streamUrl: directUrl, 
                            headers: { "Referer": "https://streamtape.com/", "User-Agent": "Mozilla/5.0" } 
                        });
                    } else {
                        failedLinks.push({ server_name: "Streamtape (Robotlink Introuvable)", url: embedUrl });
                        logDebug(`[Streamtape] ❌ Script robotlink introuvable (Anti-bot modifié).`);
                    }
                } catch (e) { 
                    failedLinks.push({ server_name: "Streamtape (Crash)", url: embedUrl, error: e.message });
                    logDebug(`[Streamtape] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR VIDMOLY ---
            else if (urlLower.includes("vidmoly")) {
                logDebug(`[MOTEUR] Sélection de Vidmoly`);
                try {
                    const vidRes = await soraFetch(embedUrl, { headers: { "Referer": BASE_URL } });
                    const vidHtml = await vidRes.text();
                    const fileMatch = vidHtml.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
                    
                    if (fileMatch) {
                        const typeStr = fileMatch[1].includes(".m3u8") ? "HLS" : "MP4";
                        streams.push({ 
                            title: `Vidmoly (${typeStr})`, 
                            streamUrl: fileMatch[1], 
                            headers: { "Referer": "https://vidmoly.to/", "Origin": "https://vidmoly.to" } 
                        });
                        logDebug(`[Vidmoly] 🟢 SUCCÈS ! Flux final trouvé : ${fileMatch[1]}`);
                    } else {
                        failedLinks.push({ server_name: "Vidmoly (Lien Introuvable)", url: embedUrl });
                        logDebug(`[Vidmoly] ❌ Aucun lien M3U8/MP4 détecté.`);
                    }
                } catch (e) {
                    failedLinks.push({ server_name: "Vidmoly (Crash)", url: embedUrl, error: e.message });
                    logDebug(`[Vidmoly] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR F16PX / STREAMHIDE ---
            else if (urlLower.includes("streamhide") || urlLower.includes("vidhide") || urlLower.includes("luluvdo")) {
                logDebug(`[MOTEUR] Sélection de Streamhide / F16px`);
                try {
                    const req = await soraFetch(embedUrl, { headers: { "Referer": BASE_URL } });
                    logDebug(`[Streamhide] Exécution de vidhideExtractor...`);
                    let streamUrl = vidhideExtractor(await req.text()); 
                    if (streamUrl) {
                        const typeStr = streamUrl.includes(".m3u8") ? "HLS" : "MP4";
                        streams.push({ title: `Streamhide (${typeStr})`, streamUrl: streamUrl, headers: { "Referer": embedUrl, "User-Agent": "Mozilla/5.0" } });
                        logDebug(`[Streamhide] 🟢 SUCCÈS ! Flux final trouvé : ${streamUrl}`);
                    } else {
                        failedLinks.push({ server_name: "Streamhide/F16px (Protégé ou Mort)", url: embedUrl });
                        logDebug(`[Streamhide] ❌ Impossible d'extraire la vidéo (peut-être DMCA/Supprimé).`);
                    }
                } catch(e) { 
                    failedLinks.push({ server_name: "Streamhide (Crash)", url: embedUrl, error: e.message }); 
                    logDebug(`[Streamhide] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR YOURUPLOAD ---
            else if (urlLower.includes("yourupload")) {
                logDebug(`[MOTEUR] Sélection de YourUpload`);
                try {
                    const yuRes = await soraFetch(embedUrl, { headers: { "Referer": BASE_URL } });
                    const yuHtml = await yuRes.text();
                    const yuMatch = yuHtml.match(/property=["']og:video["'][^>]+content=["']([^"']+)["']/i) || yuHtml.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
                    
                    if (yuMatch) {
                        let initialStreamUrl = yuMatch[1];
                        let finalStreamUrl = initialStreamUrl;
                        try {
                            logDebug(`[YourUpload] Vérification de la redirection finale (HEAD request)...`);
                            const redirectReq = await soraFetch(initialStreamUrl, { headers: { "Referer": embedUrl, "User-Agent": "Mozilla/5.0" }, method: "HEAD" });
                            if (redirectReq && redirectReq.url && redirectReq.url !== initialStreamUrl) {
                                finalStreamUrl = redirectReq.url;
                            }
                        } catch(e) {}
                        streams.push({ title: "YourUpload (MP4)", streamUrl: finalStreamUrl, headers: { "Referer": embedUrl, "Origin": "https://www.yourupload.com", "User-Agent": "Mozilla/5.0" } });
                        logDebug(`[YourUpload] 🟢 SUCCÈS ! Lien MP4 généré.`);
                    } else {
                        failedLinks.push({ server_name: "YourUpload (Fichier Introuvable)", url: embedUrl });
                        logDebug(`[YourUpload] ❌ Code HTML ne contient aucun lien vidéo valide.`);
                    }
                } catch(e) { 
                    failedLinks.push({ server_name: "YourUpload (Crash)", url: embedUrl, error: e.message }); 
                    logDebug(`[YourUpload] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR SIBNET ---
            else if (urlLower.includes("sibnet")) {
                logDebug(`[MOTEUR] Sélection de Sibnet`);
                try {
                    const req = await soraFetch(embedUrl, { headers: { "Referer": BASE_URL }, encoding: "windows-1251" });
                    const sibHtml = await req.text();
                    const mp4Match = sibHtml.match(/player\.src\s*\(\s*\[\s*\{\s*src\s*:\s*["']([^"']+)["']/i) || sibHtml.match(/src:\s*["'](\/v\/[^"']+\.mp4)[^"']*["']/i);
                    if (mp4Match) {
                        let directUrl = mp4Match[1].startsWith("http") ? mp4Match[1] : "https://video.sibnet.ru" + mp4Match[1];
                        streams.push({ title: "Sibnet (MP4)", streamUrl: directUrl, headers: { "Referer": embedUrl, "User-Agent": "Mozilla/5.0" } });
                        logDebug(`[Sibnet] 🟢 SUCCÈS ! Flux MP4 trouvé.`);
                    } else {
                        failedLinks.push({ server_name: "Sibnet (MP4 Introuvable)", url: embedUrl });
                        logDebug(`[Sibnet] ❌ Aucun MP4 détecté dans le code source Windows-1251.`);
                    }
                } catch (e) { 
                    failedLinks.push({ server_name: "Sibnet (Crash)", url: embedUrl, error: e.message });
                    logDebug(`[Sibnet] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            // --- MOTEUR MAIL.RU ---
            else if (urlLower.includes("my.mail.ru")) {
                logDebug(`[MOTEUR] Sélection de Mail.ru`);
                try {
                    // L'URL ressemble à https://my.mail.ru/video/embed/7427523657800355959
                    const idMatch = embedUrl.match(/video\/embed\/(.+)/i);
                    if (idMatch && idMatch[1]) {
                        const videoId = idMatch[1];
                        const apiRes = await soraFetch(`https://my.mail.ru/+/video/meta/${videoId}`);
                        
                        if (apiRes) {
                            const apiJson = JSON.parse(await apiRes.text());
                            
                            if (apiJson && apiJson.videos && apiJson.videos.length > 0) {
                                for (let vid of apiJson.videos) {
                                    let directUrl = vid.url.startsWith('//') ? "https:" + vid.url : vid.url;
                                    const typeStr = directUrl.includes(".m3u8") ? "HLS" : "MP4";
                                    streams.push({ 
                                        title: `Mail.ru [${vid.key}] (${typeStr})`, 
                                        streamUrl: directUrl, 
                                        headers: { "Referer": "https://my.mail.ru/", "User-Agent": "Mozilla/5.0" } 
                                    });
                                }
                                logDebug(`[Mail.ru] 🟢 SUCCÈS ! Flux MP4 trouvé(s).`);
                            } else {
                                failedLinks.push({ server_name: "Mail.ru (API Vide)", url: embedUrl });
                                logDebug(`[Mail.ru] ❌ Aucun lien dans l'API de Mail.ru.`);
                            }
                        }
                    } else {
                        failedLinks.push({ server_name: "Mail.ru (ID Invalide)", url: embedUrl });
                        logDebug(`[Mail.ru] ❌ ID de vidéo introuvable dans l'URL.`);
                    }
                } catch (e) {
                    failedLinks.push({ server_name: "Mail.ru (Crash)", url: embedUrl, error: e.message });
                    logDebug(`[Mail.ru] 🚨 ERREUR CRITIQUE : ${e.message}`);
                }
            }
            else {
                logDebug(`[MOTEUR] ⚠️ Lecteur Inconnu : ${embedUrl}. Scan approfondi du code source...`);
                try {
                    const req = await soraFetch(embedUrl, { headers: { "Referer": BASE_URL } });
                    const htmlContent = await req.text();
                    
                    // 🌟 DÉTECTION INTELLIGENTE : Recherche de la signature Filemoon cachée
                    if (htmlContent.includes("Byse Frontend")) {
                        logDebug(`[MOTEUR] 🟢 Signature "Byse Frontend" détectée ! Clone Filemoon identifié.`);
                        try {
                            let fmResult = await filemoonExtractor(embedUrl, url, logDebug);
                            if (fmResult && fmResult.url) {
                                let qLabel = fmResult.quality ? ` [${fmResult.quality}]` : "";
                                const typeStr = fmResult.url.includes(".m3u8") ? "HLS" : "MP4";
                                streams.push({ title: `Filemoon Clone${qLabel} (${typeStr})`, streamUrl: fmResult.url, headers: { "Referer": embedUrl } });
                                logDebug(`[Filemoon Clone] 🟢 SUCCÈS ! Flux final trouvé : ${fmResult.url}`);
                            } else if (typeof fmResult === 'string') {
                                const typeStr = fmResult.includes(".m3u8") ? "HLS" : "MP4";
                                streams.push({ title: `Filemoon Clone (${typeStr})`, streamUrl: fmResult, headers: { "Referer": embedUrl } });
                                logDebug(`[Filemoon Clone] 🟢 SUCCÈS ! Flux final trouvé : ${fmResult}`);
                            } else {
                                failedLinks.push({ server_name: "Filemoon Clone (Lien Introuvable)", url: embedUrl });
                                logDebug(`[Filemoon Clone] ❌ Aucun flux final généré.`);
                            }
                        } catch (e) {
                            failedLinks.push({ server_name: "Filemoon Clone (Crash)", url: embedUrl, error: e.message });
                            logDebug(`[Filemoon Clone] 🚨 ERREUR CRITIQUE : ${e.message}`);
                        }
                    } else {
                        failedLinks.push({ server_name: "Lecteur Non Supporté", url: embedUrl });
                        logDebug(`[MOTEUR] ❌ Hôte non pris en charge définitivement.`);
                    }
                } catch(e) {
                    failedLinks.push({ server_name: "Lecteur Non Supporté (Erreur Scan)", url: embedUrl });
                    logDebug(`[MOTEUR] ⚠️ Impossible de scanner le code source.`);
                }
            }
        }

        // Filtration des résultats finaux
        let safeStreams = streams.filter(s => 
            s.streamUrl.includes('.mp4') || 
            s.streamUrl.includes('.m3u8') || 
            s.streamUrl.includes('streamtape.com')
        );
        
        let uniqueStreams = [];
        let seenUrls = new Set();
        for (let s of safeStreams) {
            if (!seenUrls.has(s.streamUrl)) { seenUrls.add(s.streamUrl); uniqueStreams.push(s); }
        }

        let totalTime = Date.now() - startTime;
        logDebug(`🏁 FIN DE L'EXTRACTION (${totalTime}ms). Serveurs valides retenus : ${uniqueStreams.length}`);

        // 📡 Logs vers Supabase pour l'historique
        if (failedLinks.length > 0) {
            sendSupabaseLog("VoirAnime", "UNSUPPORTED_HOSTS", { 
                media_path: url, 
                failed_count: failedLinks.length,
                failed_links: failedLinks,
                execution_time_ms: totalTime,
                extraction_logs: extractionLogs
            });
        }

        if (uniqueStreams.length > 0) {
            sendSupabaseLog("VoirAnime", "PLAYER", { 
                media_path: url, 
                streams_found: uniqueStreams.length,
                servers: uniqueStreams.map(s => ({ nom: s.title, lien: s.streamUrl })),
                execution_time_ms: totalTime,
                extraction_logs: extractionLogs
            });
            return JSON.stringify({ type: "servers", streams: uniqueStreams });
        } else {
            return JSON.stringify({ type: "none" });
        }

    } catch (e) {
        logDebug(`💥 CRASH GLOBAL DE L'EXTRACTEUR : ${e.message}`);
        sendSupabaseLog("VoirAnime", "ERROR", { media_path: url, error_message: String(e), extraction_logs: extractionLogs });
        return JSON.stringify({ type: "none" });
    }
}

// =====================================================================
// OUTILS DE DÉCODAGE & FETCH
// =====================================================================

// --- SORA FETCH ---
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

// --- FILEMOON EXTRACTOR ---
// 🌟 CORRECTION 2 : Ajout du paramètre parentUrl pour la double vérification
async function filemoonExtractor(url, parentUrl, logFn = console.log) {
    // Rétrocompatibilité au cas où parentUrl est omis
    if (typeof parentUrl === 'function') { logFn = parentUrl; parentUrl = "https://voir-anime.to/"; }
    else if (!parentUrl) { parentUrl = "https://voir-anime.to/"; }

    let uas = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1.1 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Mobile Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15",
        "Mozilla/5.0 (Linux; Android 11; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Mobile Safari/537.36"
    ];

    let baseHeaders = {
        "User-Agent": uas[(url ? url.length : 0) % uas.length],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
        "x-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site"
    };

    function logDebugLocal(msg) { logFn(`[FM-Core] ${msg}`); }
    logDebugLocal(`URL Initiale passée à Filemoon: ${url}`);

    // 🛡️ REQUÊTE 1 : Récupération du HTML avec l'identité de VoirAnime
    let htmlHeaders = { ...baseHeaders, "Referer": parentUrl };

    if (url && !url.match(/\/[de]\//)) {
        logDebugLocal(`Tentative de suivi du redirect HEAD (Bypass Clone)...`);
        try {
            const response = await soraFetch(url, { headers: htmlHeaders, method: 'HEAD' });
            if (response && response.url && response.url !== url) {
                url = response.url;
                logDebugLocal(`URL Redirigée trouvée : ${url}`);
            } else {
                logDebugLocal(`Échec HEAD, bascule sur le proxy simplepostrequest...`);
                const proxyResponseRaw = await soraFetch('https://passthrough-worker.simplepostrequest.workers.dev/noredirect?url=' + encodeURIComponent(url), { headers: htmlHeaders });
                if (proxyResponseRaw) {
                    let proxyResponse = JSON.parse(await proxyResponseRaw.text());
                    if (proxyResponse.location) {
                        url = proxyResponse.location;
                        logDebugLocal(`Proxy Redirect vers : ${url}`);
                    }
                }
            }
        } catch(e) { logDebugLocal(`Erreur de redirection: ${e.message}`); }
    }

    const idMatch = url ? url.match(/\/[de]\/([a-zA-Z0-9]+)/) : null;
    const videoId = idMatch ? idMatch[1] : null;
    logDebugLocal(`ID Vidéo extrait : ${videoId}`);

    if (!videoId) {
        logDebugLocal(`❌ Aucun ID trouvé dans l'URL !`);
        return null;
    }

    // 🌟 DÉTECTION 100% DYNAMIQUE DU DOMAINE MIROIR (Regex Infaillible)
    const domainMatch = url ? url.match(/https?:\/\/[^\/]+/i) : null;
    const embedOrigin = domainMatch ? domainMatch[0] : "https://filemoon.to";
    
    logDebugLocal(`Origine du lecteur détectée automatiquement : ${embedOrigin}`);
    
    logDebugLocal(`Récupération de la page embed pour extraire le fingerprint...`);
    const embedRes = await soraFetch(url, { headers: htmlHeaders, method: 'GET' });
    let embedHtml = "";
    if (embedRes) embedHtml = await embedRes.text();

    let fingerprint = {
        token: "",
        viewer_id: "",
        device_id: "",
        confidence: 0.91
    };

    // 🌟 DÉCOMPRESSION DU JAVASCRIPT OBFUSQUÉ POUR TROUVER LES CLÉS
    let htmlToScan = embedHtml;
    if (htmlToScan.includes('eval(function(p,a,c,k,e,d)')) {
        try {
            let packRegex = /eval\(function\(p,a,c,k,e,d\).*?\.split\('\|'\)\)\)/g;
            let packMatches = htmlToScan.match(packRegex);
            if (packMatches) {
                for (let packed of packMatches) {
                    let argsMatch = packed.match(/}\s*\(\s*(['"])(.*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])(.*?)\5\.split\('\|'\)/);
                    if (argsMatch) {
                        let p = argsMatch[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
                        let a = parseInt(argsMatch[3], 10);
                        let c = parseInt(argsMatch[4], 10);
                        let k = argsMatch[6].split('|');
                        let e = function(c) { return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36)); };
                        while (c--) if (k[c]) p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
                        htmlToScan += "\n" + p; // On ajoute le code déchiffré pour le scan
                    }
                }
            }
        } catch(e) { logDebugLocal(`⚠️ Erreur d'unpacking : ${e.message}`); }
    }

    try {
        // 🌟 REGEX AMÉLIORÉS POUR CAPTURER LES CLÉS (MÊME SANS GUILLEMETS)
        const tokenMatch = htmlToScan.match(/['"]?token['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
        const viewerIdMatch = htmlToScan.match(/['"]?viewer_id['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
        const deviceIdMatch = htmlToScan.match(/['"]?device_id['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
        
        if (tokenMatch) fingerprint.token = tokenMatch[1];
        if (viewerIdMatch) fingerprint.viewer_id = viewerIdMatch[1];
        if (deviceIdMatch) fingerprint.device_id = deviceIdMatch[1];
        
        logDebugLocal(`Fingerprint extrait : token=${fingerprint.token ? "OK" : "VIDE"} | viewer_id=${fingerprint.viewer_id ? "OK" : "VIDE"}`);
    } catch (e) {
        logDebugLocal(`⚠️ Impossible d'extraire le fingerprint : ${e.message}`);
    }

    const payload = JSON.stringify({ fingerprint: fingerprint });

    let parentOrigin = "https://voir-anime.to";
    try { if (parentUrl) parentOrigin = new URL(parentUrl).origin; } catch(e){}

    // 🌟 🛡️ REQUÊTE 2 : Appel de l'API en FORÇANT L'ORIGIN DU SITE PARENT !
    let apiHeaders = {
        ...baseHeaders,
        "Origin": parentOrigin,
        "Referer": parentUrl,
        "Content-Type": "application/json"
    };

    const apiUrl = `${embedOrigin}/api/videos/${videoId}/embed/playback`;
    try {
        logDebugLocal(`Appel API interne Filemoon (POST) : ${apiUrl}`);
        const response = await soraFetch(apiUrl, { headers: apiHeaders, method: 'POST', body: payload });
        const json = await response.json();
        
        // 🌟 NOUVELLE SÉCURITÉ ICI
        if (!json || !json.playback) {
            logDebugLocal(`❌ L'API Filemoon n'a pas renvoyé les données (Vidéo supprimée/DMCA). Réponse: ${JSON.stringify(json)}`);
            return null;
        }

        logDebugLocal(`Payload JSON reçu de l'API. Lancement du décrypteur...`);
        const decryptor = new FileMoonDecryptor(json, logDebugLocal);
        const decrypted = await decryptor.decrypt();
        
        if (decrypted && decrypted.sources && decrypted.sources.length > 0) {
            let bestSource = decrypted.sources.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
            if (bestSource && bestSource.url) {
                logDebugLocal(`Flux final trouvé dans la source décryptée !`);
                return { url: bestSource.url, quality: bestSource.label || "HD" };
            }
        }
        
        logDebugLocal(`❌ Aucun flux stream trouvé après le déchiffrement.`);
        return null;
    } catch (error) {
        logDebugLocal(`🚨 Erreur critique dans le processus API Filemoon : ${error.message}`);
        return null;
    }
}

class FileMoonDecryptor {
    constructor(data, logFn) { 
        this.d = data.playback; 
        this.logLocal = logFn || console.log;
    }
    
    async decrypt() {
        this.logLocal(`Analyse de l'encryption en cours...`);
        try {
            const phpEndpoint = 'https://api.jm26.net/decryptAESGCM/';
            this.logLocal(`Envoi de la requête de déchiffrement à JM26 Endpoint...`);
            
            const response = await soraFetch(phpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key_parts: this.d.key_parts,
                    payload: this.d.payload,
                    iv: this.d.iv
                })
            });
            
            if(!response) return null;
            const resultText = await response.text();
            const result = JSON.parse(resultText);
            
            if (!result.success) throw new Error(result.error || 'Déchiffrement JM26 refusé');
            
            this.logLocal(`Déchiffrement réussi sur le serveur PHP.`);
            return result.data;
        } catch(e) {
            this.logLocal(`Échec du déchiffrement : ${e.message}`);
            return null;
        }
    }
}

// --- AUTRES EXTRACTEURS ---
function voeExtractor(html) {
    try {
        const jsonScriptMatch = html.match(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!jsonScriptMatch) return null;

        const obfuscatedJson = jsonScriptMatch[1].trim();
        let data;
        try { data = JSON.parse(obfuscatedJson); } catch (e) { return null; }
        
        if (!Array.isArray(data) || typeof data[0] !== "string") return null;
        
        let obfuscatedString = data[0];
        let step1 = voeRot13(obfuscatedString);
        let step2 = voeRemovePatterns(step1);
        let step3 = voeBase64Decode(step2);
        let step4 = voeShiftChars(step3, 3);
        let step5 = step4.split("").reverse().join("");
        let step6 = voeBase64Decode(step5);

        try { step6 = decodeURIComponent(escape(step6)); } catch(e) {}

        let result;
        try { result = JSON.parse(step6); } catch (e) { return null; }

        if (result && typeof result === "object") {
            let streamUrl = result.direct_access_url;
            if (!streamUrl && result.source && Array.isArray(result.source)) {
                let found = result.source.find(url => url && url.direct_access_url && url.direct_access_url.startsWith("http"));
                if(found) streamUrl = found.direct_access_url;
            }
            if (!streamUrl) {
                const stringified = JSON.stringify(result);
                const m3u8Match = stringified.match(/https?:\/\/[^"]+\.m3u8[^"]*/i);
                if (m3u8Match) streamUrl = m3u8Match[0];
            }
            if (streamUrl) return streamUrl;
        }
        return null;
    } catch(err) { return null; }
}

function voeRot13(str) {
    return str.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
    });
}

function voeRemovePatterns(str) {
    const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
    let result = str;
    for (const pat of patterns) { result = result.split(pat).join(""); }
    return result;
}

function voeBase64Decode(str) {
    if (typeof atob === "function") { try { return atob(str); } catch (e) {} }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/[=]+$/, '');
    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

function voeShiftChars(str, shift) {
    return str.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - shift)).join("");
}

function vidhideExtractor(html) {
    try {
        let videoUrl = null;
        let directMatch = html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
        if (directMatch) {
            videoUrl = directMatch[1];
        } 
        else if (html.includes('eval(function(p,a,c,k,e,d)')) {
            let packRegex = /eval\(function\(p,a,c,k,e,d\).*?\.split\('\|'\)\)\)/g;
            let packMatches = html.match(packRegex);
            if (packMatches) {
                for (let packed of packMatches) {
                    let argsMatch = packed.match(/}\s*\(\s*(['"])(.*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])(.*?)\5\.split\('\|'\)/);
                    if (argsMatch) {
                        let p = argsMatch[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
                        let a = parseInt(argsMatch[3], 10);
                        let c = parseInt(argsMatch[4], 10);
                        let k = argsMatch[6].split('|');
                        let e = function(c) {
                            return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
                        };
                        while (c--) if (k[c]) p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
                        let unpackedMatch = p.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                        if (unpackedMatch) { videoUrl = unpackedMatch[1]; break; }
                    }
                }
            }
        }
        return videoUrl ? videoUrl.replace(/\\\//g, "/").trim() : null;
    } catch (e) { return null; }
}
