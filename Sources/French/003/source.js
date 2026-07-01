// ==========================================
// ⚙️ MODULE MOVIX (Interface TMDB + Super Agrégateur Movix + Télémétrie)
// ==========================================

const TMDB_KEY = "f3d757824f08ea2cff45eb8f47ca3a1e";

// ==========================================
// 🗄️ TRACKER SUPABASE (Statistiques)
// ==========================================
const SUPABASE_URL = "https://qyeisgowjisqbatrmqta.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_F68CBjFVPh71U0SdD9BQJg_UJgL9-Fj";

async function sendSupabaseLog(moduleName, actionType, dataPayload) {
    try {
        const payload = { module: moduleName, action: actionType, data: dataPayload };
        const headers = { 
            "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Prefer": "return=minimal" 
        };
        if (typeof fetchv2 !== 'undefined') {
            await fetchv2(`${SUPABASE_URL}/rest/v1/app_logs`, headers, "POST", JSON.stringify(payload));
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/app_logs`, { method: "POST", headers: headers, body: JSON.stringify(payload) });
        }
    } catch (e) { }
}

// --- GESTIONNAIRE DE REQUÊTES ROBUSTE (soraFetch) ---
async function soraFetch(url, options = {}) {
    let finalHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...(options.headers || {})
    };

    if (url.includes('movix.cloud')) {
        if (!finalHeaders["Accept"]) finalHeaders["Accept"] = "application/json";
        if (!finalHeaders["Referer"]) finalHeaders["Referer"] = "https://movix.cloud/";
        if (!finalHeaders["Origin"]) finalHeaders["Origin"] = "https://movix.cloud";
    } else {
        if (!finalHeaders["Accept"]) finalHeaders["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
    }

    try {
        if (typeof fetchv2 !== 'undefined') {
            return await fetchv2(url, finalHeaders, options.method ?? 'GET', options.body ?? null, true, options.encoding ?? 'UTF-8');
        } else {
            return await fetch(url, { headers: finalHeaders, method: options.method ?? 'GET', body: options.body ?? null });
        }
    } catch(e) {
        try {
            return await fetch(url, { headers: finalHeaders, method: options.method ?? 'GET', body: options.body ?? null });
        } catch(error) {
            console.log(`[soraFetch] Erreur fatale sur ${url} : ${error}`);
            return null;
        }
    }
}

// ==========================================
// 1. RECHERCHE (100% TMDB)
// ==========================================
async function searchResults(keyword) {
    console.log(`\n=========================================================`);
    console.log(`[Movix | 🔍 Recherche] Lancement pour : "${keyword}"`);
    try {
        const types = ['movie', 'tv'];
        let allResults = [];

        const promises = types.map(async (type) => {
            const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(keyword)}&language=fr-FR`;
            const res = await soraFetch(url);
            if (!res) return { results: [] };
            const text = typeof res === "string" ? res : await res.text();
            return JSON.parse(text);
        });

        const [movieData, tvData] = await Promise.all(promises);

        (tvData.results || []).forEach(item => {
            if (item.poster_path) {
                allResults.push({
                    title: item.name, 
                    image: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                    href: `movix/tv/${item.id}`,
                    popularity: item.popularity + (item.original_language === 'ja' ? 1000 : 0)
                });
            }
        });

        (movieData.results || []).forEach(item => {
            if (item.poster_path) {
                allResults.push({
                    title: item.title,
                    image: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
                    href: `movix/movie/${item.id}`,
                    popularity: item.popularity
                });
            }
        });

        allResults.sort((a, b) => b.popularity - a.popularity);
        
        console.log(`[Movix | 🔍 Recherche] ✅ ${allResults.length} résultats trouvés pour "${keyword}".`);
        sendSupabaseLog("Movix", "SEARCH", { 
            keyword: keyword, results_count: allResults.length, top_results: allResults.slice(0, 3).map(r => r.title)
        });

        return JSON.stringify(allResults);
    } catch (e) {
        console.log(`[Movix | 🚨 Erreur] Recherche TMDB : ${e.message}`);
        return JSON.stringify([]);
    }
}

// ==========================================
// 2. DÉTAILS (100% TMDB)
// ==========================================
async function extractDetails(href) {
    try {
        href = decodeURIComponent(href);
        const parts = href.split('/');
        const type = parts[1]; 
        const id = parts[2];

        console.log(`[Movix | 📂 TMDB] Chargement des détails pour l'ID ${id}...`);
        const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=fr-FR`;
        const res = await soraFetch(detailsUrl);
        if (!res) throw new Error("Réponse vide de TMDB");
        
        const text = typeof res === "string" ? res : await res.text();
        const details = JSON.parse(text);

        console.log(`[Movix | 📂 TMDB] ✅ Détails chargés : ${details.title || details.name}`);
        sendSupabaseLog("Movix", "DETAILS", { tmdb_id: id, type: type, title: details.title || details.name });

        return JSON.stringify([{
            description: details.overview || "Aucune description disponible pour ce contenu.",
            aliases: `Type: ${type === 'movie' ? 'Film' : 'Série'}`,
            airdate: `Date: ${details.release_date || details.first_air_date || 'N/A'}`
        }]);
    } catch (e) {
        console.log(`[Movix | 🚨 Erreur] Détails TMDB : ${e.message}`);
        return JSON.stringify([{ description: "Erreur lors du chargement des détails.", aliases: "", airdate: "" }]);
    }
}

// ==========================================
// 3. ÉPISODES (100% TMDB pour les miniatures)
// ==========================================
async function extractEpisodes(href) {
    try {
        href = decodeURIComponent(href);
        const parts = href.split('/');
        const type = parts[1]; 
        const id = parts[2];
        let episodes = [];

        console.log(`[Movix | 📺 TMDB] Génération des épisodes pour l'ID ${id}...`);
        const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=fr-FR`;
        const res = await soraFetch(detailsUrl);
        if (!res) return JSON.stringify([]);
        
        const text = typeof res === "string" ? res : await res.text();
        const details = JSON.parse(text);

        if (type === 'movie') {
            episodes.push({
                number: 1,
                title: details.title || "Le Film",
                image: details.backdrop_path ? `https://image.tmdb.org/t/p/w500${details.backdrop_path}` : "",
                href: `stream/movie/${id}`
            });
        } else if (type === 'tv') {
            if (details.seasons) {
                for (const season of details.seasons) {
                    const sNum = season.season_number;
                    if (sNum === 0) continue; 

                    const seasonUrl = `https://api.themoviedb.org/3/tv/${id}/season/${sNum}?api_key=${TMDB_KEY}&language=fr-FR`;
                    try {
                        const sRes = await soraFetch(seasonUrl);
                        if (!sRes) continue;
                        
                        const sText = typeof sRes === "string" ? sRes : await sRes.text();
                        const sData = JSON.parse(sText);

                        if (sData.episodes) {
                            sData.episodes.forEach(ep => {
                                episodes.push({
                                    number: ep.episode_number,
                                    season: sNum,
                                    title: ep.name ? `S${sNum}E${ep.episode_number} - ${ep.name}` : `Épisode ${ep.episode_number}`,
                                    image: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : "",
                                    href: `stream/tv/${id}/${sNum}/${ep.episode_number}`
                                });
                            });
                        }
                    } catch (err) { }
                }
            }
        }
        
        console.log(`[Movix | 📺 TMDB] ✅ ${episodes.length} épisodes générés avec succès.`);
        return JSON.stringify(episodes);
    } catch (e) {
        console.log(`[Movix | 🚨 Erreur] Épisodes TMDB : ${e.message}`);
        return JSON.stringify([]);
    }
}

