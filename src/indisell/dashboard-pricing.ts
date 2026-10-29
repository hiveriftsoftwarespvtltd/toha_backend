import { createHash } from 'node:crypto';

const canonical = (v: any): string =>
  v === null || typeof v !== 'object'
    ? JSON.stringify(v)
    : Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : '{' +
      Object.keys(v)
        .filter((k) => v[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}';

const hash = (v: any): string => createHash('sha256').update(canonical(v)).digest('hex');

const snapshot = (q: any) => {
  const keys = [
    'quoteId',
    'cartId',
    'cartVersion',
    'currency',
    'method',
    'expiresAt',
    'subtotalMinor',
    'discountMinor',
    'shippingMinor',
    'taxMinor',
    'codFeeMinor',
    'totalMinor',
    'payableMinor',
    'balanceMinor',
    'codAvailable',
    'discountLines',
    'selectedShippingId',
  ];
  return {
    ...Object.fromEntries(keys.filter((k) => q[k] !== undefined).map((k) => [k, q[k]])),
    items: (q.items || []).map((i: any) => ({
      variantId: i.variantId,
      title: i.title,
      quantity: i.quantity,
      unitPriceMinor: i.unitPriceMinor,
      ...(i.productId ? { productId: i.productId } : {}),
      ...(i.weightGrams != null ? { weightGrams: i.weightGrams } : {}),
      ...(i.gift ? { gift: true } : {}),
    })),
    shippingOptions: q.shippingOptions?.map((o: any) => ({
      id: o.id,
      label: o.label,
      amountMinor: o.amountMinor,
    })),
  };
};

const integer = (n: any): boolean => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;

function reject(reason?: string): never {
  const err: any = new Error(reason || 'Dashboard pricing snapshot mismatch');
  err.status = 409;
  throw err;
}

/**
 * Validates and accepts IndiSell dashboard-calculated pricing quote (SDK 1.6)
 */
export function acceptDashboardPricing(base: any, request: any, now: number = Date.now()) {
  const q = request?.pricingQuote;
  const p = q?.pricing;

  if (
    !base ||
    base.pricingBase !== 'catalog-v1' ||
    base.taxMinor !== 0 ||
    base.shippingMinor !== 0 ||
    base.codFeeMinor !== 0 ||
    !q ||
    p?.version !== 1 ||
    !/^[a-f0-9]{64}$/.test(p.hash || '') ||
    !/^[a-f0-9]{64}$/.test(p.policyHash || '')
  ) {
    reject('Invalid base catalog quote or dashboard pricing quote format');
  }

  for (const k of ['quoteId', 'cartId', 'cartVersion', 'currency', 'method', 'expiresAt', 'subtotalMinor']) {
    if (q[k] !== base[k]) reject(`Mismatch on ${k}: quote has ${q[k]}, base has ${base[k]}`);
  }

  if (
    request.quoteId !== q.quoteId ||
    request.cartId !== q.cartId ||
    request.cartVersion !== q.cartVersion ||
    request.method !== q.method ||
    q.currency !== 'INR' ||
    q.expiresAt <= now
  ) {
    reject('Request parameters do not match pricing quote or quote has expired');
  }

  const catalog = (i: any) => ({
    variantId: i.variantId,
    title: i.title,
    quantity: i.quantity,
    unitPriceMinor: i.unitPriceMinor,
    productId: i.productId,
    weightGrams: i.weightGrams,
    gift: i.gift === true ? true : undefined,
  });

  if (!Array.isArray(q.items) || canonical(q.items.map(catalog)) !== canonical(base.items.map(catalog))) {
    reject('Items in pricing quote do not match base catalog quote');
  }

  if (
    ![q.subtotalMinor, q.discountMinor, q.shippingMinor, q.codFeeMinor, q.taxMinor, q.totalMinor].every(integer) ||
    q.taxMinor !== 0 ||
    q.totalMinor <= 0 ||
    q.discountMinor > q.subtotalMinor ||
    q.discountMinor < base.discountMinor ||
    p.baseDiscountMinor !== base.discountMinor ||
    q.totalMinor !== q.subtotalMinor - q.discountMinor + q.shippingMinor + q.codFeeMinor
  ) {
    reject('Financial arithmetic validation failed on dashboard pricing quote');
  }

  if (
    !Array.isArray(q.discountLines) ||
    q.discountLines.reduce((n: number, l: any) => n + l.amountMinor, 0) !== q.discountMinor ||
    q.discountLines.some((l: any) => !integer(l.amountMinor))
  ) {
    reject('Discount lines do not sum up to discountMinor');
  }

  const baseLines =
    base.discountLines || (base.discountMinor ? [{ label: 'Cart discount', amountMinor: base.discountMinor }] : []);
  if (canonical(q.discountLines.slice(0, baseLines.length)) !== canonical(baseLines)) {
    reject('Base discount lines mismatch');
  }

  if (
    !Array.isArray(q.shippingOptions) ||
    q.shippingOptions.find((o: any) => o.id === q.selectedShippingId)?.amountMinor !== q.shippingMinor
  ) {
    reject('Selected shipping option amount does not match shippingMinor');
  }

  if (q.method === 'online' && q.codFeeMinor !== 0) {
    reject('COD fee cannot be applied on online method');
  }

  if (
    q.method === 'partial_cod' &&
    (!integer(q.payableMinor) ||
      !integer(q.balanceMinor) ||
      q.payableMinor < 1 ||
      q.balanceMinor < 1 ||
      q.payableMinor + q.balanceMinor !== q.totalMinor)
  ) {
    reject('Partial COD payable and balance split does not equal totalMinor');
  }

  const pricedSnapshot = snapshot(q);
  const calculatedHash = hash({
    quote: pricedSnapshot,
    policyHash: p.policyHash,
    baseDiscountMinor: p.baseDiscountMinor,
    paymentMode: p.paymentMode,
  });

  if (calculatedHash !== p.hash) {
    reject('Pricing hash verification failed against policy snapshot');
  }

  return structuredClone(q);
}
