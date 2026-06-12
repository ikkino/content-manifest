const API_BASE = "https://api.yani.tv";
const IMAGE_REFERER = "https://site.yummyani.me/";
const PASSTHROUGH = "https://passthrough-worker.simplepostrequest.workers.dev/?simple=";
const DEFAULT_SUBTITLE = "https://none.com";

function _ua() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
}

function _absUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("//")) return "https:" + s;
  return s;
}

function _wrapImage(url) {
  const abs = _absUrl(url);
  if (!abs) return "";

  return (
    PASSTHROUGH +
    encodeURIComponent(abs) +
    "&referer=" +
    encodeURIComponent(IMAGE_REFERER)
  );
}

function _safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
}

function scoreTitle(title, keyword) {
  const t = String(title || "").toLowerCase().trim();
  const k = String(keyword || "").toLowerCase().trim();

  if (!t || !k) return 99;
  if (t === k) return 0;
  if (t.startsWith(k)) return 1;
  if (t.includes(k)) return 2;

  return 3;
}

function _pack(obj) {
  return "yummy:" + encodeURIComponent(JSON.stringify(obj || {}));
}

function _unpack(href) {
  const s = String(href || "");
  if (!s.startsWith("yummy:")) return null;

  return _safeJsonParse(
    decodeURIComponent(s.slice("yummy:".length)),
    null
  );
}

function _playerType(opt) {
  const iframe = String(opt?.iframe_url || "").toLowerCase();
  const player = String(opt?.player || "").toLowerCase();

  if (iframe.includes("aksor") || player.includes("aksor")) {
    return "aksor";
  }

  if (
    iframe.includes("iframecvh") ||
    iframe.includes("cvh") ||
    player.includes("cvh")
  ) {
    return "cvh";
  }

  if (
    iframe.includes("kodik.info") ||
    iframe.includes("kodikplayer.com") ||
    player.includes("kodik")
  ) {
    return "kodik";
  }

  return "other";
}

function _playerRank(opt) {
  const type = _playerType(opt);

  if (type === "aksor") return 0;
  if (type === "cvh") return 1;
  if (type === "kodik") return 2;

  return 999;
}

function _sortOptionsByPlayer(a, b) {
  return _playerRank(a) - _playerRank(b);
}

function _cleanStreamUrl(url) {
  const s = String(url || "").trim();
  return s || null;
}

function _bestQualityUrl(q) {
  return (
    q.url4k ||
    q.url2k ||
    q.url1080 ||
    q.url720 ||
    q.url480 ||
    q.url360 ||
    q.url240 ||
    q.url144 ||
    q.hlsUrl ||
    null
  );
}

function _hasAnyQuality(q) {
  return Boolean(
    q.url4k ||
    q.url2k ||
    q.url1080 ||
    q.url720 ||
    q.url480 ||
    q.url360 ||
    q.url240 ||
    q.url144 ||
    q.hlsUrl
  );
}

async function _apiGet(url) {
  const headers = {
    "User-Agent": _ua(),
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Referer": IMAGE_REFERER,
    "Origin": IMAGE_REFERER
  };

  return fetchv2(url, headers);
}

async function searchResults(keyword) {
  const results = [];

  try {
    const url = `${API_BASE}/search?limit=30&offset=0&q=${encodeURIComponent(keyword)}`;
    const res = await _apiGet(url);
    const json = await res.json();

    const arr = Array.isArray(json?.response) ? json.response : [];

    for (const item of arr) {
      const title = item?.title || "Unknown";

      const poster =
        item?.poster?.fullsize ||
        item?.poster?.mega ||
        item?.poster?.huge ||
        item?.poster?.big ||
        item?.poster?.medium ||
        item?.poster?.small ||
        "";

      const href =
        item?.anime_id != null
          ? String(item.anime_id)
          : item?.anime_url || "";

      results.push({
        title,
        image: _wrapImage(poster),
        href,
        _score: scoreTitle(title, keyword)
      });
    }

    results.sort((a, b) => a._score - b._score);

    return JSON.stringify(
      results.map(({ _score, ...rest }) => rest)
    );
  } catch (err) {
    return JSON.stringify([
      {
        title: err?.message || "Error",
        image: "Error",
        href: "Error"
      }
    ]);
  }
}

