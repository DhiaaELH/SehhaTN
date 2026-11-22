const express = require('express');
const { XMLParser } = require('fast-xml-parser');

const router = express.Router();

// Flux RSS de confiance. Modifiables sans toucher au code : NEWS_FEEDS="url1,url2" dans .env / Render.
const DEFAULT_FEEDS = [
  'https://www.who.int/rss-feeds/news-french.xml', // OMS (français)
];
const FEEDS = (process.env.NEWS_FEEDS || DEFAULT_FEEDS.join(','))
  .split(',').map((s) => s.trim()).filter(Boolean);

const CACHE_MS = 3 * 60 * 60 * 1000; // 3 h : on ne re-télécharge pas à chaque visite
const MAX_ITEMS = 8;
const TIMEOUT_MS = 5000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true });
let cache = { at: 0, items: [], errors: [] };
let refreshing = null;

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (typeof x === 'object' && x !== null ? x['#text'] ?? '' : x ?? '');
const stripHtml = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const httpUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

async function get(url, maxBytes = 400_000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'SehhaTN/1.0 (annuaire de sante)', Accept: 'text/html,application/xml,application/rss+xml,*/*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).slice(0, maxBytes);
}

function imageFromItem(it) {
  for (const e of arr(it.enclosure)) {
    if (e?.['@_url'] && /image/.test(e['@_type'] || 'image')) return httpUrl(e['@_url']);
  }
  for (const key of ['media:content', 'media:thumbnail']) {
    for (const m of arr(it[key])) if (m?.['@_url']) return httpUrl(m['@_url']);
  }
  const html = `${text(it['content:encoded'])} ${text(it.description)}`;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? httpUrl(m[1]) : null;
}

// Pas d'image dans le flux : on lit la balise og:image de la page de l'article.
async function ogImage(pageUrl) {
  try {
    const html = await get(pageUrl, 200_000);
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? httpUrl(new URL(m[1].replace(/&amp;/g, '&'), pageUrl).href) : null;
  } catch { return null; }
}

async function loadFeed(feedUrl) {
  const xml = await get(feedUrl, 2_000_000);
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  const source = stripHtml(text(channel?.title) || text(doc?.feed?.title) || new URL(feedUrl).hostname);
  const raw = channel ? arr(channel.item) : arr(doc?.feed?.entry);
  const host = new URL(feedUrl).hostname.replace(/^www\./, '');

  const items = await Promise.all(raw.slice(0, MAX_ITEMS).map(async (it) => {
    const link = httpUrl(channel ? text(it.link) : arr(it.link)[0]?.['@_href']);
    const title = stripHtml(text(it.title));
    if (!link || !title) return null;
    const when = new Date(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']));
    let image = imageFromItem(it);
    // On ne visite que des pages du même site que le flux (pas d'URL arbitraire)
    if (!image && new URL(link).hostname.replace(/^www\./, '').endsWith(host)) image = await ogImage(link);
    return { title, link, source, image, date: isNaN(when) ? null : when.toISOString() };
  }));
  return items.filter(Boolean);
}

async function refresh() {
  const results = await Promise.allSettled(FEEDS.map(loadFeed));
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const errors = results.map((r, i) => (r.status === 'rejected' ? `${FEEDS[i]} : ${r.reason.message}` : null)).filter(Boolean);
  const seen = new Set();
  const unique = items
    .filter((x) => !seen.has(x.link) && seen.add(x.link))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, MAX_ITEMS);
  // Si tout échoue, on garde l'ancien cache plutôt que d'effacer les articles
  if (unique.length || !cache.items.length) cache = { at: Date.now(), items: unique, errors };
  else cache = { ...cache, at: Date.now() - CACHE_MS + 5 * 60 * 1000, errors }; // on réessaie dans 5 min
}

router.get('/', async (req, res) => {
  if (Date.now() - cache.at > CACHE_MS) {
    refreshing ??= refresh().finally(() => { refreshing = null; });
    if (!cache.items.length) await refreshing; // premier chargement : on attend
  }
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ items: cache.items, ...(process.env.NODE_ENV !== 'production' && { errors: cache.errors }) });
});

module.exports = router;
