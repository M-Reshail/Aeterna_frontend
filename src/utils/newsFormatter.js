const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toText = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const firstNonEmptyText = (...values) => {
  for (const value of values) {
    const text = toText(value, '');
    if (text) return text;
  }
  return '';
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

    if (typeof candidate === 'string') {
      const text = candidate.trim();
      if (!text) continue;

      const asNumber = Number(text);
      if (Number.isFinite(asNumber)) {
        const millis = asNumber < 1e12 ? asNumber * 1000 : asNumber;
        const date = new Date(millis);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }

      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  return new Date().toISOString();
};

const stripMarkupAndNoise = (input = '') => {
  const noHtml = String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b(read more|click here|continue reading)\b[:\s]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return noHtml;
};

const splitSentences = (text = '') => text
  .split(/(?<=[.!?])\s+/)
  .map((part) => part.trim())
  .filter(Boolean);

const dedupeSentences = (text = '') => {
  const seen = new Set();
  const result = [];

  for (const sentence of splitSentences(text)) {
    const key = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(sentence);
  }

  return result.join(' ').trim();
};

const sentenceBoundedPreview = (text, maxChars = 240) => {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return text;

  let preview = '';
  for (const sentence of sentences) {
    const candidate = preview ? `${preview} ${sentence}` : sentence;
    if (candidate.length > maxChars) break;
    preview = candidate;
  }

  if (preview) return preview;

  // If there is no punctuation boundary, cut at a word boundary.
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim();
};

export const cleanNewsSummary = (rawSummary, headline = '') => {
  const cleaned = stripMarkupAndNoise(rawSummary);
  const deDuplicated = dedupeSentences(cleaned);

  if (!deDuplicated) return headline;

  // Remove repeated headline prefix in summary.
  const normalizedHeadline = headline.toLowerCase().trim();
  const normalizedSummary = deDuplicated.toLowerCase().trim();
  if (normalizedHeadline && normalizedSummary.startsWith(normalizedHeadline)) {
    const shortened = deDuplicated.slice(headline.length).replace(/^[:\-\s]+/, '').trim();
    return sentenceBoundedPreview(shortened || deDuplicated);
  }

  return sentenceBoundedPreview(deDuplicated);
};

export const mapNewsFeedItem = (event = {}) => {
  const content = isObject(event?.content) ? event.content : {};
  const details = isObject(content?.details)
    ? content.details
    : (isObject(event?.details) ? event.details : {});

  const headline = firstNonEmptyText(
    content?.title,
    content?.headline,
    details?.title,
    details?.headline,
    event?.title,
    'Untitled News'
  );

  const summary = toText(content?.summary, '');

  const source = firstNonEmptyText(
    content?.source,
    content?.source_name,
    details?.source,
    details?.source_name,
    event?.source,
    'Unknown Source'
  );

  const timestamp = normalizeTimestamp(
    content?.published_at,
    content?.timestamp,
    details?.published_at,
    details?.timestamp,
    event?.timestamp,
    event?.created_at,
    event?.createdAt
  );

  const sentiment = firstNonEmptyText(
    content?.sentiment,
    content?.sentiment_label,
    details?.sentiment,
    details?.sentiment_label,
    event?.sentiment,
    ''
  ).toLowerCase();

  const link = firstNonEmptyText(
    content?.link,
    details?.link,
    event?.link,
    ''
  );

  const author = toText(content?.author, '') || null;

  return {
    source,
    timestamp,
    headline,
    summary,
    sentiment,
    link,
    author,
    content,
    details,
  };
};
