const ALLANIME_API_BASE = "https://allanime-api.mdtahseen7378.workers.dev";

async function fetchAllAnimeJson(path, options = {}) {
  const response = await fetchv2(ALLANIME_API_BASE + path, {
    "Accept": "application/json",
    ...(options.headers || {})
  }, options.method, options.body);
  if (!response.ok) throw new Error("AllAnime API HTTP " + response.status);
  return response.json();
}

async function searchResults(keyword) {
  const query = encodeURIComponent(String(keyword || "").trim());
  if (!query) return JSON.stringify([]);

  const results = await fetchAllAnimeJson("/search?query=" + query);
  const shows = Array.isArray(results) ? results : [];
  const ids = shows.slice(0, 20).map((show) => show.id).filter(Boolean);
  let thumbnails = {};

  if (ids.length) {
    try {
      thumbnails = await fetchAllAnimeJson("/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
    } catch {
      thumbnails = {};
    }
  }

  return JSON.stringify(shows.map((show) => ({
    title: show.title || show.id || "Untitled",
    image: thumbnails[show.id] || "",
    href: show.id
  })));
}

async function extractDetails(id) {
  const details = await fetchAllAnimeJson("/anime/" + encodeURIComponent(id));
  return JSON.stringify([{
    description: details.synopsis || "No description available",
    aliases: "Status: " + (details.status || "Unknown"),
    airdate: "Episodes: sub " + (details.episodes_sub || 0) + " / dub " + (details.episodes_dub || 0)
  }]);
}

async function extractEpisodes(id) {
  let data = await fetchAllAnimeJson("/episodes/" + encodeURIComponent(id) + "?mode=sub");
  let mode = data.mode || "sub";
  let episodes = Array.isArray(data.episodes) ? data.episodes : [];

  if (!episodes.length) {
    data = await fetchAllAnimeJson("/episodes/" + encodeURIComponent(id) + "?mode=dub");
    mode = data.mode || "dub";
    episodes = Array.isArray(data.episodes) ? data.episodes : [];
  }

  return JSON.stringify(episodes.map((episode, index) => ({
    href: JSON.stringify({
      show_id: id,
      ep_no: String(episode),
      mode
    }),
    number: Number.parseFloat(episode) || index + 1
  })));
}

async function extractStreamUrl(url) {
  const payload = JSON.parse(url);
  const modes = [payload.mode || "sub", payload.mode === "sub" ? "dub" : "sub"];

  for (const mode of modes) {
    try {
      const params = new URLSearchParams({
        show_id: payload.show_id,
        ep_no: payload.ep_no,
        quality: "best",
        mode
      });
      const data = await fetchAllAnimeJson("/episode_url?" + params.toString());
      if (data.episode_url) {
        return JSON.stringify({
          streams: [
            {
              title: "AllAnime " + mode.toUpperCase(),
              url: data.episode_url,
              headers: data.headers || undefined
            }
          ]
        });
      }
    } catch {
      // Try the alternate translation mode before failing the stream step.
    }
  }

  return JSON.stringify({ streams: [] });
}
