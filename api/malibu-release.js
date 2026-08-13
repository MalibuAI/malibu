module.exports = async function handler(req, res) {
  const sendJSON = (status, body, cacheControl) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJSON(405, { error: 'method_not_allowed' }, 'no-store');
    return;
  }

  try {
    const { resolveLatestMalibuRelease } = await import('../j/latest-release.mjs');
    const { isAcceptedMalibuDownload } = await import('../j/release.mjs');
    const release = await resolveLatestMalibuRelease();
    if (!isAcceptedMalibuDownload(release)) {
      throw new Error('resolved release failed public download checks');
    }
    sendJSON(
      200,
      { tag: release.tag, url: release.url, sha256: release.sha256 },
      'public, s-maxage=300, stale-while-revalidate=3600',
    );
  } catch {
    sendJSON(502, { error: 'release_unavailable' }, 'no-store');
  }
};