// ==========================================
// 4. LECTEUR (SUPER AGRÉGATEUR D'APIs)
// ==========================================
async function extractStreamUrl(href) {
    const startTime = Date.now();
    let mediaTitle = "Inconnu";
    let failedLinks = [];
    let skippedLinksCount = 0;
    
    try {
        const parts = href.split('/');
        const type = parts[1]; 
        const tmdbId = parts[2];
        const seasonNum = type === 'tv' ? parseInt(parts[3]) : 1;
        const episodeNum = type === 'tv' ? parseInt(parts[4]) : 1;

        console.log(`\n=========================================================`);
        console.log(`[Movix | 🚀 Agrégateur] 🎬 Lancement pour TMDB ID: ${tmdbId} (S${seasonNum} E${episodeNum})`);

        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=fr-FR`;
        const tmdbRes = await soraFetch(tmdbUrl);
        if (!tmdbRes) throw new Error("Impossible de joindre TMDB");
        const tmdbData = JSON.parse(typeof tmdbRes === "string" ? tmdbRes : await tmdbRes.text());
        mediaTitle = type === 'movie' ? tmdbData.title : tmdbData.name;

        const isAnime = tmdbData.original_language === 'ja' || (tmdbData.origin_country && tmdbData.origin_country.includes('JP'));

        let movixInternalId = null;
        try {
            console.log(`[Movix | 🚀 Agrégateur] 🔄 Recherche de l'ID Interne Movix pour "${mediaTitle}"...`);
            let searchUrl = `https://api.movix.cloud/api/search?title=${encodeURIComponent(mediaTitle)}`;
            let searchRes = await soraFetch(searchUrl);
            if (searchRes) {
                let searchJson = JSON.parse(await searchRes.text());
                if (searchJson && searchJson.results) {
                    let match = searchJson.results.find(r => String(r.tmdb_id) === String(tmdbId));
                    if (match) {
                        movixInternalId = match.id;
                        console.log(`[Movix | 🚀 Agrégateur] ✅ ID Interne trouvé : ${movixInternalId}`);
                    }
                }
            }
        } catch(e) {
            console.log(`[Movix | 🚀 Agrégateur] ⚠️ Échec de la traduction d'ID Interne.`);
        }

        let targetLinks = [];
const linkCountBySource = {};

const addLink = (url, langStr, qualityStr = null, parentDomain = null) => {
    if (!url || typeof url !== 'string' || url.includes("void.mp4")) return;

    // Tracker la source
    const sourceName = parentDomain || "inconnu";
    linkCountBySource[sourceName] = (linkCountBySource[sourceName] || 0) + 1;

	let l = (langStr || "").toUpperCase();
	let prefix = "[VF]";
	if (l.includes("VOSTFR") || l.includes("SUB")) prefix = "[VOSTFR]";
	else if (l.includes("VA") || l.includes("ENG")) prefix = "[VA]";
	else if (l === "VFQ" || l === "VFF" || l === "DEFAULT" || l.includes("VF") || l.includes("FRENCH") || l.includes("MULTI")) prefix = "[VF]";
	else if (l.length > 0 && l.length < 10) prefix = `[${l}]`;

    if (qualityStr) {
        let q = qualityStr.toUpperCase();
        if (q.includes("4K")) prefix += " 4K";
        else if (q.includes("1080")) prefix += " 1080p";
        else if (q.includes("720")) prefix += " 720p";
    }

    let finalParent = parentDomain || "https://movix.cloud/";

    if (!targetLinks.find(t => t.url === url)) {
        targetLinks.push({ url, prefix, parentDomain: finalParent });
    }
};

        // --- DÉFINITION DES BLOCS DE RECHERCHE ---

        const runStandardAPIs = async () => {
            let fetchPromises = [];
            if (type === 'tv') {
                
                if (movixInternalId) {
                    let urlDL = `https://api.movix.cloud/api/series/download/${movixInternalId}/season/${seasonNum}/episode/${episodeNum}`;
                    console.log(`   📡 [Sonde] Direct (Interne) : ${urlDL}`);
                    fetchPromises.push(soraFetch(urlDL).then(async r => {
                        if(!r) return;
                        const j = JSON.parse(await r.text());
                        if(j?.sources) j.sources.forEach(src => {
                            if (src.m3u8) addLink(src.m3u8, src.language, src.quality, "https://movix.cloud/");
                            else addLink(src.src, src.language, src.quality, "https://movix.cloud/");
                        });
                    }).catch(()=>{}));
                }

                let urlTMDB = `https://api.movix.cloud/api/tmdb/tv/${tmdbId}?season=${seasonNum}&episode=${episodeNum}`;
                console.log(`   📡 [Sonde] TMDB : ${urlTMDB}`);
                fetchPromises.push(soraFetch(urlTMDB).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] TMDB : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const count = j?.current_episode?.player_links?.length || 0;
                    console.log(`   📥 [Réponse] TMDB : ${count} lien(s)`);
                    if(j?.current_episode?.player_links) j.current_episode.player_links.forEach(p => addLink(p.decoded_url, p.language, p.quality, "https://www.themoviedb.org/"));
                }).catch(e => console.log(`   ❌ [Réponse] TMDB : erreur ${e.message}`)));

                let urlPurstream = `https://api.movix.cloud/api/purstream/tv/${tmdbId}/stream?season=${seasonNum}&episode=${episodeNum}`;
                console.log(`   📡 [Sonde] Purstream : ${urlPurstream}`);
                fetchPromises.push(soraFetch(urlPurstream).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] Purstream : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const count = j?.sources?.length || 0;
                    console.log(`   📥 [Réponse] Purstream : ${count} lien(s)`);
                    if(j?.sources) j.sources.forEach(src => addLink(src.url, src.name, null, "https://purstream.ac/"));
                }).catch(e => console.log(`   ❌ [Réponse] Purstream : erreur ${e.message}`)));

                let urlFstream = `https://api.movix.cloud/api/fstream/tv/${tmdbId}/season/${seasonNum}`;
                console.log(`   📡 [Sonde] Fstream : ${urlFstream}`);
                fetchPromises.push(soraFetch(urlFstream).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] Fstream : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const ep = j?.episodes?.[String(episodeNum)];
                    const langs = Object.keys(ep?.languages||{});
                    const count = langs.reduce((acc,l) => acc + (ep.languages[l]?.length||0), 0);
                    console.log(`   📥 [Réponse] Fstream : ${count} lien(s) | langues: ${langs.join(', ')||'aucune'}`);
                    if(ep?.languages) Object.keys(ep.languages).forEach(lang => ep.languages[lang].forEach(p => addLink(p.url, lang, p.quality, "https://french-stream.one/")));
                }).catch(e => console.log(`   ❌ [Réponse] Fstream : erreur ${e.message}`)));

                let urlWiflix = `https://api.movix.cloud/api/wiflix/tv/${tmdbId}/${seasonNum}`;
                console.log(`   📡 [Sonde] Wiflix : ${urlWiflix}`);
                fetchPromises.push(soraFetch(urlWiflix).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] Wiflix : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const ep = j?.episodes?.[String(episodeNum)];
                    const langs = Object.keys(ep||{});
                    const count = langs.reduce((acc,l) => acc + (Array.isArray(ep[l])?ep[l].length:0), 0);
                    console.log(`   📥 [Réponse] Wiflix : ${count} lien(s) | langues: ${langs.join(', ')||'aucune'}`);
                    if(ep) Object.keys(ep).forEach(lang => {
                        if(Array.isArray(ep[lang])) ep[lang].forEach(p => addLink(p.url, lang, null, "https://wiflix.voto/"));
                    });
                }).catch(e => console.log(`   ❌ [Réponse] Wiflix : erreur ${e.message}`)));

                let urlCpasmal = `https://api.movix.cloud/api/cpasmal/tv/${tmdbId}/${seasonNum}/${episodeNum}`;
                console.log(`   📡 [Sonde] Cpasmal : ${urlCpasmal}`);
                fetchPromises.push(soraFetch(urlCpasmal).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] Cpasmal : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const langs = Object.keys(j?.links||{});
                    const count = langs.reduce((acc,l) => acc + (j.links[l]?.length||0), 0);
                    console.log(`   📥 [Réponse] Cpasmal : ${count} lien(s) | langues: ${langs.join(', ')||'aucune'}`);
                    if(j?.links) Object.keys(j.links).forEach(lang => j.links[lang].forEach(p => addLink(p.url, lang, null, "https://cpasmal.com/")));
                }).catch(e => console.log(`   ❌ [Réponse] Cpasmal : erreur ${e.message}`)));

                let urlLinks = `https://api.movix.cloud/api/links/tv/${tmdbId}?season=${seasonNum}&episode=${episodeNum}`;
                console.log(`   📡 [Sonde] Links : ${urlLinks}`);
                fetchPromises.push(soraFetch(urlLinks).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] Links : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const count = j?.data?.reduce((acc,d) => acc + (d.links?.length||0), 0) || 0;
                    console.log(`   📥 [Réponse] Links : ${count} lien(s)`);
                    if(j?.success && j?.data) {
                        j.data.forEach(d => {
                            if(d.links) d.links.forEach(link => addLink(link, "VF", null, "https://movix.cloud/")); 
                        });
                    }
                }).catch(e => console.log(`   ❌ [Réponse] Links : erreur ${e.message}`)));

                let urlImdb = `https://api.movix.cloud/api/imdb/tv/${tmdbId}`;
                console.log(`   📡 [Sonde] IMDB : ${urlImdb}`);
                fetchPromises.push(soraFetch(urlImdb).then(async r => {
                    if(!r) { console.log(`   ❌ [Réponse] IMDB : pas de réponse`); return; }
                    const j = JSON.parse(await r.text());
                    const s = j?.series?.[0]?.seasons?.find(x => String(x.number) === String(seasonNum));
                    const ep = s?.episodes?.find(x => String(x.number) === String(episodeNum));
                    const langs = Object.keys(ep?.versions||{});
                    const count = langs.reduce((acc,l) => acc + (ep.versions[l]?.players?.length||0), 0);
                    console.log(`   📥 [Réponse] IMDB : ${count} lien(s) | langues: ${langs.join(', ')||'aucune'}`);
                    if(ep?.versions) {
                        Object.keys(ep.versions).forEach(lang => {
                            if(ep.versions[lang].players) ep.versions[lang].players.forEach(p => addLink(p.link, lang, null, "https://www.imdb.com/"));
                        });
                    }
                }).catch(e => console.log(`   ❌ [Réponse] IMDB : erreur ${e.message}`)));
            } else {
                
                if (movixInternalId) {
                    let urlDL = `https://api.movix.cloud/api/movies/download/${movixInternalId}`;
                    console.log(`   📡 [Sonde] Direct (Interne) : ${urlDL}`);
                    fetchPromises.push(soraFetch(urlDL).then(async r => {
                        if(!r) return;
                        const j = JSON.parse(await r.text());
                        if(j?.sources) j.sources.forEach(src => {
                            if (src.m3u8) addLink(src.m3u8, src.language, src.quality, "https://movix.cloud/");
                            else addLink(src.src, src.language, src.quality, "https://movix.cloud/");
                        });
                    }).catch(()=>{}));
                }

                let urlTMDB = `https://api.movix.cloud/api/tmdb/movie/${tmdbId}`;
                console.log(`   📡 [Sonde] TMDB : ${urlTMDB}`);
                fetchPromises.push(soraFetch(urlTMDB).then(async r => {
                     if(!r) { console.log(`   ❌ [Réponse] TMDB : pas de réponse`); return; }
                     const text = await r.text();
                     const j = JSON.parse(text);
                     const count = j?.player_links?.length || 0;
                     console.log(`   📥 [Réponse] TMDB : ${count} lien(s) | langues: ${[...new Set((j?.player_links||[]).map(p=>p.language))].join(', ')||'aucune'}`);
                     if(j?.player_links) j.player_links.forEach(p => addLink(p.decoded_url, p.language, p.quality, "https://www.themoviedb.org/"));
                }).catch(e => console.log(`   ❌ [Réponse] TMDB : erreur ${e.message}`)));
                
                let urlPurstream = `https://api.movix.cloud/api/purstream/movie/${tmdbId}/stream`;
                console.log(`   📡 [Sonde] Purstream : ${urlPurstream}`);
                fetchPromises.push(soraFetch(urlPurstream).then(async r => {
                     if(!r) { console.log(`   ❌ [Réponse] Purstream : pas de réponse`); return; }
                     const j = JSON.parse(await r.text());
                     const count = j?.sources?.length || 0;
                     console.log(`   📥 [Réponse] Purstream : ${count} lien(s)`);
                     if(j?.sources) j.sources.forEach(src => addLink(src.url, src.name, null, "https://purstream.ac/"));
                }).catch(e => console.log(`   ❌ [Réponse] Purstream : erreur ${e.message}`)));
                
                let urlFstream = `https://api.movix.cloud/api/fstream/movie/${tmdbId}`;
                console.log(`   📡 [Sonde] Fstream : ${urlFstream}`);
                fetchPromises.push(soraFetch(urlFstream).then(async r => {
                     if(!r) { console.log(`   ❌ [Réponse] Fstream : pas de réponse`); return; }
                     const j = JSON.parse(await r.text());
                     const langs = Object.keys(j?.languages || j?.players || {});
                     const count = langs.reduce((acc, l) => acc + ((j?.languages||j?.players||{})[l]?.length||0), 0);
                     console.log(`   📥 [Réponse] Fstream : ${count} lien(s) | langues: ${langs.join(', ')||'aucune'}`);
                     if(j?.players) Object.keys(j.players).forEach(lang => j.players[lang].forEach(p => addLink(p.url, lang === "Default" ? "VF" : lang, p.quality, "https://french-stream.one/")));
                     else if(j?.languages) Object.keys(j.languages).forEach(lang => j.languages[lang].forEach(p => addLink(p.url, lang, p.quality, "https://french-stream.one/")));
                }).catch(e => console.log(`   ❌ [Réponse] Fstream : erreur ${e.message}`)));
                
                let urlWiflix = `https://api.movix.cloud/api/wiflix/movie/${tmdbId}`;
                console.log(`   📡 [Sonde] Wiflix : ${urlWiflix}`);
                fetchPromises.push(soraFetch(urlWiflix).then(async r => {
                     if(!r) { console.log(`   ❌ [Réponse] Wiflix : pas de réponse`); return; }
                     const j = JSON.parse(await r.text());
                     const vfCount = j?.players?.vf?.length || 0;
                     const vostfrCount = j?.players?.vostfr?.length || 0;
                     const linksCount = Object.keys(j?.links||{}).reduce((acc,l) => acc + (j.links[l]?.length||0), 0);
                     console.log(`   📥 [Réponse] Wiflix : ${vfCount} VF, ${vostfrCount} VOSTFR, ${linksCount} autres`);
                     if(j?.players) {
                         (j.players.vf||[]).forEach(p => addLink(p.url, "VF", null, "https://wiflix.voto/"));
                         (j.players.vostfr||[]).forEach(p => addLink(p.url, "VOSTFR", null, "https://wiflix.voto/"));
                     }
                     if(j?.links) Object.keys(j.links).forEach(lang => j.links[lang].forEach(p => addLink(p.url, lang, null, "https://wiflix.voto/")));
                }).catch(e => console.log(`   ❌ [Réponse] Wiflix : erreur ${e.message}`)));
                
                let urlCpasmal = `https://api.movix.cloud/api/cpasmal/movie/${tmdbId}`;
                console.log(`   📡 [Sonde] Cpasmal : ${urlCpasmal}`);
                fetchPromises.push(soraFetch(urlCpasmal).then(async r => {
                     if(!r) { console.log(`   ❌ [Réponse] Cpasmal : pas de réponse`); return; }
                     const j = JSON.parse(await r.text());
                     const langs = Object.keys(j?.links||{});
                     const count = langs.reduce((acc, l) => acc + (j.links[l]?.length||0), 0);
                     console.log(`   📥 [Réponse] Cpasmal : ${count} lien(s) | langues: ${langs.join(', ')||'aucune'}`);
                     if(j?.links) Object.keys(j.links).forEach(lang => j.links[lang].forEach(p => addLink(p.url, lang, null, "https://cpasmal.com/")));
                }).catch(e => console.log(`   ❌ [Réponse] Cpasmal : erreur ${e.message}`)));

                let urlLinks = `https://api.movix.cloud/api/links/movie/${tmdbId}`;
                console.log(`   📡 [Sonde] Links : ${urlLinks}`);
                fetchPromises.push(soraFetch(urlLinks).then(async r => {
                     if(!r) { console.log(`   ❌ [Réponse] Links : pas de réponse`); return; }
                     const j = JSON.parse(await r.text());
                     const count = Array.isArray(j?.data) ? j.data.reduce((acc, d) => acc + (d.links?.length||0), 0) : 0;
                     console.log(`   📥 [Réponse] Links : ${count} lien(s)`);
                     if(j?.success && j?.data) {
                         j.data.forEach(d => {
                             if(d.links) d.links.forEach(link => addLink(link, "VF", null, "https://movix.cloud/")); 
                         });
                     }
                }).catch(e => console.log(`   ❌ [Réponse] Links : erreur ${e.message}`)));
            }

            await Promise.all(fetchPromises);
        };

        const runAnimeAPI = async () => {
            let absoluteEpisodeIndex = 0;
            if (tmdbData.seasons) {
                let validSeasons = tmdbData.seasons.filter(s => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
                for (let s of validSeasons) {
                    if (s.season_number < seasonNum) absoluteEpisodeIndex += s.episode_count;
                }
            }
            absoluteEpisodeIndex += episodeNum;
            console.log(`[Movix | 🚀 Agrégateur] 📊 Index Absolu pour l'Anime : Épisode n°${absoluteEpisodeIndex}`);

            let titlesToTry = [mediaTitle.trim()];
            if (tmdbData.original_name && tmdbData.original_name !== mediaTitle) titlesToTry.push(tmdbData.original_name.trim()); 
            if (mediaTitle.includes(' ')) {
                titlesToTry.push(mediaTitle.replace(/\s+/g, '').trim()); 
                titlesToTry.push(mediaTitle.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase()).trim()); 
                titlesToTry.push((mediaTitle.charAt(0).toUpperCase() + mediaTitle.slice(1).toLowerCase().replace(/\s+/g, '')).trim()); 
            }
            if (mediaTitle.includes(':')) titlesToTry.push(mediaTitle.split(':')[0].trim());
            titlesToTry = [...new Set(titlesToTry)];

            let movixData = [];
            for (let t of titlesToTry) {
                let movixUrl = `https://api.movix.cloud/anime/search/${encodeURIComponent(t)}?includeSeasons=true&includeEpisodes=true`;
                console.log(`   📡 [Sonde] Secours Anime : ${movixUrl}`);
                let movixRes = await soraFetch(movixUrl);
                if (movixRes) {
                    let movixText = typeof movixRes === "string" ? movixRes : await movixRes.text();
                    try {
                        const parsed = JSON.parse(movixText);
                        let tempData = Array.isArray(parsed) ? parsed : (parsed.data || parsed.results || []);
                        if (tempData.length > 0) {
                            movixData = tempData;
                            break; 
                        }
                    } catch(e) {}
                }
            }

            if (movixData.length > 0) {
                const anime = movixData[0];
                let currentAbsIndex = 0;
                let exactMatch = null;
                let absMatch = null;

                if (anime.seasons) {
                    for (let season of anime.seasons) {
                        let sNumMatch = season.name.match(/\d+/);
                        let sNum = sNumMatch ? parseInt(sNumMatch[0]) : 0; 
                        if (season.episodes) {
                            for (let ep of season.episodes) {
                                currentAbsIndex++;
                                if (sNum === seasonNum && ep.index === episodeNum) exactMatch = ep.streaming_links;
                                if (currentAbsIndex === absoluteEpisodeIndex) absMatch = ep.streaming_links;
                            }
                        }
                    }
                }

                let animeLinks = exactMatch || absMatch || [];
                for (let streamGroup of animeLinks) {
                    for (let playerUrl of streamGroup.players) {
                        addLink(playerUrl, streamGroup.language, null, "https://movix.cloud/");
                    }
                }
            }
        };

        if (isAnime) {
            console.log(`[Movix | 🚀 Agrégateur] 🍥 Contenu identifié comme ANIME (Japonais). Lancement de la sonde exclusive...`);
            await runAnimeAPI();
            if (targetLinks.length === 0) {
                console.log(`[Movix | 🚀 Agrégateur] ⚠️ Aucun lien Anime trouvé. Fallback sur les serveurs standards...`);
                await runStandardAPIs();
            }
        } else {
            console.log(`[Movix | 🚀 Agrégateur] 📡 Interrogation parallèle des APIs standards...`);
            await runStandardAPIs();
            if (targetLinks.length === 0) {
                console.log(`[Movix | 🚀 Agrégateur] ⚠️ Aucun lien via les réseaux standards. Tentative de secours via l'API Anime...`);
                await runAnimeAPI();
            }
        }

        if (targetLinks.length === 0) throw new Error("Contenu totalement introuvable sur le réseau Movix");

		console.log(`[Movix | 🚀 Agrégateur] 🎯 Bilan brut : ${targetLinks.length} liens récupérés.`);
		console.log(`[Movix | 🚀 Agrégateur] 📊 Détail par source :`);
		for (const [source, count] of Object.entries(linkCountBySource)) {
			const shortName = source.replace("https://", "").replace(/\/$/, "");
			console.log(`   ${count} lien(s) ← ${shortName}`);
		}
        console.log(`---------------------------------------------------------`);

        const isHardUnsupported = (url) => {
            const u = url.toLowerCase();
            return u.includes("waaw") || u.includes("younetu") || u.includes("netu") || u.includes("hqq") ||
                   u.includes("veev") || u.includes("listeamed") || u.includes("up4fun") ||
                   u.includes("coflix"); 
        };

        let streams = [];
        let extractionTasks = [];

        const withTimeout = (promise, ms, url) => {
            if (typeof setTimeout === 'undefined') {
                return promise;
            }
            return Promise.race([
                promise,
                new Promise(resolve => setTimeout(() => {
                    console.log(`   ⏱️ [Timeout] Serveur très lent ignoré (>${ms/1000}s) : ${url}`);
                    resolve({ title: "Timeout Serveur", originalUrl: url });
                }, ms))
            ]);
        };

        for (let linkObj of targetLinks) {
            if (isHardUnsupported(linkObj.url)) {
                console.log(`   ⏭️ [Fast-Skip] Ignoré car trop lent/complexe : ${linkObj.url}`);
                failedLinks.push({ server_name: "Non Supporté (Complexe)", url: linkObj.url });
                skippedLinksCount++;
                continue;
            }
            // 🌟 On transmet le parentDomain à l'extracteur !
            extractionTasks.push(withTimeout(extractDirectVideo(linkObj.url, linkObj.prefix, linkObj.url, linkObj.parentDomain), 10000, linkObj.url));
        }

        const results = await Promise.all(extractionTasks);
        for (let res of results) {
            if (res && res.streamUrl) {
                if (!streams.find(s => s.streamUrl === res.streamUrl)) streams.push(res);
            } else if (res && res.originalUrl) {
                failedLinks.push({ server_name: res.title || "Inconnu", url: res.originalUrl });
            }
        }

        console.log(`---------------------------------------------------------`);
        console.log(`[Movix | 🏁 Bilan final] 🎬 Titre : ${mediaTitle} (S${seasonNum} E${episodeNum})`);
        console.log(`   ✅ Liens valides et décodés : ${streams.length}`);
        console.log(`   💀 Liens morts / échoués : ${failedLinks.length - skippedLinksCount}`);
        console.log(`   ⏭️ Liens ignorés (Fast-Skip) : ${skippedLinksCount}`);
        console.log(`   ⏱️ Temps total d'exécution : ${Date.now() - startTime}ms`);
        console.log(`=========================================================\n`);

        // 🌟 TRI : VF → VOSTFR → VA → reste, et regroupement par source
        const langPriority = (title) => {
            const t = (title || "").toUpperCase();
            if (t.startsWith("[VF]") || t.includes("] VF") || t.includes("[VF ")) return 0;
            if (t.startsWith("[VOSTFR]") || t.includes("[VOSTFR ")) return 1;
            if (t.startsWith("[VA]")) return 2;
            return 3;
        };

        // Extraire le nom du serveur depuis le titre (ex: "[VF] Uqload" → "Uqload")
        const serverName = (title) => {
            return (title || "").replace(/^\[[^\]]+\]\s*/, "").trim().toLowerCase();
        };

        streams.sort((a, b) => {
            const langDiff = langPriority(a.title) - langPriority(b.title);
            if (langDiff !== 0) return langDiff;
            // Même langue → tri alphabétique par nom de serveur pour regrouper
            return serverName(a.title).localeCompare(serverName(b.title));
        });

        sendSupabaseLog("Movix", "PLAYER", { 
            media_title: mediaTitle, season_number: seasonNum, ep_number: episodeNum, 
            streams_found: streams.length, hosts_scanned: targetLinks.length, execution_time_ms: Date.now() - startTime
        });
        
        if (failedLinks.length > 0 || streams.length === 0) {
            sendSupabaseLog("Movix", "UNSUPPORTED_HOSTS", { 
                media_title: mediaTitle, season_number: seasonNum, ep_number: episodeNum, 
                failed_count: failedLinks.length, failed_links: failedLinks 
            });
        }

        return JSON.stringify(streams.length > 0 ? { type: "servers", streams: streams } : { type: "none" });

    } catch (e) {
        console.log(`[Movix | 🚨 Erreur] Lecteur : ${e.message}`);
        sendSupabaseLog("Movix", "ERROR", { error_message: String(e) });
        return JSON.stringify({ type: "none" });
    }
}

