export let currentCurrencySymbol = '₹';

export const setGlobalCurrencySymbol = (symbol) => {
  currentCurrencySymbol = symbol;
};

export const CURRENCY_SYMBOL = '₹';

/**
 * Formats a numerical value as currency in Indian Rupees (₹ / INR).
 * Supports standard decimal formatting (en-IN), signs, and compact notation.
 *
 * @param {number|string} amount - The numerical amount to format
 * @param {Object} [options] - Formatting options
 * @param {number} [options.decimals] - Optional explicit decimal places (e.g. 0, 2)
 * @param {number} [options.minimumFractionDigits] - Min fractional digits
 * @param {number} [options.maximumFractionDigits] - Max fractional digits
 * @param {boolean} [options.showSign=false] - Whether to explicitly prefix positive values with '+'
 * @param {boolean} [options.compact=false] - Whether to format as compact (e.g. ₹235k)
 * @param {string} [options.symbol] - Override currency symbol (defaults to '₹')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, options = {}) => {
  const symbol = options.symbol || currentCurrencySymbol || CURRENCY_SYMBOL;
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `${symbol}0`;
  }

  const num = Number(amount);
  const { decimals, showSign = false, compact = false, minimumFractionDigits, maximumFractionDigits } = options;

  if (compact) {
    if (Math.abs(num) >= 10000000) {
      return `${symbol}${(num / 10000000).toFixed(1)}Cr`;
    }
    if (Math.abs(num) >= 100000) {
      return `${symbol}${(num / 100000).toFixed(1)}L`;
    }
    if (Math.abs(num) >= 1000000) {
      return `${symbol}${(num / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${symbol}${(num / 1000).toFixed(0)}k`;
    }
  }

  const sign = num > 0 && showSign ? '+' : num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  let minDec = minimumFractionDigits;
  let maxDec = maximumFractionDigits;

  if (minDec === undefined && maxDec === undefined) {
    if (decimals !== undefined) {
      minDec = decimals;
      maxDec = decimals;
    } else {
      // Natural currency formatting: if whole number, 0 decimals; if decimal fraction, 2 decimals
      minDec = absNum % 1 !== 0 ? 2 : 0;
      maxDec = 2;
    }
  } else {
    minDec = minDec ?? (decimals ?? 0);
    maxDec = maxDec ?? (decimals ?? 2);
  }

  const locale = symbol === '₹' ? 'en-IN' : 'en-US';
  const formattedNum = absNum.toLocaleString(locale, {
    minimumFractionDigits: minDec,
    maximumFractionDigits: maxDec
  });

  return `${sign}${symbol}${formattedNum}`;
};

/**
 * Helper for compact formatting on chart axes (e.g. ₹235k)
 */
export const formatCompactCurrency = (amount, symbol) => {
  return formatCurrency(amount, { compact: true, decimals: 0, symbol });
};