async function extractDetails(animeIdOrUrl) {
  try {
    const url = `${API_BASE}/anime/${encodeURIComponent(String(animeIdOrUrl))}?need_videos=false`;
    const res = await _apiGet(url);
    const json = await res.json();
    const data = json?.response || {};

    const other = Array.isArray(data?.other_titles) ? data.other_titles : [];

    return JSON.stringify([
      {
        description: data?.description || "No description available",
        airdate: data?.year != null ? String(data.year) : "Unknown",
        aliases: other.length ? other.join(", ") : ""
      }
    ]);
  } catch (_) {
    return JSON.stringify([
      {
        description: "Error",
        airdate: "Error",
        aliases: ""
      }
    ]);
  }
}

async function extractEpisodes(animeIdOrUrl) {
  try {
    const raw = String(animeIdOrUrl || "").trim();
    let animeId = null;

    if (/^\d+$/.test(raw)) {
      animeId = raw;
    } else {
      const infoUrl = `${API_BASE}/anime/${encodeURIComponent(raw)}?need_videos=false`;
      const infoRes = await _apiGet(infoUrl);
      const infoJson = await infoRes.json();
      const info = infoJson?.response || {};
      animeId = info?.anime_id != null ? String(info.anime_id) : null;
    }

    if (!animeId) return JSON.stringify([]);

    const url = `${API_BASE}/anime/${encodeURIComponent(animeId)}/videos`;
    const res = await _apiGet(url);
    const json = await res.json();

    const vids = Array.isArray(json?.response) ? json.response : [];

    const supportedVids = vids.filter(v => {
      const iframe = String(v?.iframe_url || "").toLowerCase();
      const player = String(v?.data?.player || "").toLowerCase();

      return (
        iframe.includes("aksor") ||
        player.includes("aksor") ||
        iframe.includes("iframecvh") ||
        iframe.includes("cvh") ||
        player.includes("cvh") ||
        iframe.includes("kodik.info") ||
        iframe.includes("kodikplayer.com") ||
        player.includes("kodik")
      );
    });

    const byNum = new Map();

    for (const v of supportedVids) {
      const num = parseFloat(v?.number) || 0;
      if (!num) continue;

      const iframeUrl = _absUrl(v?.iframe_url || "");
      if (!iframeUrl) continue;

      const dubbing =
        String(v?.data?.dubbing || "").trim() || "Unknown voiceover";

      const player =
        String(v?.data?.player || "").trim() ||
        (
          iframeUrl.toLowerCase().includes("aksor")
            ? "Aksor"
            : iframeUrl.toLowerCase().includes("cvh")
              ? "CVH"
              : "Kodik"
        );

      const opening =
        v?.skips?.opening &&
        Number.isFinite(v.skips.opening.time) &&
        Number.isFinite(v.skips.opening.length)
          ? {
              start: v.skips.opening.time,
              stop: v.skips.opening.time + v.skips.opening.length
            }
          : undefined;

      const ending =
        v?.skips?.ending &&
        Number.isFinite(v.skips.ending.time) &&
        Number.isFinite(v.skips.ending.length)
          ? {
              start: v.skips.ending.time,
              stop: v.skips.ending.time + v.skips.ending.length
            }
          : undefined;

      const skips =
        (
          v?.skips?.opening &&
          Number.isFinite(v.skips.opening.time) &&
          Number.isFinite(v.skips.opening.length)
        ) ||
        (
          v?.skips?.ending &&
          Number.isFinite(v.skips.ending.time) &&
          Number.isFinite(v.skips.ending.length)
        )
          ? {
              opening:
                v?.skips?.opening &&
                Number.isFinite(v.skips.opening.time) &&
                Number.isFinite(v.skips.opening.length)
                  ? {
                      time: v.skips.opening.time,
                      length: v.skips.opening.length
                    }
                  : null,
              ending:
                v?.skips?.ending &&
                Number.isFinite(v.skips.ending.time) &&
                Number.isFinite(v.skips.ending.length)
                  ? {
                      time: v.skips.ending.time,
                      length: v.skips.ending.length
                    }
                  : null
            }
          : undefined;

      const duration =
        Number.isFinite(v?.duration) && v.duration > 0
          ? v.duration
          : undefined;

      if (!byNum.has(num)) {
        byNum.set(num, {
          num,
          options: [],
          opening,
          ending,
          duration,
          skips
        });
      }

      const ep = byNum.get(num);

      if (!ep.opening && opening) ep.opening = opening;
      if (!ep.ending && ending) ep.ending = ending;
      if (!ep.duration && duration) ep.duration = duration;
      if (!ep.skips && skips) ep.skips = skips;

      ep.options.push({
        dubbing,
        player,
        iframe_url: iframeUrl,
        opening,
        ending
      });
    }

    const out = Array.from(byNum.values())
      .sort((a, b) => a.num - b.num)
      .map(ep => {
        ep.options.sort(_sortOptionsByPlayer);

        const payload = {
          animeId,
          number: ep.num,
          options: ep.options
        };

        const item = {
          href: _pack(payload),
          number: ep.num,
          title: `Episode ${ep.num}`
        };

        const primary = ep.options[0];

        if (primary?.opening) item.opening = primary.opening;
        if (primary?.ending) item.ending = primary.ending;

        if (ep.skips) item.skips = ep.skips;
        if (ep.duration) item.duration = ep.duration;

        return item;
      });

    return JSON.stringify(out);
  } catch (err) {
    console.log("extractEpisodes error:", err?.message || err);
    return JSON.stringify([]);
  }
}

