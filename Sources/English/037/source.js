// ==========================================
// ⚙️ MODULE SORA — AETHER (aether.bar)
// Recherche TMDB (réponses en anglais) + 5 providers de stream + multi sous-titres
// ==========================================

const TMDB_API_KEY = "f3d757824f08ea2cff45eb8f47ca3a1e";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_LANG = "en-US"; // Réponses en anglais comme demandé

const SITE_URL = "https://aether.bar";

// Liste des providers de stream Aether.
// field   = la clé qui contient l'URL du flux dans la réponse JSON.
// tvSeg   = le segment utilisé pour les séries (Meridian utilise "show" au lieu de "tv").
const PROVIDERS = [
    { name: "Link",     base: "https://link.aether.cx",     field: "stream",     tvSeg: "tv" },
    { name: "Vidy",     base: "https://vidy.aether.cx",     field: "stream",     tvSeg: "tv" },
    { name: "Nebula",   base: "https://nebula.aether.cx",   field: "stream_url", tvSeg: "tv" },
    { name: "Meridian", base: "https://meridian.aether.bar", field: "url",       tvSeg: "show" },
    { name: "Tiki",     base: "https://tiki.aether.cx",     field: "stream",     tvSeg: "tv" }
];

// Source "scrape" multi-serveurs (renvoie plusieurs flux + captions)
const FAST_URL = "https://fast.aether.cx";
// Source de sous-titres dédiée (gros catalogue de langues)
const VDRK_SUB_URL = "https://sub.vdrk.site/v1";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "Referer": `${SITE_URL}/`,
    "Origin": SITE_URL
};

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
        if (typeof fetchv2 !== 'undefined') await fetchv2(`${SUPABASE_URL}/rest/v1/app_logs`, headers, "POST", JSON.stringify(payload));
        else await fetch(`${SUPABASE_URL}/rest/v1/app_logs`, { method: "POST", headers: headers, body: JSON.stringify(payload) });
    } catch (e) { console.log(`[Aether][Tracker] 🚨 Échec envoi log : ${e}`); }
}

// ==========================================
// ⚙️ 1. RECHERCHE (TMDB multi)
// ==========================================

async function searchResults(keyword) {
    console.log(`[Aether][Search] 🔎 Recherche pour : "${keyword}"`);
    try {
        const encoded = encodeURIComponent(keyword);
        const url = `${TMDB_BASE}/search/multi?query=${encoded}&include_adult=false&page=1&language=${TMDB_LANG}&api_key=${TMDB_API_KEY}`;
        console.log(`[Aether][Search] 🌐 URL TMDB : ${url}`);

        const response = await soraFetch(url);
        const data = await response.json();

        const items = Array.isArray(data.results) ? data.results : [];
        console.log(`[Aether][Search] 📦 ${items.length} résultats bruts reçus de TMDB`);

        const results = items
            .filter(r => r.media_type === "movie" || r.media_type === "tv")
            .map(r => {
                const type = r.media_type; // "movie" ou "tv"
                const title = r.title || r.name || r.original_title || r.original_name;
                const id = r.id;
                if (!title || !id) return null;

                const image = r.poster_path
                    ? `https://image.tmdb.org/t/p/w500${r.poster_path}`
                    : "https://via.placeholder.com/500x750?text=No+Image";

                return { title, image, href: `aether://${type}/${id}` };
            })
            .filter(Boolean);

        console.log(`[Aether][Search] ✅ ${results.length} résultats film/série retenus`);
        results.forEach(r => console.log(`   -> ${r.title}  (${r.href})`));

        sendSupabaseLog("Aether", "SEARCH", { keyword, results_count: results.length });
        return JSON.stringify(results);
    } catch (error) {
        console.log(`[Aether][Search] 🚨 Erreur : ${error}`);
        return JSON.stringify([]);
    }
}

// ==========================================
// ⚙️ 2. DÉTAILS (TMDB)
// ==========================================

