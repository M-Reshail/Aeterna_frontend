const asArray = (value) => (Array.isArray(value) ? value : []);

const toText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const validateEventRendering = ({ rawEvent, normalizedEvent, index }) => {
  const warnings = [];
  const content = rawEvent?.content || {};
  const normalized = normalizedEvent || {};

  const rawType = toText(rawEvent?.type).toLowerCase();
  const normalizedType = toText(normalized?.type).toLowerCase();
  if (rawType && normalizedType && rawType !== normalizedType) {
    warnings.push(`type mismatch at item ${index}: raw=${rawType}, normalized=${normalizedType}`);
  }

  if (!['news', 'price', 'onchain'].includes(normalizedType)) {
    warnings.push(`unsupported type at item ${index}: ${normalizedType || 'missing'}`);
  }

  const rawSummary = toText(content.summary);
  const normalizedSummary = toText(normalized.summary);
  if (rawSummary === '' && normalizedSummary !== '') {
    warnings.push(`summary mismatch at item ${index}: raw summary empty but normalized summary is populated`);
  }

  const rawAuthorMissing = content.author === null || content.author === undefined || toText(content.author) === '';
  const normalizedAuthor = toText(normalized.author);
  if (rawAuthorMissing && normalizedAuthor !== '') {
    warnings.push(`author mismatch at item ${index}: raw author missing but normalized author is populated`);
  }

  const rawCategories = asArray(content.categories);
  const normalizedCategories = asArray(normalized.categories);
  if (rawCategories.length === 0 && normalizedCategories.length > 0) {
    warnings.push(`categories mismatch at item ${index}: raw categories empty but normalized categories rendered`);
  }

  const rawImageMissing = content.image == null && content.image_url == null && content.thumbnail == null && content.thumbnail_url == null;
  const normalizedImage = toText(normalized.image);
  if (rawImageMissing && normalizedImage !== '') {
    warnings.push(`image mismatch at item ${index}: raw image missing but normalized image is populated`);
  }

  const rawContentKeys = Object.keys(content);
  const missingKeys = rawContentKeys.filter(
    (key) => !(key in normalized) && !(key in (normalized.rawContent || {}))
  );
  if (missingKeys.length > 0) {
    warnings.push(`missing content keys at item ${index}: ${missingKeys.join(', ')}`);
  }

  const renderRules = {
    showAuthor: normalizedAuthor !== '',
    showCategories: normalizedCategories.length > 0,
    showImage: normalizedImage !== '',
    showSummary: normalizedSummary !== '',
    summaryMode: normalizedSummary === '' ? 'hidden' : normalizedSummary.length > 120 ? 'truncated-with-show-more' : 'full',
    feedTime: 'relative',
    detailTime: 'full-date',
    typeRenderer: normalizedType || 'unknown',
  };

  return { warnings, renderRules };
};
