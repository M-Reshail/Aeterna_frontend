export const SUMMARY_FALLBACK_TEXT = 'No summary available';

export const toNonEmptyText = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed ? value : '';
};

export const getSummaryOrFallback = (value) => {
  const text = toNonEmptyText(value);
  return text || SUMMARY_FALLBACK_TEXT;
};

export const getAuthorDisplay = (value, { mode = 'hide' } = {}) => {
  const text = toNonEmptyText(value);
  if (text) return text.trim();
  if (mode === 'unknown') return 'Unknown';
  return '';
};