async function extractDetails(url) {
    console.log(`[Aether][Details] 📄 Chargement des détails pour : ${url}`);
    try {
        const { type, id } = parseHref(url);
        const endpoint = type === "movie" ? "movie" : "tv";
        const apiUrl = `${TMDB_BASE}/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`;
        console.log(`[Aether][Details] 🌐 type=${type} id=${id} -> ${apiUrl}`);

        const response = await soraFetch(apiUrl);
        const data = await response.json();

        const description = data.overview || "No description available.";

        let duration = "Unknown";
        if (data.runtime) duration = `${data.runtime} min`;
        else if (Array.isArray(data.episode_run_time) && data.episode_run_time.length) duration = `${data.episode_run_time[0]} min`;
        else if (data.number_of_seasons) duration = `${data.number_of_seasons} season(s)`;

        const releaseDate = data.release_date || data.first_air_date || "Unknown";
        console.log(`[Aether][Details] ✅ "${data.title || data.name}" | durée=${duration} | sortie=${releaseDate}`);

        return JSON.stringify([{
            description,
            aliases: `Duration: ${duration}`,
            airdate: `Released: ${releaseDate}`
        }]);
    } catch (error) {
        console.log(`[Aether][Details] 🚨 Erreur : ${error}`);
        return JSON.stringify([{ description: "Error loading details", aliases: "", airdate: "" }]);
    }
}

// ==========================================
// ⚙️ 3. ÉPISODES
// ==========================================

async function extractEpisodes(url) {
    console.log(`[Aether][Episodes] 🎬 Extraction des épisodes pour : ${url}`);
    try {
        const { type, id } = parseHref(url);

        if (type === "movie") {
            console.log(`[Aether][Episodes] 🎞️ Film détecté -> 1 entrée "Full Movie"`);
            return JSON.stringify([{ href: `aether-play://movie/${id}`, number: 1, title: "Full Movie" }]);
        }

        // Série : on récupère les saisons via TMDB
        console.log(`[Aether][Episodes] 📺 Série id=${id}, récupération des saisons...`);
        const showResp = await soraFetch(`${TMDB_BASE}/tv/${id}?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`);
        const show = await showResp.json();

        let allEpisodes = [];
        if (Array.isArray(show.seasons)) {
            console.log(`[Aether][Episodes] 📚 ${show.seasons.length} saison(s) trouvée(s)`);
            for (const season of show.seasons) {
                const sNum = season.season_number;
                if (sNum === 0) { console.log(`[Aether][Episodes] ⏭️ Saison 0 (Specials) ignorée`); continue; }

                const seasonResp = await soraFetch(`${TMDB_BASE}/tv/${id}/season/${sNum}?api_key=${TMDB_API_KEY}&language=${TMDB_LANG}`);
                const seasonData = await seasonResp.json();

                if (Array.isArray(seasonData.episodes)) {
                    console.log(`[Aether][Episodes]   -> Saison ${sNum} : ${seasonData.episodes.length} épisode(s)`);
                    for (const ep of seasonData.episodes) {
                        allEpisodes.push({
                            href: `aether-play://tv/${id}/${sNum}/${ep.episode_number}`,
                            number: ep.episode_number,
                            season: sNum,
                            title: ep.name || `Episode ${ep.episode_number}`
                        });
                    }
                }
            }
        }
        console.log(`[Aether][Episodes] ✅ Total : ${allEpisodes.length} épisode(s)`);
        return JSON.stringify(allEpisodes);
    } catch (error) {
        console.log(`[Aether][Episodes] 🚨 Erreur : ${error}`);
        return JSON.stringify([]);
    }
}

// ==========================================
// ⚙️ 4. EXTRACTION VIDÉO (5 providers en parallèle) + SOUS-TITRES MULTIPLES
// ==========================================

