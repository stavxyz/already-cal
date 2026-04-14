const TRACKING_PARAMS = new Set([
  'fbclid',  // Facebook click ID
  'si',      // Spotify session ID (share tracking)
]);
const TRACKING_PREFIX = 'utm_';

/** Normalize a URL: force HTTPS, strip www prefix, remove tracking parameters. */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '');

    // Strip trailing slashes; treat bare root as empty path in output
    const pathname = u.pathname.replace(/\/+$/, '');

    const cleaned = new URLSearchParams();
    for (const [key, value] of u.searchParams) {
      if (key.startsWith(TRACKING_PREFIX)) continue;
      if (TRACKING_PARAMS.has(key)) continue;
      cleaned.append(key, value);
    }
    const search = cleaned.toString();
    return u.origin + pathname + (search ? '?' + search : '') + u.hash;
  } catch {
    return url;
  }
}

/** Deduplicated set of extraction tokens, keyed by canonical ID. */
export class TokenSet {
  constructor() {
    this._map = new Map();
  }

  get size() {
    return this._map.size;
  }

  has(canonicalId) {
    return this._map.has(canonicalId);
  }

  add(token) {
    if (!this._map.has(token.canonicalId)) {
      this._map.set(token.canonicalId, token);
      return true;
    }
    return false;
  }

  addAll(tokens) {
    tokens.forEach(t => this.add(t));
  }

  ofType(type) {
    return [...this._map.values()].filter(t => t.type === type);
  }
}
