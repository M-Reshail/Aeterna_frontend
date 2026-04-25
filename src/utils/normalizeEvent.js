const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toText = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toText(item, '').trim())
    .filter(Boolean);
};

const normalizeTimestamp = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue;

    if (typeof candidate === 'number') {
      const millis = candidate < 1e12 ? candidate * 1000 : candidate;
      const date = new Date(millis);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
      continue;
    }

    const text = toText(candidate, '');
    if (!text) continue;

    const numericValue = Number(text);
    if (Number.isFinite(numericValue)) {
      const millis = numericValue < 1e12 ? numericValue * 1000 : numericValue;
      const numericDate = new Date(millis);
      if (!Number.isNaN(numericDate.getTime())) return numericDate.toISOString();
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return null;
};

const normalizePriorityValue = (value) => {
  const upper = toText(value, '').toUpperCase();
  if (['HIGH', 'MEDIUM', 'LOW'].includes(upper)) return upper;

  if (['CRITICAL', 'SEVERE', 'URGENT'].includes(upper)) return 'HIGH';
  if (['WARNING', 'MODERATE'].includes(upper)) return 'MEDIUM';
  if (['INFO', 'INFORMATIONAL'].includes(upper)) return 'LOW';

  return '';
};

const toNumericScore = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = toText(value, '');
  if (!text) return null;

  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolvePriority = (rawEvent = {}, content = {}, details = {}, alert = {}) => {
  const explicitPriority = normalizePriorityValue(
    alert?.priority ||
    content?.priority ||
    details?.priority ||
    content?.priority_marker ||
    details?.priority_marker ||
    content?.severity ||
    details?.severity ||
    rawEvent?.priority ||
    rawEvent?.severity
  );

  if (explicitPriority) return explicitPriority;

  const scored = [
    toNumericScore(content?.quality_score),
    toNumericScore(details?.quality_score),
    toNumericScore(content?.importance_score),
    toNumericScore(details?.importance_score),
    toNumericScore(content?.impact_score),
    toNumericScore(details?.impact_score),
    toNumericScore(content?.confidence_score),
    toNumericScore(details?.confidence_score),
    toNumericScore(content?.confidence),
    toNumericScore(details?.confidence),
    toNumericScore(rawEvent?.quality_score),
    toNumericScore(rawEvent?.importance_score),
    toNumericScore(rawEvent?.impact_score),
    toNumericScore(rawEvent?.confidence_score),
    toNumericScore(rawEvent?.confidence),
  ].find((value) => value !== null);

  if (scored !== undefined) {
    const normalizedScore = scored >= 0 && scored <= 1 ? scored * 100 : scored;
    if (normalizedScore >= 70) return 'HIGH';
    if (normalizedScore >= 50) return 'MEDIUM';
  }

  return 'LOW';
};

export const normalizeEvent = (rawEvent = {}, alert = null) => {
  const content = isObject(rawEvent?.content) ? rawEvent.content : {};
  const details = isObject(content?.details) ? content.details : {};
  const safeAlert = isObject(alert) ? alert : {};

  const resolvedPriority = resolvePriority(rawEvent, content, details, safeAlert);

  const imageUrl = toText(content?.image_url, '') || null;
  const summaryText = toText(content?.summary, '') || null;

  if (content?.has_image === true && !imageUrl) {
    console.log('[normalizeEvent] has_image=true but image_url is missing', {
      id: rawEvent?.id ?? rawEvent?.alert_id ?? null,
      source: rawEvent?.source ?? null,
      title: toText(content?.title, toText(safeAlert?.title, '')),
    });
  }

  // Keep feed and details in sync by preferring publication timestamps from the payload.
  const publicationTimestamp = normalizeTimestamp(
    content?.published,
    content?.published_at,
    details?.published,
    details?.published_at,
    content?.timestamp,
    details?.timestamp,
    rawEvent?.timestamp,
    rawEvent?.created_at,
    rawEvent?.createdAt
  );

  return {
    title: toText(content?.title, toText(safeAlert?.title, '')),
    summary: summaryText,
    source: toText(rawEvent?.source, '') || null,
    type: toText(rawEvent?.type, '') || null,
    event_hash: toText(content?.event_hash, toText(rawEvent?.event_hash, '')) || null,
    priority: resolvedPriority,
    author: content?.has_author ? (toText(content?.author, '') || null) : null,
    image_url: imageUrl,
    has_image: content?.has_image === true,
    has_author: content?.has_author === true,
    word_count: Number.isFinite(Number(content?.word_count)) ? Number(content.word_count) : null,
    read_time_minutes: Number.isFinite(Number(content?.read_time_minutes)) ? Number(content.read_time_minutes) : null,
    quality_score: Number.isFinite(Number(content?.quality_score)) ? Number(content.quality_score) : null,
    urls: Array.isArray(content?.urls) ? content.urls : [],
    timestamp: publicationTimestamp,
    detailTimestamp: publicationTimestamp,
    hashtags: toStringArray(content?.hashtags),
    mentions: toStringArray(content?.mentions),
    categories: toStringArray(content?.categories),
  };
};
