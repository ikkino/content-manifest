const SUPABASE_URL = 'https://axfutjtkvqjdhooxrwjn.supabase.co/rest/v1/anime_mapping';
const SUPABASE_KEY = 'sb_publishable_x_O6uBy2QHZTg5r8D7H3kQ_2cXuZsEe';

const GENRES = {
    'Action': 'أكشن', 'Adventure': 'مغامرة', 'Comedy': 'كوميديا', 'Drama': 'دراما',
    'Fantasy': 'فانتازيا', 'Horror': 'رعب', 'Mystery': 'غموض', 'Psychological': 'نفسي',
    'Romance': 'رومانسي', 'Sci-Fi': 'خيال علمي', 'Slice of Life': 'حياة يومية',
    'Sports': 'رياضة', 'Supernatural': 'خارق', 'Thriller': 'إثارة', 'Mecha': 'ميكا',
    'Music': 'موسيقى', 'Ecchi': 'إيتشي', 'Hentai': 'هنتاي', 'Demons': 'شياطين',
    'Game': 'ألعاب', 'Historical': 'تاريخي', 'Josei': 'جوسيي', 'Kids': 'أطفال',
    'Magic': 'سحر', 'Martial Arts': 'فنون قتالية', 'Military': 'عسكري', 'Parody': 'باروديا',
    'Police': 'شرطة', 'Samurai': 'ساموراي', 'School': 'مدرسة', 'Seinen': 'سينين',
    'Shoujo': 'شوجو', 'Shounen': 'شونين', 'Space': 'فضاء', 'Super Power': 'قوى خارقة',
    'Vampire': 'مصاصو دماء', 'Yaoi': 'يايوي', 'Yuri': 'يوري', 'Harem': 'حريم',
    'Isekai': 'إيسيكاي', 'Reincarnation': 'تقمص', 'Survival': 'نجاة'
};

const SEASONS = { WINTER: 'شتاء', SPRING: 'ربيع', SUMMER: 'صيف', FALL: 'خريف' };

const GQL = 'https://graphql.anilist.co';
const gql = async (query, variables) => {
    const r = await soraFetch(GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    return JSON.parse(await r.text());
};

async function searchResults(keyword) {
    try {
        const { data } = await gql(`
            query ($s: String) {
                Page(perPage: 20) {
                    media(search: $s, type: ANIME, sort: POPULARITY_DESC) {
                        id title { romaji english } coverImage { extraLarge }
                    }
                }
            }`, { s: keyword });
        return JSON.stringify(data.Page.media.map(a => ({
            title: a.title.english || a.title.romaji,
            image: a.coverImage.extraLarge,
            href: `https://kawaiianime.cc/anime/${a.id}`
        })));
    } catch (e) {
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const id = url.match(/\/anime\/(\d+)/)[1];
        const { data } = await gql(`
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    description(asHtml: false) genres episodes duration season seasonYear
                    studios(isMain: true) { nodes { name } }
                }
            }`, { id: parseInt(id) });
        const m = data.Media;
        const rawDesc = (m.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

        let description = rawDesc;
        try {
            const tr = await soraFetch(`https://kawaiianime.cc/api/translate-description?id=${id}&text=BlaBlaFaaah`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            console.log(tr)
            const trData = JSON.parse(await tr.text());
            if (trData?.arabic) description = trData.arabic;
        } catch (_) { }

        return JSON.stringify({
            description,
            aliases: `${m.studios.nodes[0]?.name || 'Unknown'} | ${m.genres.map(g => GENRES[g] || g).join(', ')}`,
            airdate: `${SEASONS[m.season] || ''} ${m.seasonYear || ''} | ${m.episodes || '?'} حلقة | ${m.duration || '?'} دقيقة`
        });
    } catch (e) {
        return JSON.stringify({ description: 'Error', aliases: 'Unknown', airdate: 'Unknown' });
    }
}
async function extractEpisodes(url) {
    try {
        const matchId = url.match(/\/anime\/(\d+)/);
        if (!matchId) return JSON.stringify([]);
        const id = matchId[1];

        const targetUrl = url.startsWith('http') ? url : `https://kawaii-anime.com/anime/${id}`;
        
        const res = await soraFetch(targetUrl, {
            method: 'GET',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            }
        });
        const html = await res.text();

        const match = html.match(/\\?"(?:numberOfEpisodes|episodes)\\?"\s*:\s*(\d+)/);
        const count = match ? parseInt(match[1], 10) : 0;

        return JSON.stringify(Array.from({ length: count }, (_, i) => ({
            href: `https://kawaii-anime.com/watch/${id}?num=${i + 1}`,
            number: i + 1
        })));
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const id = url.match(/\/watch\/(\d+)/)[1];
        const ep = url.match(/num=(\d+)/)[1];
        const { data } = JSON.parse(await (await soraFetch(
            `https://kawaiianime.cc/api/miruro?anilistId=${id}&ep=${ep}&category=sub`,
            { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }
        )).text());
        return JSON.stringify({
            streams: data.sources.map(s => ({ title: s.quality, streamUrl: s.url, headers: data.headers || {} })),
            subtitle: data.subtitles?.find(s => s.lang === 'Arabic')?.url || data.subtitles?.[0]?.url || ''
        });
    } catch (e) {
        return JSON.stringify({ streams: [] });
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try { return await fetch(url, options); } catch (_) { return null; }
    }
}
