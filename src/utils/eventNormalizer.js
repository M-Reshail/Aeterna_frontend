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
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
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

const addThousandsSeparators = (digits) => {
  const normalized = String(digits || '0').replace(/^0+(?=\d)/, '') || '0';
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const toIntegerString = (value) => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return null;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (/^-?\d+$/.test(normalized)) return normalized;
    return null;
  }
  return null;
};

const formatTokenAmount = (rawAmount, tokenDecimals) => {
  const amountInteger = toIntegerString(rawAmount);
  if (!amountInteger) return '';

  const decimalsNumber = toNumber(tokenDecimals);
  const decimals = Number.isInteger(decimalsNumber) && decimalsNumber >= 0 ? decimalsNumber : 0;

  const sign = amountInteger.startsWith('-') ? '-' : '';
  const unsigned = sign ? amountInteger.slice(1) : amountInteger;

  if (decimals === 0) {
    return `${sign}${addThousandsSeparators(unsigned)}`;
  }

  const padded = unsigned.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, -decimals);
  const fractionPart = padded.slice(-decimals).replace(/0+$/, '');
  const compactFraction = fractionPart.slice(0, 6);

  if (!compactFraction) {
    return `${sign}${addThousandsSeparators(integerPart)}`;
  }

  return `${sign}${addThousandsSeparators(integerPart)}.${compactFraction}`;
};

const formatUsdValue = (value) => {
  const parsed = toNumber(value);
  if (parsed === null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: parsed >= 1000 ? 0 : 2,
  }).format(parsed);
};

const inferLegacyType = (item = {}) => {
  const declared = toText(item.event_type, '').toLowerCase();
  if (declared.includes('onchain')) return 'onchain';
  if (declared.includes('price')) return 'price';
  if (declared.includes('news')) return 'news';

  const title = toText(item.title, '').toLowerCase();
  if (title.includes('transfer') || title.includes('wallet') || title.includes('on-chain')) return 'onchain';
  if (title.includes('price') || title.includes('ath') || title.includes('atl')) return 'price';
  return 'news';
};

const normalizeLegacyStatus = (status) => {
  if (status === 'pending') return 'new';
  return toText(status, 'new');
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

  const explicitTitle = toText(firstDefined(content.title, event?.title), '');

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
  const fromShort = shortenAddress(fromAddress);
  const toShort = shortenAddress(toAddress);

  const tokenDecimals = firstDefined(content.token_decimals, content.decimals, content.tokenDecimals, null);
  const normalizedToken = toText(firstDefined(content.token, content.symbol, content.name), 'TOKEN');
  const amountRaw = firstDefined(content.amount, content.value, null);
  const usdRaw = firstDefined(content.usd_value, content.value_usd, null);
  const amountNumericText = formatTokenAmount(amountRaw, tokenDecimals);
  const amountFormatted = amountNumericText ? `${amountNumericText} ${normalizedToken}` : '';
  const usdFormatted = formatUsdValue(usdRaw);

  const generatedOnchainTitle = usdFormatted
    ? `Transfer of ${usdFormatted} ${normalizedToken}`
    : amountFormatted
    ? `Transfer of ${amountFormatted}`
    : `Transfer of ${normalizedToken}`;

  const title = explicitTitle || (type === 'onchain'
    ? generatedOnchainTitle
    : toText(firstDefined(content.name), `Event from ${toText(event?.source, 'unknown source')}`));

  const direction = fromShort && toShort ? `${fromShort} → ${toShort}` : '';
  const priorityReason = toText(
    firstDefined(content.alert_reason, content.alert_reasons, content.reason, content.priority_reason),
    ''
  );

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
    txType: toText(firstDefined(content.transaction_type, content.tx_type), ''),
    blockchain: toText(content.blockchain, ''),
    token: normalizedToken,
    token_decimals: toNumber(tokenDecimals),
    amount: amountRaw,
    amountFormatted,
    usd_value: usdRaw,
    usdFormatted,
    from: fromAddress,
    to: toAddress,
    from_short: fromShort,
    to_short: toShort,
    fromShort,
    toShort,
    direction,
    priorityReason,
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

export const normalizeFeedItem = (item) => {
  if (!item || typeof item !== 'object') return null;

  // Event API items already include nested content payloads.
  if (isPlainObject(item.content)) {
    return normalizeEvent(item);
  }

  // Legacy alert payloads are top-level fields. Map them into the same shape first.
  const mappedEvent = {
    id: item.id ?? item.alert_id,
    source: item.source,
    timestamp: item.timestamp || item.created_at || item.createdAt,
    type: inferLegacyType(item),
    content: {
      title: item.title,
      summary: firstDefined(item.content, item.description),
      priority: item.priority,
      symbol: item.symbol,
      token: item.token,
      blockchain: item.blockchain,
      transaction_type: firstDefined(item.transaction_type, item.tx_type),
      amount: firstDefined(item.amount, item.value),
      usd_value: firstDefined(item.usd_value, item.value_usd),
      from: firstDefined(item.from, item.from_address, item.sender),
      to: firstDefined(item.to, item.to_address, item.receiver),
      alert_reason: firstDefined(item.alert_reason, item.alert_reasons, item.reason),
      entity: item.entity,
    },
  };

  const normalized = normalizeEvent(mappedEvent);
  const preservedId = item.alert_id ?? item.id;

  return {
    ...normalized,
    id: preservedId,
    alert_id: preservedId,
    status: normalizeLegacyStatus(item.status),
    priority: toText(item.priority, normalized.priority),
    event_type: toText(item.event_type, normalized.event_type || 'NEWS').toUpperCase(),
    entity: toText(firstDefined(item.entity, normalized.entity), ''),
    raw: item,
    rawContent: {
      ...(normalized.rawContent || {}),
      legacy_alert: true,
    },
  };
};

export const normalizeFeedItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const normalized = [];
  items.forEach((item, index) => {
    try {
      const parsed = normalizeFeedItem(item);
      if (parsed) normalized.push(parsed);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[Events] normalizeFeedItem failed at index ${index}:`, error, item);
      }
    }
  });

  return normalized;
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
