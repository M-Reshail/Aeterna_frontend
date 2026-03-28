const toLower = (value) => String(value || '').trim().toLowerCase();
const toUpper = (value) => String(value || '').trim().toUpperCase();

const getNormalizedType = (event) => {
  const type = toLower(event?.type || event?.rawContent?.type);
  if (type) return type;
  const eventType = toLower(event?.event_type);
  if (eventType.includes('onchain')) return 'onchain';
  if (eventType.includes('price')) return 'price';
  if (eventType.includes('news')) return 'news';
  return '';
};

export const FILTER_MAP = {
  ethereum_blockchain: (event) => {
    const blockchain = toLower(event?.blockchain || event?.rawContent?.blockchain);
    const source = toLower(event?.source);
    return blockchain === 'ethereum' || source === 'ethereum';
  },

  token_transfer: (event) =>
    getNormalizedType(event) === 'onchain' &&
    toLower(event?.txType || event?.transaction_type || event?.rawContent?.transaction_type || event?.rawContent?.tx_type) === 'transfer',

  stablecoins: (event) =>
    ['USDT', 'USDC', 'DAI'].includes(toUpper(event?.token || event?.symbol || event?.rawContent?.token || event?.rawContent?.symbol)),

  high_priority: (event) =>
    toUpper(event?.priority) === 'HIGH',

  news_only: (event) =>
    getNormalizedType(event) === 'news',

  price_only: (event) =>
    getNormalizedType(event) === 'price',

  onchain_only: (event) =>
    getNormalizedType(event) === 'onchain',
};

export const DYNAMIC_FILTER_OPTIONS = [
  { key: 'ethereum_blockchain', label: 'Ethereum' },
  { key: 'token_transfer', label: 'Token Transfer' },
  { key: 'stablecoins', label: 'Stablecoins' },
  { key: 'high_priority', label: 'High Priority' },
  { key: 'news_only', label: 'News Only' },
  { key: 'price_only', label: 'Price Only' },
  { key: 'onchain_only', label: 'Onchain Only' },
];

export const applyDynamicFilters = (events, filterKeys = []) => {
  if (!Array.isArray(events) || events.length === 0) return [];
  if (!Array.isArray(filterKeys) || filterKeys.length === 0) return events;

  const predicates = filterKeys
    .map((key) => {
      const predicate = FILTER_MAP[key];
      if (typeof predicate !== 'function') {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[DynamicFilters] Unknown filter key: ${key}`);
        }
        return null;
      }
      return predicate;
    })
    .filter(Boolean);

  if (predicates.length === 0) return events;

  return events.filter((event) =>
    predicates.every((predicate) => {
      try {
        return Boolean(predicate(event));
      } catch {
        return false;
      }
    })
  );
};