// ==========================================
// 🛠️ DÉCODEURS DE LECTEURS (HOSTS)
// ==========================================
async function extractDirectVideo(embedUrl, langPrefix, originalUrl, parentDomain) {
    let urlLower = embedUrl.toLowerCase();
    let hostRecognized = false;
    let isDeleted = false;
    
    // 🌟 Sécurisation du Referer dynamique basé sur le site parent !
    let pDomain = parentDomain || "https://movix.cloud/";
    const hostDomain = (embedUrl.match(/https?:\/\/(?:www\.)?([^/]+)/i) || [])[1] || "inconnu";

    const checkIfDeleted = (html) => {
        const h = html.toLowerCase();
        return h.includes("file was deleted") || h.includes("file not found") ||
               h.includes("video not found") || h.includes("video is not found") ||
               h.includes("video deleted") || h.includes("file deleted") ||
               h.includes("404 not found") || h.includes("no longer exists") ||
               h.includes("no longer available") || h.includes("видео недоступно") ||
               h.includes("videostatus"); 
    };

    try {
        // 0. LIENS DIRECTS PURSTREAM/DOWNLOAD API (.m3u8 / .mp4)
        if (urlLower.endsWith(".m3u8") || urlLower.includes("master.m3u8") || urlLower.includes(".m3u8?")) {
            hostRecognized = true;
            console.log(`   ✅ [Serveur Direct] HLS extrait avec succès !`);
            return { title: `${langPrefix} Serveur Direct (HLS)`, streamUrl: embedUrl };
        }
        if (urlLower.endsWith(".mp4") || urlLower.includes(".mp4?")) {
            hostRecognized = true;
            console.log(`   ✅ [Serveur Direct] MP4 extrait avec succès !`);
            return { title: `${langPrefix} Serveur Direct (MP4)`, streamUrl: embedUrl };
        }

        console.log(`   ⏳ [Scan] ${hostDomain} (Referer Parent: ${pDomain})...`);

        // 1. VOE (et clones reconnus comme ralphysuccessfull, jefferycontrolmodel)
        if (urlLower.includes("voe.sx") || urlLower.includes("voe.network") || urlLower.includes("voe") || urlLower.includes("lancewhosedifficult") || urlLower.includes("ralphysuccessfull") || urlLower.includes("voe1/newplayer") || urlLower.includes("jefferycontrolmodel")) {
            hostRecognized = true;
            let voeRes = await soraFetch(embedUrl, { headers: { "Referer": pDomain } });
            if (voeRes) {
                let voeHtml = await voeRes.text();
                if (checkIfDeleted(voeHtml)) isDeleted = true;

                const redirectMatch = voeHtml.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
                if (redirectMatch && redirectMatch[1]) {
                    voeRes = await soraFetch(redirectMatch[1], { headers: { "Referer": pDomain } });
                    voeHtml = await voeRes.text();
                    if (checkIfDeleted(voeHtml)) isDeleted = true;
                }

                const streamUrl = voeExtractor(voeHtml);
                if (streamUrl) {
                    console.log(`   ✅ [VOE] Flux extrait avec succès !`);
                    const typeStr = streamUrl.includes(".m3u8") ? "HLS" : "MP4";
                    return { title: `${langPrefix} VOE (${typeStr})`, streamUrl: streamUrl, headers: { "Referer": embedUrl } };
                }
            }
        }
        // 2. STREAMTAPE
        else if (urlLower.includes("streamtape")) {
            hostRecognized = true;
            const stRes = await soraFetch(embedUrl, { headers: { "Referer": pDomain } });
            if (stRes) {
                const stHtml = await stRes.text();
                if (checkIfDeleted(stHtml)) isDeleted = true;

                const robotMatch = stHtml.match(/document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*[^;]+\(['"]([^'"]+)['"]\)/i);
                if (robotMatch) {
                    let tokenStr = robotMatch[1];
                    let directUrl = "https://streamtape.com" + tokenStr.substring(tokenStr.indexOf('/get_video')) + "&dl=1";
                    console.log(`   ✅ [Streamtape] Flux extrait avec succès !`);
                    return { title: `${langPrefix} Streamtape`, streamUrl: directUrl, headers: { "Referer": "https://streamtape.com/" } };
                }
            }
        }
        // 3. SIBNET
        else if (urlLower.includes("sibnet.ru")) {
            hostRecognized = true;
            const req = await soraFetch(embedUrl, { encoding: "windows-1251", headers: { "Referer": pDomain } });
            if (req) {
                const html = await req.text();
                if (checkIfDeleted(html)) isDeleted = true;

                const srcMatch = html.match(/src:\s*["'](\/v\/[^"']+\.mp4)["']/i);
                if (srcMatch) {
                    let streamUrl = "https://video.sibnet.ru" + srcMatch[1];
                    try {
                        const redirectReq = await soraFetch(streamUrl, { method: "HEAD", headers: { "Referer": embedUrl } });
                        if (redirectReq && redirectReq.url && redirectReq.url !== streamUrl) streamUrl = redirectReq.url;
                    } catch(e) {}
                    console.log(`   ✅ [Sibnet] Flux extrait avec succès !`);
                    return { title: `${langPrefix} Sibnet`, streamUrl: streamUrl, headers: { "Referer": embedUrl, "User-Agent": "Mozilla/5.0" } };
                }
            }
        }
        // 4. VIDMOLY
        else if (urlLower.includes("vidmoly")) {
            hostRecognized = true;
            let fixedVidUrl = embedUrl.replace(/vidmoly\.(to|me|net|ru|is)/i, "vidmoly.biz");
            const vidRes = await soraFetch(fixedVidUrl, { headers: { "Referer": pDomain } });
            if (vidRes) {
                const vidHtml = await vidRes.text();
                if (checkIfDeleted(vidHtml)) isDeleted = true;

                const fileMatch = vidHtml.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || vidHtml.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
                if (fileMatch) {
                    console.log(`   ✅ [Vidmoly] Flux extrait avec succès !`);
                    return { title: `${langPrefix} Vidmoly`, streamUrl: fileMatch[1], headers: { "Referer": "https://vidmoly.biz/" } };
                }
            }
        }
        // 5. VK / VKVIDEO (On garde le referer de VK par défaut car c'est leur système interne)
        else if (urlLower.includes("vk.com") || urlLower.includes("vkvideo.ru")) {
            hostRecognized = true;
            const req = await soraFetch(embedUrl, { headers: { "Referer": "https://vk.com/" } });
            if (req) {
                const html = await req.text();
                if (checkIfDeleted(html) || html.includes("error_msg")) isDeleted = true;
                
                let matches = [...html.matchAll(/"url([0-9]+)"\s*:\s*"([^"]+)"/g)];
                if (matches.length > 0) {
                    matches.sort((a, b) => parseInt(b[1]) - parseInt(a[1])); 
                    let streamUrl = matches[0][2].replace(/\\/g, '');
                    console.log(`   ✅ [VK] Flux ${matches[0][1]}p extrait avec succès !`);
                    return { title: `${langPrefix} VK [${matches[0][1]}p]`, streamUrl: streamUrl, headers: { "Referer": "https://vk.com/" } };
                }
                
                let hlsMatch = html.match(/"hls"\s*:\s*(?:\[[^\]]*"([^"]+\.m3u8[^"]*)"|"([^"]+\.m3u8[^"]*)")/i) || html.match(/"hls"\s*:\s*"([^"]+)"/i);
                if (hlsMatch) {
                    let streamUrl = (hlsMatch[1] || hlsMatch[2] || "").replace(/\\/g, '');
                    if (streamUrl) {
                        console.log(`   ✅ [VK] Flux HLS extrait avec succès !`);
                        return { title: `${langPrefix} VK (HLS)`, streamUrl: streamUrl, headers: { "Referer": "https://vk.com/" } };
                    }
                }
                
                let sourceMatch = html.match(/<source[^>]+src=["']([^"']+)["']/i);
                if (sourceMatch) {
                    console.log(`   ✅ [VK] Flux HTML extrait avec succès !`);
                    return { title: `${langPrefix} VK`, streamUrl: sourceMatch[1].replace(/&amp;/g, '&'), headers: { "Referer": "https://vk.com/" } };
                }
            }
        }
        // 6. UQLOAD (Synchronisation Parfaite des Headers type Lulustream)
        else if (urlLower.includes("uqload")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Uqload en cours pour ${hostDomain}...`);

            // 🛡️ LE SECRET : On fige un profil de navigateur très précis
            const uqHeaders = {
                "Referer": pDomain, // Le domaine parent (ex: wiflix) pour passer le Hotlink
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            };

            // On utilise CE profil figé pour extraire la page
            const req = await soraFetch(embedUrl, { headers: uqHeaders });
            if (req) {
                 const html = await req.text();
                 if (checkIfDeleted(html)) isDeleted = true;
                 else {
                     // Utilisation du décodeur Packer pour les nouveaux liens chiffrés
                     let streamUrl = vidhideExtractor(html);
                     
                     // Fallback pour les anciens liens en clair
                     if (!streamUrl) {
                         const srcMatch = html.match(/sources\s*:\s*\["([^"]+)"\]/i) || html.match(/src\s*:\s*"([^"]+\.mp4)"/i);
                         if (srcMatch) streamUrl = srcMatch[1];
                     }

                     if (streamUrl) {
                         console.log(`   ✅ [Uqload] Flux extrait avec succès !`);
                         
                         // Pour la lecture vidéo, le serveur veut que le Referer devienne son propre domaine
                         uqHeaders["Referer"] = `https://${hostDomain}/`;
                         
                         return { 
                             title: `${langPrefix} Uqload`, 
                             streamUrl: streamUrl, 
                             headers: uqHeaders // On passe le profil figé exact au lecteur iOS !
                         };
                     }
                 }
            }
        }
        // 🌟 7. DOODSTREAM / DOPLY / VIDPLY / PLAYMOGO
        else if (urlLower.includes("dood") || urlLower.includes("doply") || urlLower.includes("vidply") || urlLower.includes("playmogo")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Doodstream en cours pour ${hostDomain}...`);
            const req = await soraFetch(embedUrl, { headers: { "Referer": pDomain } });
            if (req) {
                 const html = await req.text();
                 if (checkIfDeleted(html)) isDeleted = true;
                 else {
                     let streamUrl = await doodstreamExtractor(html, embedUrl);
                     if (streamUrl) {
                         console.log(`   ✅ [Doodstream] Flux extrait avec succès !`);
                         return { title: `${langPrefix} Doodstream`, streamUrl: streamUrl, headers: { "Referer": embedUrl } };
                     }
                 }
            }
        }
else if (urlLower.includes("hgcloud") || urlLower.includes("audinifer") || urlLower.includes("huntrexus") || urlLower.includes("vibuxer")) {
    hostRecognized = true;
    console.log(`   🕵️ Extraction HGCloud en cours pour ${hostDomain}...`);

    // Extraire l'ID vidéo
    const idMatch = embedUrl.match(/\/e\/([a-zA-Z0-9]+)/);
    if (!idMatch) {
        console.log(`   ❌ [HGCloud] ID vidéo introuvable dans : ${embedUrl}`);
    } else {
        const videoId = idMatch[1];
        console.log(`   🔍 [HGCloud] ID vidéo : ${videoId}`);

        // Appeler directement vibuxer.com/e/ID (le vrai player)
        const vibuxerUrl = `https://vibuxer.com/e/${videoId}`;
        console.log(`   📡 [HGCloud] Chargement : ${vibuxerUrl}`);

        const req = await soraFetch(vibuxerUrl, { 
            headers: { "Referer": "https://hgcloud.to/" } 
        });
        if (req) {
            const html = await req.text();
            console.log(`   🔍 [HGCloud] vibuxer HTML size: ${html.length}`);
            if (checkIfDeleted(html)) { isDeleted = true; }
            else {
                // Unpacker le eval()
                let unpackedHtml = html;
                try {
                    const packRegex = /eval\(function\(p,a,c,k,e,d\).*?\.split\('\|'\)\)\)/gs;
                    const packMatches = html.match(packRegex);
                    if (packMatches) {
                        for (let packed of packMatches) {
                            const argsMatch = packed.match(/}\s*\(\s*(['"])(.*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])(.*?)\5\.split\('\|'\)/s);
                            if (argsMatch) {
                                let p = argsMatch[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
                                const a = parseInt(argsMatch[3], 10);
                                let c = parseInt(argsMatch[4], 10);
                                const k = argsMatch[6].split('|');
                                const e = function(c) { return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36)); };
                                while (c--) { if (k[c]) p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]); }
                                unpackedHtml += "\n" + p;
                            }
                        }
                    }
                } catch(e) {}

                const hls3Match = unpackedHtml.match(/"hls3"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);
                const hls2Match = unpackedHtml.match(/"hls2"\s*:\s*"(https?:\/\/[^"]+\.m3u8[^"]*)"/i);
                let streamUrl = (hls3Match || hls2Match)?.[1];

                if (!streamUrl) {
                    const generalMatch = unpackedHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
                    if (generalMatch) streamUrl = generalMatch[1];
                }

                console.log(`   🔍 [HGCloud] hls3: ${hls3Match?.[1]?.substring(0,60) || '❌'} | hls2: ${hls2Match?.[1]?.substring(0,60) || '❌'}`);

                if (streamUrl) {
                    console.log(`   ✅ [HGCloud] Flux extrait !`);
                    return { 
                        title: `${langPrefix} HGCloud`, 
                        streamUrl: streamUrl, 
                        headers: { "Referer": vibuxerUrl } 
                    };
                }
            }
        }
    }
}
        // 🌟 9. FILEMOON ET CLONES (lukefirst, bysebuho)
        else if (urlLower.includes("filemoon") || urlLower.includes("lukefirst") || urlLower.includes("bysebuho")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Filemoon en cours pour ${hostDomain}...`);
            let fmResult = await filemoonExtractor(embedUrl, pDomain);
            
            if (fmResult && fmResult.url) {
                let qLabel = fmResult.quality ? ` [${fmResult.quality}]` : "";
                console.log(`   ✅ [Filemoon] Flux${qLabel} extrait avec succès !`);
                return { title: `${langPrefix} Filemoon${qLabel}`, streamUrl: fmResult.url, headers: { "Referer": embedUrl } };
            } else if (typeof fmResult === 'string') { 
                console.log(`   ✅ [Filemoon] Flux extrait avec succès !`);
                return { title: `${langPrefix} Filemoon`, streamUrl: fmResult, headers: { "Referer": embedUrl } };
            }
        }
        // 🌟 10. DARKIBOX
        else if (urlLower.includes("darkibox")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Darkibox en cours pour ${hostDomain}...`);
            
            let uas = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
            ];
            const headers = { 
                "User-Agent": uas[embedUrl.length % uas.length],
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Referer": pDomain
            };

            let req = await soraFetch(embedUrl, { headers: headers });
            let html = req ? await req.text() : "";

            if (!html || html.includes("Cloudflare") || html.includes("Just a moment") || html.includes("DDoS-Guard")) {
                console.log(`   🛡️ [Darkibox] Protection anti-bot détectée. Tentative de contournement...`);
                let altUrl = embedUrl.replace('/embed-', '/v/').replace('.html', '');
                let altReq = await soraFetch(altUrl, { headers: headers });
                if (altReq) {
                    let altHtml = await altReq.text();
                    if (!altHtml.includes("Just a moment") && altHtml.length > html.length) {
                        html = altHtml;
                    }
                }
            }

            if (checkIfDeleted(html)) {
                isDeleted = true;
            } else {
                let streamUrl = null;
                let srcMatch = html.match(/sources\s*:\s*\[\s*\{\s*src\s*:\s*["']([^"']+)["']/i);
                
                if (!srcMatch) srcMatch = html.match(/(https?:\/\/[a-zA-Z0-9.-]+\.darkibox\.com\/[^"'\s]+\.m3u8[^"'\s]*)/i);
                if (!srcMatch) srcMatch = html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);

                if (srcMatch && srcMatch[1]) {
                    streamUrl = srcMatch[1];
                } else {
                    streamUrl = vidhideExtractor(html);
                }

                if (streamUrl) {
                    console.log(`   ✅ [Darkibox] Flux extrait avec succès !`);
                    return { title: `${langPrefix} Darkibox`, streamUrl: streamUrl, headers: { "Referer": "https://darkibox.com/" } };
                } else {
                    console.log(`   ❌ [Darkibox] Échec : Aucun lien vidéo trouvé. (Taille HTML: ${html.length})`);
                }
            }
        }
        // 🌟 11. SAVEFILES ET CLONES (XFileSharing)
        else if (urlLower.includes("savefiles")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Savefiles en cours pour ${hostDomain}...`);
            
            const videoIdMatch = embedUrl.match(/\/(?:e|v|embed)\/([a-zA-Z0-9]+)/i) || embedUrl.match(/embed-([a-zA-Z0-9]+)/i);
            
            if (videoIdMatch) {
                const videoId = videoIdMatch[1];
                const payload = `op=embed&file_code=${videoId}&auto=1&referer=`;
                
                try {
                    const req = await soraFetch(`https://${hostDomain}/dl`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Referer": pDomain
                        },
                        body: payload
                    });
                    
                    if (req) {
                        const html = await req.text();
                        if (checkIfDeleted(html)) {
                            isDeleted = true;
                        } else {
                            const srcMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i) || 
                                             html.match(/src\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
                            
                            if (srcMatch && srcMatch[1]) {
                                console.log(`   ✅ [Savefiles] Flux extrait avec succès !`);
                                return { title: `${langPrefix} Savefiles`, streamUrl: srcMatch[1], headers: { "Referer": `https://${hostDomain}/` } };
                            }
                        }
                    }
                } catch(e) {}
            }
        }
        // 🌟 12. FSVID (French-Stream / Packer)
        else if (urlLower.includes("fsvid")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Fsvid en cours pour ${hostDomain}...`);
            
            const req = await soraFetch(embedUrl, { headers: { "Referer": pDomain } });
            if (req) {
                 const html = await req.text();
                 if (checkIfDeleted(html)) isDeleted = true;
                 else {
                     let streamUrl = vidhideExtractor(html);
                     
                     if (!streamUrl) {
                         const fileMatch = html.match(/sources\s*:\s*\[\s*\{\s*src\s*:\s*["']([^"']+)["']/i) || 
                                           html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
                         if (fileMatch) streamUrl = fileMatch[1];
                     }

                     if (streamUrl && streamUrl.startsWith("http")) {
                         console.log(`   ✅ [Fsvid] Flux extrait avec succès !`);
                         return { title: `${langPrefix} Fsvid`, streamUrl: streamUrl, headers: { "Referer": "https://french-stream.one/" } };
                     }
                 }
            }
        }
        // 🌟 13. LULUSTREAM / LULUVDO (Synchronisation Parfaite des Headers)
        else if (urlLower.includes("lulustream") || urlLower.includes("luluvdo")) {
            hostRecognized = true;
            console.log(`   🕵️ Extraction Lulustream en cours pour ${hostDomain}...`);
            
            // 🛡️ LE SECRET : On fige un profil de navigateur très précis
            const luluHeaders = {
                "Referer": pDomain, // Le domaine parent (ex: wiflix) pour passer le Hotlink
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            };

            // On utilise CE profil figé pour extraire la page
            const req = await soraFetch(embedUrl, { headers: luluHeaders });
            if (req) {
                 const html = await req.text();
                 if (checkIfDeleted(html)) isDeleted = true;
                 else {
                     let streamUrl = vidhideExtractor(html);
                     if (!streamUrl) {
                         const fileMatch = html.match(/sources\s*:\s*\[\s*\{\s*file\s*:\s*["']([^"']+)["']/i) || 
                                           html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || 
                                           html.match(/src\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
                         if (fileMatch) streamUrl = fileMatch[1];
                     }

                     if (streamUrl && streamUrl.startsWith("http")) {
                         console.log(`   ✅ [Lulustream] Flux extrait avec succès !`);
                         
                         // Pour la lecture vidéo, le serveur veut que le Referer devienne son propre domaine
                         luluHeaders["Referer"] = `https://${hostDomain}/`;

                         return { 
                             title: `${langPrefix} Lulustream`, 
                             streamUrl: streamUrl, 
                             headers: luluHeaders // On passe le profil figé exact au lecteur iOS !
                         };
                     }
                 }
            }
        }
        // 🌟 14. DETECTEUR UNIVERSEL
        else {
            let hostName = hostDomain.split('.')[0];
            hostName = hostName.charAt(0).toUpperCase() + hostName.slice(1);
            hostRecognized = true; 

            const req = await soraFetch(embedUrl, { headers: { "Referer": pDomain } });
            if (req) {
                const html = await req.text();
                if (checkIfDeleted(html)) isDeleted = true;
                else {
                    let streamUrl = vidhideExtractor(html);
                    
                    if (!streamUrl) {
                        const fileMatch = html.match(/sources\s*:\s*\[\s*\{\s*src\s*:\s*["']([^"']+)["']/i) || 
                                          html.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) || 
                                          html.match(/src\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
                        if (fileMatch) streamUrl = fileMatch[1];
                    }

                    if (!streamUrl) {
                        const sourceMatch = html.match(/<source[^>]+src=["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) ||
                                            html.match(/video_source\s*=\s*["']([^"']+)["']/i);
                        if (sourceMatch) streamUrl = sourceMatch[1];
                    }

                    if (streamUrl && streamUrl.startsWith("http")) {
                        console.log(`   ✅ [Universel] Flux extrait de ${hostName} !`);
                        return { title: `${langPrefix} ${hostName}`, streamUrl: streamUrl, headers: { "Referer": embedUrl } };
                    }
                }
            }
        }
    } catch (e) { 
        console.log(`   🚨 [Erreur] Crash du décodeur sur ${hostDomain} : ${e.message}`);
    }
    
    // --- GESTION INTELLIGENTE DES ÉCHECS ---
    if (!hostRecognized) {
        console.log(`   ❌ [Rejet] Serveur non pris en charge : ${hostDomain} -> ${originalUrl}`);
        return { title: `${langPrefix} Non Supporté`, originalUrl: originalUrl };
    } else if (isDeleted) {
        console.log(`   💀 [Mort] Vidéo supprimée (DMCA/404) sur : ${hostDomain} -> ${originalUrl}`);
        return { title: `${langPrefix} Vidéo Supprimée`, originalUrl: originalUrl };
    } else {
        console.log(`   ❌ [Échec] Format illisible ou protégé sur : ${hostDomain} -> ${originalUrl}`);
        return { title: `${langPrefix} Échec Extraction`, originalUrl: originalUrl };
    }
}

function voeExtractor(html) {
    try {
        const jsonScriptMatch = html.match(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!jsonScriptMatch) return null;
        
        let data = JSON.parse(jsonScriptMatch[1].trim());
        let step1 = data[0].replace(/[a-zA-Z]/g, c => String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
        let step2 = step1; 
        ["@$", "^^", "~@", "%?", "*~", "!!", "#&"].forEach(pat => step2 = step2.split(pat).join(""));
        
        const safeAtob = (b64) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            let str = String(b64).replace(/=+$/, '');
            let output = '';
            for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
                buffer = chars.indexOf(buffer);
            }
            return output;
        };
        
        let step3 = safeAtob(step2);
        let step4 = step3.split("").map((c) => String.fromCharCode(c.charCodeAt(0) - 3)).join("");
        let step5 = step4.split("").reverse().join("");
        let step6 = safeAtob(step5);
        
        let result = JSON.parse(step6);
        return result.source || (result.source && result.source.find(s => s.source)?.source) || null;
    } catch (e) { return null; }
}

function vidhideExtractor(html) {
    try {
        let directMatch = html.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
        if (directMatch) return directMatch[1];
        
        if (html.includes('eval(function(p,a,c,k,e,d)')) {
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
                        let e = function(c) { return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36)); };
                        while (c--) { if (k[c]) p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]); }
                        let unpackedMatch = p.match(/(https?:\/\/[^"'\s]+\.(?:m3u8|mp4)[^"'\s]*)/i);
                        if (unpackedMatch) return unpackedMatch[1].replace(/\\\//g, "/").trim();
                    }
                }
            }
        }
    } catch (e) { }
    return null;
}

