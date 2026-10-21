/* GET /api/release/<repo>
   Latest published release of one of the owner's repos, normalised to the
   shape synapt.js uses: { version, assets: [{ name, url, size }] }.

   Every visitor shares one cached copy at the edge, so the page no longer
   spends each visitor's own GitHub API budget (60 requests/hour per IP).
   A fresh copy is kept for FRESH_SECONDS; a stale copy is kept for
   STALE_SECONDS and served if GitHub is unreachable or rate limited.
   Set a GITHUB_TOKEN secret in the Pages project to raise the limit the
   function itself runs under; it works without one. */

const OWNER = "aatishbagal";
const FRESH_SECONDS = 600;
const STALE_SECONDS = 7 * 24 * 60 * 60;

export async function onRequestGet({ params, env, request }) {
  const repo = String(params.repo || "");
  if (!/^[A-Za-z0-9._-]+$/.test(repo)) return json({ error: "invalid repo" }, 400, 0);

  const cache = caches.default;
  const origin = new URL(request.url).origin;
  const freshKey = new Request(`${origin}/api/release/${repo}?copy=fresh`);
  const staleKey = new Request(`${origin}/api/release/${repo}?copy=stale`);

  const fresh = await cache.match(freshKey);
  if (fresh) return fresh;

  let data;
  try {
    data = await fetchLatest(repo, env.GITHUB_TOKEN);
  } catch (err) {
    const stale = await cache.match(staleKey);
    if (stale) return json(await stale.json(), 200, 60);
    return json({ error: String(err.message || err) }, 502, 0);
  }

  const response = json(data, 200, FRESH_SECONDS);
  await Promise.all([
    cache.put(freshKey, response.clone()),
    cache.put(staleKey, json(data, 200, STALE_SECONDS))
  ]);
  return response;
}

async function fetchLatest(repo, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "synapt-landing"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/releases/latest`, { headers });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const release = await res.json();

  return {
    version: String(release.tag_name || "").replace(/^v/, ""),
    assets: (release.assets || []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size
    }))
  };
}

function json(body, status, maxAge) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store"
    }
  });
}