async function extractStreamUrl(url) {
    const startTime = Date.now();
    console.log(`[Aether][Player] ============================================`);
    console.log(`[Aether][Player] ▶️ Extraction démarrée pour : ${url}`);
    try {
        const { type, id, season, episode } = parsePlayHref(url);
        console.log(`[Aether][Player] 🧩 type=${type} id=${id} saison=${season} épisode=${episode}`);

        let streams = [];
        let allSubtitles = [];       // toutes les pistes de sous-titres (multi)
        let bestSubtitle = "";       // meilleure piste (anglais en priorité), pour compat
        let gotEnglishSub = false;
        const seenStreams = new Set();
        const seenSubs = new Set();

        // --- Helpers locaux ---
        function addStream(title, streamUrl, headers) {
            if (!streamUrl || typeof streamUrl !== "string" || !streamUrl.startsWith("http")) return false;
            if (seenStreams.has(streamUrl)) { console.log(`[Aether][Player] ♻️ [${title}] flux en double, ignoré`); return false; }
            seenStreams.add(streamUrl);
            streams.push({ title, streamUrl, headers: headers || { "Referer": `${SITE_URL}/`, "Origin": SITE_URL } });
            console.log(`[Aether][Player] ✅ [${title}] flux ajouté : ${streamUrl.slice(0, 70)}...`);
            return true;
        }

        function addSubtitle(rawUrl, label, kind, headers) {
            if (!rawUrl || seenSubs.has(rawUrl)) return;
            seenSubs.add(rawUrl);
            const cleanLabel = label || "Unknown";
            const lang = String(cleanLabel).trim().toLowerCase();
            allSubtitles.push({
                url: rawUrl,
                label: cleanLabel,
                kind: kind || "captions",
                headers: headers || { "Referer": `${SITE_URL}/` }
            });
            const isEnglish = lang === "english" || lang === "en" || lang === "eng" || lang === "en-us";
            if (isEnglish && !gotEnglishSub) {
                bestSubtitle = rawUrl;
                gotEnglishSub = true;
                console.log(`[Aether][Player] ⭐ Sous-titre anglais sélectionné par défaut`);
            } else if (bestSubtitle === "") {
                bestSubtitle = rawUrl; // secours
            }
        }

        // === On lance TOUTES les sources en parallèle ===
        const fetchJson = async (label, fullUrl, headers) => {
            console.log(`[Aether][Player] 🌐 [${label}] GET ${fullUrl}`);
            try {
                const resp = await soraFetch(fullUrl, { headers: headers || DEFAULT_HEADERS });
                if (!resp) { console.log(`[Aether][Player] ⚠️ [${label}] réponse nulle`); return null; }
                const text = await resp.text();
                try { return JSON.parse(text); }
                catch (e) { console.log(`[Aether][Player] ❌ [${label}] réponse non-JSON (${text.slice(0, 60)}...)`); return null; }
            } catch (e) { console.log(`[Aether][Player] 🚨 [${label}] erreur réseau : ${e}`); return null; }
        };

        // 1) Les 5 providers simples + 2) fast.aether (scrape) + 3) sub.vdrk (sous-titres)
        const fastPath = type === "movie"
            ? `/scrape?type=movie&tmdbId=${id}`
            : `/scrape?type=show&tmdbId=${id}&season=${season}&episode=${episode}`;
        const vdrkPath = type === "movie"
            ? `/movie/${id}`
            : `/tv/${id}/${season}/${episode}`;

        const tasks = [
            ...PROVIDERS.map(p => {
                const path = type === "movie" ? `/movie/${id}` : `/${p.tvSeg}/${id}/${season}/${episode}`;
                return fetchJson(p.name, `${p.base}${path}`).then(json => ({ kind: "simple", provider: p, json }));
            }),
            fetchJson("Fast", `${FAST_URL}${fastPath}`).then(json => ({ kind: "fast", json })),
            fetchJson("VdrkSubs", `${VDRK_SUB_URL}${vdrkPath}`).then(json => ({ kind: "vdrk", json }))
        ];
        const results = await Promise.all(tasks);

        for (const result of results) {
            if (!result || !result.json) continue;
            const { kind, json } = result;

            // --- Providers simples (1 flux + éventuellement subtitles[]) ---
            if (kind === "simple") {
                const provider = result.provider;
                if (!addStream(provider.name, json[provider.field])) {
                    if (!json[provider.field]) console.log(`[Aether][Player] ℹ️ [${provider.name}] aucun flux (champ "${provider.field}" absent)`);
                }
                if (Array.isArray(json.subtitles) && json.subtitles.length > 0) {
                    console.log(`[Aether][Player] 💬 [${provider.name}] ${json.subtitles.length} piste(s) de sous-titres`);
                    for (const sub of json.subtitles) {
                        addSubtitle(sub && (sub.url || sub.file), sub.language || sub.lang || sub.label, sub.kind);
                    }
                }
            }

            // --- fast.aether : plusieurs flux nommés, chacun avec headers + captions ---
            else if (kind === "fast") {
                const fastStreams = Array.isArray(json.streams) ? json.streams : [];
                console.log(`[Aether][Player] ⚡ [Fast] ${fastStreams.length} serveur(s)`);
                for (const s of fastStreams) {
                    if (!s || !s.url) continue;
                    addStream(`Fast - ${s.name || "Server"}`, s.url, s.headers || undefined);
                    if (Array.isArray(s.captions)) {
                        for (const cap of s.captions) {
                            addSubtitle(cap && cap.url, cap.language || cap.label, cap.type === "srt" ? "captions" : (cap.type || "captions"));
                        }
                    }
                }
            }

            // --- sub.vdrk : source dédiée de sous-titres [{label, file}] ---
            else if (kind === "vdrk") {
                const list = Array.isArray(json) ? json : [];
                console.log(`[Aether][Player] 💬 [VdrkSubs] ${list.length} piste(s) de sous-titres`);
                for (const sub of list) {
                    addSubtitle(sub && (sub.file || sub.url), sub.label || sub.language, "captions",
                        { "Referer": "https://vdrk.site/" });
                }
            }
        }

        // On place l'anglais en tête de la liste multi (pratique pour l'app)
        allSubtitles.sort((a, b) => {
            const ae = String(a.label).toLowerCase() === "english" ? 0 : 1;
            const be = String(b.label).toLowerCase() === "english" ? 0 : 1;
            return ae - be;
        });

        console.log(`[Aether][Player] --------------------------------------------`);
        console.log(`[Aether][Player] 📊 Bilan : ${streams.length} flux | ${allSubtitles.length} sous-titres | anglais=${gotEnglishSub} | ${Date.now() - startTime}ms`);
        streams.forEach(s => console.log(`   🎥 ${s.title}`));
        allSubtitles.forEach(s => console.log(`   💬 ${s.label}`));

        sendSupabaseLog("Aether", "PLAYER", {
            media_path: type === "movie" ? `/movie/${id}` : `/tv/${id}/${season}/${episode}`,
            type: type.toUpperCase(),
            season: type === "movie" ? "N/A" : season,
            episode: type === "movie" ? "N/A" : episode,
            streams_found: streams.length,
            subtitles_found: allSubtitles.length,
            execution_time_ms: Date.now() - startTime,
            servers: streams.map(s => ({ nom: s.title, lien: s.streamUrl }))
        });

        if (streams.length > 0) {
            // subtitles  = string (meilleure piste, compat anciens lecteurs)
            // allSubtitles = tableau complet de toutes les langues (multi-pistes)
            return JSON.stringify({ streams, subtitles: bestSubtitle, allSubtitles });
        }
        console.log(`[Aether][Player] ❌ Aucun flux trouvé`);
        return JSON.stringify({ streams: [], subtitles: "", allSubtitles: [] });
    } catch (error) {
        console.log(`[Aether][Player] 🚨 Erreur critique : ${error}`);
        return JSON.stringify({ streams: [], subtitles: "", allSubtitles: [] });
    }
}

// ==========================================
// 🔧 UTILS
// ==========================================

// aether://{type}/{id}
function parseHref(url) {
    const parts = url.replace("aether://", "").split("/");
    return { type: parts[0], id: parts[1] };
}

// aether-play://movie/{id}  |  aether-play://tv/{id}/{season}/{episode}
function parsePlayHref(url) {
    const parts = url.replace("aether-play://", "").split("/");
    return {
        type: parts[0],
        id: parts[1],
        season: parts[2] || "1",
        episode: parts[3] || "1"
    };
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null, encoding: 'utf-8' }) {
    try {
        if (typeof fetchv2 !== 'undefined') {
            return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null, true, options.encoding ?? 'utf-8');
        } else {
            return await fetch(url, options);
        }
    } catch (e) {
        try { return await fetch(url, options); } catch (error) { return null; }
    }
}