async function doodstreamExtractor(html, url) {
    try {
        const domainMatch = url.match(/https?:\/\/(.*?)\//);
        if (!domainMatch) return null;
        const streamDomain = domainMatch[1];
        
        const md5Match = html.match(/'\/pass_md5\/(.*?)'/);
        if (!md5Match) return null;
        
        const md5Path = md5Match[1];
        const token = md5Path.substring(md5Path.lastIndexOf("/") + 1);
        const expiryTimestamp = new Date().valueOf();
        const random = randomStr(10);

        const passResponse = await soraFetch(`https://${streamDomain}/pass_md5/${md5Path}`, {
            headers: { "Referer": url }
        });
        if (!passResponse) return null;
        
        const responseData = await passResponse.text();
        if (responseData && responseData.startsWith('http')) {
            return `${responseData}${random}?token=${token}&expiry=${expiryTimestamp}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function randomStr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function filemoonExtractor(url, parentDomain) {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // Extraction de l'ID vidéo — supporte /e/, /d/, /o00iv/, /26css/ etc.
    const idMatch = url ? url.match(/\/(?:[eo]\w+|[de])\/([a-zA-Z0-9]+)/) : null;
    const videoId = idMatch ? idMatch[1] : null;

    if (!videoId) {
        console.log(`   ❌ [Filemoon] Impossible de trouver l'ID vidéo dans : ${url}`);
        return null;
    }

    const domainMatch = url.match(/https?:\/\/([^/]+)/);
    let currentHost = domainMatch ? domainMatch[1] : "filemoon.to";
    let embedUrl = url;

    const baseHeaders = {
        "User-Agent": userAgent,
        "Accept": "application/json",
        "Origin": `https://${currentHost}`,
        "Referer": `https://${currentHost}/`,
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ÉTAPE 1 : embed/details → récupère le vrai host (domain hop)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
        const detailsUrl = `https://${currentHost}/api/videos/${videoId}/embed/details`;
        console.log(`   📡 [Filemoon 1/4] embed/details : ${detailsUrl}`);

        const detailsRes = await soraFetch(detailsUrl, { headers: baseHeaders });
        if (!detailsRes) throw new Error("Pas de réponse");

        const detailsJson = JSON.parse(await detailsRes.text());
        console.log(`   📥 [Filemoon 1/4] embed_frame_url : ${detailsJson.embed_frame_url}`);

        if (detailsJson.embed_frame_url) {
            const hopMatch = detailsJson.embed_frame_url.match(/https?:\/\/([^/]+)/);
            if (hopMatch && hopMatch[1] !== currentHost) {
                console.log(`   🔄 [Filemoon 1/4] Domain hop : ${currentHost} → ${hopMatch[1]}`);
                currentHost = hopMatch[1];
                embedUrl = detailsJson.embed_frame_url;
                // Mettre à jour baseHeaders avec le nouveau host
                baseHeaders["Origin"] = `https://${currentHost}`;
                baseHeaders["Referer"] = `https://${currentHost}/`;
            }
        }
    } catch(e) {
        console.log(`   ⚠️ [Filemoon 1/4] Erreur embed/details : ${e.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ÉTAPE 2 : access/challenge → obtenir nonce + challenge_id
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let challengeId = null;
    let nonce = null;

    try {
        const challengeUrl = `https://${currentHost}/api/videos/access/challenge`;
        console.log(`   📡 [Filemoon 2/4] access/challenge : ${challengeUrl}`);

        const challengeRes = await soraFetch(challengeUrl, {
            headers: { ...baseHeaders, "Content-Type": "application/json" },
            method: "POST",
            body: JSON.stringify({ video_code: videoId })
        });

        if (!challengeRes) throw new Error("Pas de réponse");

        const challengeJson = JSON.parse(await challengeRes.text());
        console.log(`   📥 [Filemoon 2/4] challenge_id=${challengeJson.challenge_id} | nonce=${challengeJson.nonce}`);

        challengeId = challengeJson.challenge_id;
        nonce = challengeJson.nonce;
    } catch(e) {
        console.log(`   ❌ [Filemoon 2/4] Erreur access/challenge : ${e.message}`);
        return null;
    }

    if (!challengeId || !nonce) {
        console.log(`   ❌ [Filemoon 2/4] challenge_id ou nonce manquant, abandon.`);
        return null;
    }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// URL DE TON CLOUDFLARE WORKER (à modifier après déploiement)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ATTEST_SERVICE_URL = "https://filemoon-attest.kurzmathis4.workers.dev/attest";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ÉTAPE 3 : Appel au service externe pour signature ECDSA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let fingerprint = null;

try {
    console.log(`   📡 [Filemoon 3/4] Appel au service de signature : ${ATTEST_SERVICE_URL}`);

    const workerRes = await soraFetch(ATTEST_SERVICE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonce: nonce, challenge_id: challengeId })
    });

    if (!workerRes) throw new Error("Service de signature injoignable");

    const workerJson = JSON.parse(await workerRes.text());
    console.log(`   📥 [Filemoon 3/4] Worker réponse : signature=${workerJson.signature ? "OK ✅" : "❌"}`);

    if (!workerJson.signature) throw new Error("Signature absente dans la réponse du worker");

    // Construire le payload complet pour /access/attest
    const attestPayload = {
        viewer_id:    workerJson.viewer_id,
        device_id:    workerJson.device_id,
        challenge_id: challengeId,
        nonce:        nonce,
        signature:    workerJson.signature,
        public_key:   workerJson.public_key,
        client:       workerJson.client,
        storage:      {},
        attributes:   { entropy: "high" }
    };

    console.log(`   📡 [Filemoon 3/4] access/attest : https://${currentHost}/api/videos/access/attest`);

    const attestRes = await soraFetch(`https://${currentHost}/api/videos/access/attest`, {
        headers: { ...baseHeaders, "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify(attestPayload)
    });

    if (!attestRes) throw new Error("Pas de réponse du serveur attest");

    const attestRaw = await attestRes.text();
    console.log(`   📥 [Filemoon 3/4] Réponse brute : ${attestRaw}`);

    const attestJson = JSON.parse(attestRaw);
    if (!attestJson.token) throw new Error(`Attest échoué : ${attestRaw}`);

    console.log(`   ✅ [Filemoon 3/4] token=OK | confidence=${attestJson.confidence} | viewer_id=${attestJson.viewer_id}`);

    fingerprint = {
        token:      attestJson.token,
        viewer_id:  attestJson.viewer_id  || workerJson.viewer_id,
        device_id:  attestJson.device_id  || workerJson.device_id,
        confidence: attestJson.confidence || 0.6
    };

} catch(e) {
    console.log(`   ❌ [Filemoon 3/4] Erreur access/attest : ${e.message}`);
    return null;
}

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ÉTAPE 4 : embed/playback → obtenir le payload chiffré
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
        const playbackUrl = `https://${currentHost}/api/videos/${videoId}/embed/playback`;
        const playbackPayload = JSON.stringify({ fingerprint: fingerprint });

        console.log(`   📡 [Filemoon 4/4] embed/playback : ${playbackUrl}`);
        console.log(`   📤 [Filemoon 4/4] Fingerprint : token=OK | viewer_id=${fingerprint.viewer_id}`);

const playbackRes = await soraFetch(playbackUrl, {
    headers: {
        "User-Agent": userAgent,
        "Accept": "*/*",
        "Accept-Language": "fr-FR,fr;q=0.5",
        "Content-Type": "application/json",
        "Origin": `https://${currentHost}`,
        "Referer": embedUrl,   // ← https://rupertisdivingintoocean.com/xxx/qvlnya0qssc6
        "X-Embed-Parent": url, // ← https://lukefirst.lol/e/qvlnya0qssc6 (l'URL originale passée à filemoonExtractor)
        "Cookie": `byse_viewer_id=${fingerprint.viewer_id}; byse_device_id=${fingerprint.device_id}`,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Sec-GPC": "1",
        "Priority": "u=1, i"
    },
    method: "POST",
    body: playbackPayload
});

        if (!playbackRes) throw new Error("Pas de réponse");

        const responseText = await playbackRes.text();
        console.log(`   📥 [Filemoon 4/4] Réponse (${responseText.length} chars) : ${responseText.substring(0, 120)}`);

        if (!responseText.includes("playback")) {
            console.log(`   ❌ [Filemoon 4/4] Réponse inattendue, pas de clé 'playback'`);
            return null;
        }

        const json = JSON.parse(responseText);
        console.log(`   🔐 [Filemoon 4/4] Envoi au décrypteur (algo: ${json.playback?.algorithm})...`);

        const decryptor = new FileMoonDecryptor(json);
        const decrypted = await decryptor.decrypt();

        console.log(`   📄 [Filemoon 4/4] Résultat décrypté : ${JSON.stringify(decrypted)}`);

        if (decrypted && decrypted.sources && decrypted.sources.length > 0) {
            const bestSource = decrypted.sources.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
            if (bestSource && bestSource.url) {
                console.log(`   ✅ [Filemoon 4/4] URL finale : ${bestSource.url}`);
                return { url: bestSource.url, quality: bestSource.label || "HD" };
            }
        }

        console.log(`   ❌ [Filemoon 4/4] Décryptage OK mais sources vides`);
        return null;

    } catch(error) {
        console.log(`   🚨 [Filemoon 4/4] Crash : ${error.message}`);
        return null;
    }
}

class FileMoonDecryptor {
    constructor(data) { this.d = data.playback; }
    
    b64d(s) {
        const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(b64);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i);
        }
        return bytes;
    }
    
    concatBytes(...arrays) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
    
    async decrypt() {
        try {
            const phpEndpoint = 'https://api.jm26.net/decryptAESGCM/';
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
            
            if (!result.success) return null;
            return result.data;
        } catch(e) {
            return null;
        }
    }
}