async function extractStreamUrl(href) {
  try {
    const payload = _unpack(href);
    const options = Array.isArray(payload?.options) ? payload.options : [];

    if (!options.length) {
      return JSON.stringify({
        streams: [],
        subtitle: DEFAULT_SUBTITLE
      });
    }

    options.sort(_sortOptionsByPlayer);

    const streams = [];

    for (const opt of options) {
      const iframeUrl = _absUrl(opt?.iframe_url);
      if (!iframeUrl) continue;

      const type = _playerType(opt);

      if (type === "aksor") {
        const parsed = await _parseAksor(opt, iframeUrl);
        if (parsed) streams.push(parsed);
        continue;
      }

      if (type === "cvh") {
        const parsed = await _parseCvh(opt, iframeUrl);
        if (parsed) streams.push(parsed);
        continue;
      }

      if (type === "kodik") {
        const parsed = await _parseKodik(opt, iframeUrl);
        if (parsed) streams.push(parsed);
        continue;
      }
    }

    return JSON.stringify({
      streams,
      subtitle: DEFAULT_SUBTITLE
    });
  } catch (err) {
    console.log("extractStreamUrl error:", err?.message || err);

    return JSON.stringify({
      streams: [],
      subtitle: DEFAULT_SUBTITLE
    });
  }
}

