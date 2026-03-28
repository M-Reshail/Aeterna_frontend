import { validateEventRendering } from './renderValidation';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toText = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')))
      .filter(Boolean)
      .join(', ');
    return joined || fallback;
  }

  if (isPlainObject(value)) {
    const candidate = value.summary || value.title || value.name || value.description || value.link;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallback;
};

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item, '').trim())
      .filter(Boolean);
  }
  return [];
};

const firstDefined = (...values) => values.find((item) => item !== undefined && item !== null);

const inferPriority = (content = {}) => {
  const explicitPriority = toText(content.priority, '').toUpperCase();
  if (['HIGH', 'MEDIUM', 'LOW'].includes(explicitPriority)) return explicitPriority;

  const score = toNumber(content.quality_score);
  if (score !== null) {
    if (score >= 70) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
  }

  return 'LOW';
};

const normalizeType = (type) => {
  const lower = toText(type, '').toLowerCase();
  if (lower === 'news' || lower === 'price' || lower === 'onchain') return lower;
  return lower || 'unknown';
};

const shortenAddress = (address) => {
  const value = toText(address, '');
  if (!value || value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export const normalizeEvent = (event) => {
  const content = isPlainObject(event?.content) ? { ...event.content } : {};
  const type = normalizeType(event?.type);
  const publishedDate = firstDefined(
    content.published_date,
    content.published_at,
    content.publication_date,
    content.date_published,
    content.published,
    null
  );

  const title = toText(
    firstDefined(content.title, content.name, event?.title),
    `Event from ${toText(event?.source, 'unknown source')}`
  );

  const summary = toText(
    firstDefined(content.summary, content.description, content.alert_reasons, event?.summary),
    ''
  );

  const author = toText(firstDefined(content.author, event?.author), '');
  const categories = toArray(firstDefined(content.categories, event?.categories));
  const hashtags = toArray(content.hashtags);
  const mentions = toArray(content.mentions);

  const image = toText(firstDefined(content.image, content.image_url, content.thumbnail, content.thumbnail_url), '');
  const readTime = toNumber(firstDefined(content.read_time_minutes, content.read_time));
  const qualityScore = toNumber(content.quality_score);

  const symbol = toText(firstDefined(content.symbol, content.token, content.ticker), '');
  const name = toText(firstDefined(content.name, title), '');

  const fromAddress = toText(firstDefined(content.from, content.from_address, content.sender), '');
  const toAddress = toText(firstDefined(content.to, content.to_address, content.receiver), '');

  const metrics = {
    word_count: toNumber(content.word_count),
    read_time_minutes: readTime,
    quality_score: qualityScore,
    current_price: toNumber(content.current_price),
    ath: toNumber(content.ath),
    atl: toNumber(content.atl),
    market_cap: toNumber(content.market_cap),
    volume: toNumber(firstDefined(content.volume, content.trading_volume_24h)),
    volatility: toNumber(content.volatility),
    price_change_1h_pct: toNumber(content.price_change_1h_pct),
    price_change_24h_pct: toNumber(content.price_change_24h_pct),
    price_change_7d_pct: toNumber(content.price_change_7d_pct),
    price_change_30d_pct: toNumber(content.price_change_30d_pct),
  };

  return {
    ...content,
    id: `event-${event?.id}`,
    event_id: event?.id,
    type,
    event_type: type.toUpperCase(),
    source: toText(event?.source, 'unknown'),
    timestamp: event?.timestamp || new Date().toISOString(),
    published_date: publishedDate,
    title,
    summary,
    content: summary,
    author,
    categories,
    hashtags,
    mentions,
    image,
    link: toText(firstDefined(content.link, content.url), ''),
    name,
    symbol,
    metrics,
    significant_moves: toArray(content.significant_moves),
    alert_reason: toText(firstDefined(content.alert_reason, content.alert_reasons), ''),
    transaction_type: toText(firstDefined(content.transaction_type, content.tx_type), ''),
    blockchain: toText(content.blockchain, ''),
    token: toText(firstDefined(content.token, content.symbol, content.name), ''),
    amount: firstDefined(content.amount, content.value, null),
    usd_value: firstDefined(content.usd_value, content.value_usd, null),
    from: fromAddress,
    to: toAddress,
    from_short: shortenAddress(fromAddress),
    to_short: shortenAddress(toAddress),
    entity: toText(firstDefined(content.id, content.symbol, content.token, content.name), ''),
    priority: inferPriority(content),
    status: 'new',
    rawContent: {
      ...content,
      type,
      title,
      summary,
      author,
      categories,
      hashtags,
      mentions,
      image,
      metrics,
    },
    raw: event,
  };
};

export const debugLogNormalizedEvents = (apiResponse, normalizedEvents, context = '') => {
  if (!import.meta.env.DEV) return;

  const rawItems = Array.isArray(apiResponse) ? apiResponse : [];
  const normalizedItems = Array.isArray(normalizedEvents) ? normalizedEvents : [];

  const firstApi = rawItems[0] || {};
  const firstContentKeys = Object.keys(firstApi?.content || {});
  const firstNormalized = normalizedItems[0] || {};
  const missingKeys = firstContentKeys.filter((key) => !(key in (firstNormalized || {})) && !(key in (firstNormalized?.rawContent || {})));
  const requiredFields = ['author', 'categories', 'hashtags', 'mentions', 'quality_score', 'published_date'];
  const requiredStatus = Object.fromEntries(
    requiredFields.map((key) => [
      key,
      Boolean((firstNormalized || {})[key] ?? (firstNormalized?.rawContent || {})[key] ?? (firstNormalized?.metrics || {})[key]),
    ])
  );
  const missingRequired = requiredFields.filter((key) => !requiredStatus[key]);
  const validationResults = rawItems.map((rawEvent, index) =>
    validateEventRendering({ rawEvent, normalizedEvent: normalizedItems[index], index })
  );
  const mismatchWarnings = validationResults.flatMap((item) => item.warnings);

  console.groupCollapsed(`[Events] ${context || 'Normalization debug'}`.trim());
  console.log('Full API response:', apiResponse);
  console.log('Normalized data:', normalizedEvents);
  console.log('Rendered data candidate (first normalized item):', firstNormalized);
  console.log('First event content keys:', firstContentKeys);
  console.log('Missing from normalized/rawContent:', missingKeys);
  console.log('Required field presence:', requiredStatus);
  console.log('Missing required fields:', missingRequired);
  console.log('Render validation snapshot:', validationResults.slice(0, 5).map((item) => item.renderRules));
  mismatchWarnings.forEach((warning) => {
    console.warn(`[Render Validation] ${warning}`);
  });
  console.groupEnd();
};