async function _parseAksor(opt, iframeUrl) {
  try {
    const match = iframeUrl.match(/\/video\/([^/?#]+)/);
    const id = match ? match[1] : null;

    if (!id) return null;

    const apiResponse = await fetchv2(`https://player.aksor.tv/api/video/${id}`, {
      "Accept": "application/json",
      "Referer": iframeUrl,
      "User-Agent": _ua()
    });

    const apiJson = await apiResponse.json();
    const q = apiJson?.qualities || {};

    const quality = {
      url4k: _cleanStreamUrl(q.q4k),
      url2k: _cleanStreamUrl(q.q2k),
      url1080: _cleanStreamUrl(q.q1080),
      url720: _cleanStreamUrl(q.q720),
      url480: _cleanStreamUrl(q.q480),
      url360: _cleanStreamUrl(q.q360),
      url240: null,
      url144: null,
      hlsUrl: null
    };

    const best = _bestQualityUrl(quality);

    if (!best || !_hasAnyQuality(quality)) return null;

    return {
      title: `${opt.dubbing || "Unknown voiceover"} (Aksor)`,
      streamUrl: best,

      url4k: quality.url4k,
      url2k: quality.url2k,
      url1080: quality.url1080,
      url720: quality.url720,
      url480: quality.url480,
      url360: quality.url360,
      url240: quality.url240,
      url144: quality.url144,

      headers: {
        "User-Agent": _ua(),
        "Referer": "https://player.aksor.tv/"
      }
    };
  } catch (err) {
    console.log("Aksor parse error:", err?.message || err);
    return null;
  }
}

async function _parseCvh(opt, iframeUrl) {
  try {
    const getQueryParam = (u, name) => {
      const regex = new RegExp("[?&]" + name + "=([^&#]*)");
      const m = regex.exec(u);
      return m ? decodeURIComponent(m[1]) : null;
    };

    const dubbingCode = getQueryParam(iframeUrl, "dubbing_code");
    const animeId = getQueryParam(iframeUrl, "anime_id");
    const episode = getQueryParam(iframeUrl, "episode");

    if (!animeId || !episode) return null;

    const playlistUrl =
      `https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=745&id=${animeId}&aggr=mali`;

    const playlistRes = await fetchv2(playlistUrl, {
      "User-Agent": _ua(),
      "Referer": "https://ru.yummyani.me/"
    });

    const playlistData = await playlistRes.json();
    const items = Array.isArray(playlistData?.items) ? playlistData.items : [];

    const targetEpisode = parseInt(episode, 10);

    const match =
      items.find(item => {
        const itemEp = parseInt(item?.episode, 10);
        const itemVoice = String(item?.voiceStudio || "").toLowerCase();
        const targetVoice = String(dubbingCode || "").toLowerCase();

        return itemEp === targetEpisode && itemVoice === targetVoice;
      }) ||
      items.find(item => {
        return parseInt(item?.episode, 10) === targetEpisode;
      });

    if (!match?.vkId) return null;

    const videoUrl =
      `https://plapi.cdnvideohub.com/api/v1/player/sv/video/${match.vkId}`;

    const videoRes = await fetchv2(videoUrl, {
      "User-Agent": _ua(),
      "Referer": "https://ru.yummyani.me/"
    });

    const videoData = await videoRes.json();
    const src = videoData?.sources || {};

    const quality = {
      url4k: _cleanStreamUrl(src.mpeg4kUrl),
      url2k: _cleanStreamUrl(src.mpeg2kUrl || src.mpegQhdUrl),
      url1080: _cleanStreamUrl(src.mpegFullHdUrl),
      url720: _cleanStreamUrl(src.mpegHighUrl),
      url480: _cleanStreamUrl(src.mpegMediumUrl),
      url360: _cleanStreamUrl(src.mpegLowUrl),
      url240: _cleanStreamUrl(src.mpegLowestUrl),
      url144: _cleanStreamUrl(src.mpegTinyUrl),
      hlsUrl: _cleanStreamUrl(src.hlsUrl)
    };

    const best = _bestQualityUrl(quality);

    if (!best || !_hasAnyQuality(quality)) return null;

    return {
      title: `${opt.dubbing || "Unknown voiceover"} (CVH)`,
      streamUrl: best,

      url4k: quality.url4k,
      url2k: quality.url2k,
      url1080: quality.url1080,
      url720: quality.url720,
      url480: quality.url480,
      url360: quality.url360,
      url240: quality.url240,
      url144: quality.url144,

      headers: {
        "User-Agent": _ua(),
        "Referer": "https://ru.yummyani.me/"
      }
    };
  } catch (err) {
    console.log("CVH parse error:", err?.message || err);
    return null;
  }
}

async function _parseKodik(opt, iframeUrl) {
  try {
    const qualitiesJson = await kodikParser(iframeUrl);
    const qualities = _safeJsonParse(qualitiesJson, {});

    const quality = {
      url4k: null,
      url2k: null,
      url1080: null,
      url720: null,
      url480: null,
      url360: null,
      url240: null,
      url144: null,
      hlsUrl: null
    };

    for (const q in qualities) {
      const srcRaw = qualities?.[q]?.src;

      const src = srcRaw
        ? (
            String(srcRaw).startsWith("//")
              ? "https:" + String(srcRaw)
              : String(srcRaw)
          )
        : "";

      if (!src) continue;

      const n = parseInt(String(q).replace(/[^\d]/g, ""), 10) || 0;

      if (n >= 2160 && !quality.url4k) quality.url4k = src;
      else if (n >= 1440 && !quality.url2k) quality.url2k = src;
      else if (n >= 1080 && !quality.url1080) quality.url1080 = src;
      else if (n >= 720 && !quality.url720) quality.url720 = src;
      else if (n >= 480 && !quality.url480) quality.url480 = src;
      else if (n >= 360 && !quality.url360) quality.url360 = src;
      else if (n >= 240 && !quality.url240) quality.url240 = src;
      else if (n >= 144 && !quality.url144) quality.url144 = src;
    }

    const best = _bestQualityUrl(quality);

    if (!best || !_hasAnyQuality(quality)) return null;

    return {
      title: `${opt.dubbing || "Unknown voiceover"} (Kodik)`,
      streamUrl: best,

      url4k: quality.url4k,
      url2k: quality.url2k,
      url1080: quality.url1080,
      url720: quality.url720,
      url480: quality.url480,
      url360: quality.url360,
      url240: quality.url240,
      url144: quality.url144,

      headers: {
        "User-Agent": _ua(),
        "Referer": "https://kodik.info/"
      }
    };
  } catch (err) {
    console.log("Kodik parse error:", err?.message || err);
    return null;
  }
}

async function kodikParser(url) {
  try {
    const headers = {
      "Referer": IMAGE_REFERER,
      "User-Agent": _ua()
    };

    const response = await fetchv2(url, headers);
    const htmlText = await response.text();

    if (
      htmlText.includes("Видео запрещено к просмотру в данной стране") ||
      htmlText.includes("Error code: n")
    ) {
      return JSON.stringify({});
    }

    const urlParamsMatch = htmlText.match(/var\s+urlParams\s*=\s*'([^']+)'/);
    const videoInfoTypeMatch = htmlText.match(/vInfo\.type\s*=\s*'([^']+)'/);
    const videoInfoHashMatch = htmlText.match(/vInfo\.hash\s*=\s*'([^']+)'/);
    const videoInfoIdMatch = htmlText.match(/vInfo\.id\s*=\s*'([^']+)'/);

    if (!urlParamsMatch || !videoInfoHashMatch) {
      return JSON.stringify({});
    }

    const urlParams =
      urlParamsMatch
        ? _safeJsonParse(urlParamsMatch[1], {})
        : {};

    const videoInfo_type =
      videoInfoTypeMatch ? videoInfoTypeMatch[1] : "";

    const videoInfo_hash =
      videoInfoHashMatch ? videoInfoHashMatch[1] : "";

    const videoInfo_id =
      videoInfoIdMatch ? videoInfoIdMatch[1] : "";

    const finalData =
      `d=${urlParams.d || ""}` +
      `&d_sign=${urlParams.d_sign || ""}` +
      `&pd=${urlParams.pd || ""}` +
      `&pd_sign=${urlParams.pd_sign || ""}` +
      `&ref=${urlParams.ref || ""}` +
      `&ref_sign=${urlParams.ref_sign || ""}` +
      `&bad_user=false&cdn_is_working=true` +
      `&type=${videoInfo_type}` +
      `&hash=${videoInfo_hash}` +
      `&id=${videoInfo_id}` +
      `&info=%7B%7D`;

    const headers2 = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Referer": IMAGE_REFERER,
      "User-Agent": _ua(),
      "X-Requested-With": "XMLHttpRequest"
    };

    const apiResponse = await fetchv2(
      "https://kodikplayer.com/ftor",
      headers2,
      "POST",
      finalData
    );

    const apiJson = await apiResponse.json();

    const qualities = {};

    if (apiJson?.links) {
      for (const quality in apiJson.links) {
        const qArr = apiJson.links[quality];
        const first = Array.isArray(qArr) ? qArr[0] : null;

        if (!first?.src) continue;

        qualities[quality] = {
          src: decode(first.src),
          type: first.type || "application/x-mpegURL"
        };
      }
    }

    return JSON.stringify(qualities, null, 2);
  } catch (err) {
    console.log("kodikParser error:", err?.message || err);
    return JSON.stringify({});
  }
}

function decode(input) {
  const map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let b = 0;
  let c = 0;

  const r = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (/[a-zA-Z]/.test(ch)) {
      const cc = ch.charCodeAt(0);
      const max = ch <= "Z" ? 90 : 122;
      const sh = cc + 18;

      r.push(String.fromCharCode(sh <= max ? sh : sh - 26));
    } else {
      r.push(ch);
    }
  }

  const rot = r.join("");

  for (let j = 0; j < rot.length; j++) {
    const ch = rot[j];

    if (ch === "=") break;

    const v = map.indexOf(ch);
    if (v === -1) continue;

    b = (b << 6) | v;
    c += 6;

    if (c >= 8) {
      c -= 8;
      out += String.fromCharCode((b >> c) & 0xff);
    }
  }

  return out;
}

function _defaultExport() {
  return {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl
  };
}

try {
  globalThis.default = _defaultExport;
} catch (_) {}

try {
  this.default = _defaultExport;
} catch (_) {}

try {
  globalThis.module = globalThis.module || {};
  globalThis.module.exports = {
    default: _defaultExport
  };
} catch (_) {}