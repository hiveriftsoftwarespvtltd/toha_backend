import { createHash, createHmac } from 'crypto';

const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export const BRIDGE_ERROR = Symbol('owned checkout bridge error');

export interface BridgeCustomer {
  id: string;
}

export interface BridgeOwnedCart {
  id: string;
  version: string;
  ownerId: string;
  requestId: string;
}

export interface BridgeSessionBinding {
  customerId: string;
  sessionHash: string;
  cartId: string;
  cartVersion: string;
}

export interface CheckoutBridgeConfig {
  checkoutOrigin: string;
  storefrontOrigin: string;
  merchantKey: string;
  connectorSecret: string;
  authenticateCustomer: (req: Request) => Promise<BridgeCustomer | null>;
  loadOwnedCart: (customerId: string, cartId: string) => Promise<BridgeOwnedCart | null>;
  rememberSession: (binding: BridgeSessionBinding) => Promise<boolean>;
  ownsSession: (customerId: string, sessionHash: string) => Promise<boolean>;
}

export const fail = (status: number, code: string) => {
  throw Object.assign(new Error(code), { status, publicCode: code, [BRIDGE_ERROR]: true });
};

function origin(value: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.origin !== value) {
    throw new Error('Use an exact HTTPS origin');
  }
  return value;
}

async function body(req: Request, allowed: string[]) {
  if (req.method !== 'POST') fail(405, 'post_required');
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    fail(415, 'json_required');
  }
  if (Number(req.headers.get('content-length')) > 16384 || !req.body) {
    fail(413, 'body_limit');
  }
  const reader = req.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        fail(413, 'body_limit');
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  let value: any;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    fail(400, 'invalid_json');
  }
  if (!object(value) || Object.keys(value).some((k) => !allowed.includes(k))) {
    fail(400, 'invalid_request');
  }
  return value;
}

export function createCheckoutBridge(config: CheckoutBridgeConfig) {
  const checkoutOrigin = origin(config.checkoutOrigin);
  const storefrontOrigin = origin(config.storefrontOrigin);

  if (
    !/^mk_[A-Za-z0-9_-]{4,128}$/.test(config.merchantKey) ||
    typeof config.connectorSecret !== 'string' ||
    config.connectorSecret.length < 32
  ) {
    throw new Error('Configure server-side merchant credentials');
  }

  for (const key of ['authenticateCustomer', 'loadOwnedCart', 'rememberSession', 'ownsSession'] as const) {
    if (typeof config[key] !== 'function') {
      throw new Error('Implement ' + key + ' against your own authentication/database');
    }
  }

function isOriginAllowed(reqOrigin: string | null, storefrontOrigin: string): boolean {
  if (!reqOrigin) return false;
  if (reqOrigin === storefrontOrigin) return true;
  if (reqOrigin === 'https://tohay.in' || reqOrigin === 'https://www.tohay.in') return true;

  try {
    const url = new URL(reqOrigin);
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) {
      return true;
    }
  } catch (_) { }

  return false;
}

  async function authenticated(req: Request) {
    const reqOrigin = req.headers.get('origin');
    if (!isOriginAllowed(reqOrigin, storefrontOrigin) || req.headers.get('x-indisell-custom') !== '1') {
      fail(403, 'origin_not_allowed');
    }
    const customer = await config.authenticateCustomer(req);
    if (typeof customer?.id !== 'string' || !customer.id || customer.id.length > 128) {
      fail(401, 'customer_session_required');
    }
    return customer;
  }

  async function upstream(path: string, headers: Record<string, string>, raw: string) {
    const res = await fetch(checkoutOrigin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: raw,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      fail(res.status === 403 ? 403 : 503, 'indisell_checkout_unavailable');
    }
    return res.json();
  }

  function route(fn: (req: Request) => Promise<any>) {
    return async (req: Request) => {
      try {
        return Response.json(await fn(req), {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch (e: any) {
        console.error('Checkout bridge error:', e?.message || e);
        return Response.json(
          { error: e?.[BRIDGE_ERROR] ? e.publicCode : 'checkout_bridge_unavailable' },
          {
            status: e?.[BRIDGE_ERROR] ? e.status : 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }
    };
  }

  return {
    session: route(async (req: Request) => {
      const customer = await authenticated(req);
      const input = await body(req, ['cartId', 'cartVersion']);
      if (typeof input.cartId !== 'string' || typeof input.cartVersion !== 'string') {
        fail(400, 'invalid_cart');
      }
      const cart = await config.loadOwnedCart(customer.id, input.cartId);
      if (
        !cart ||
        cart.ownerId !== customer.id ||
        cart.id !== input.cartId ||
        typeof cart.version !== 'string' ||
        !cart.version ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(cart.requestId || '')
      ) {
        fail(403, 'cart_not_owned_or_changed');
      }
      const raw = JSON.stringify({
        requestId: 'cart_' + hash(config.merchantKey + ':' + cart.id + ':' + cart.version + ':' + cart.requestId),
        cartId: cart.id,
        cartVersion: cart.version,
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', config.connectorSecret)
        .update(`custom-session-create-v1.${config.merchantKey}.${timestamp}.${raw}`)
        .digest('hex');
      const session = await upstream(
        '/api/custom/v1/create',
        {
          'X-IndiSell-Merchant-Key': config.merchantKey,
          'X-IndiSell-Timestamp': timestamp,
          'X-IndiSell-Signature': signature,
        },
        raw,
      );
      const url = new URL(session.checkoutUrl);
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(session.checkoutSessionId) ||
        url.origin !== checkoutOrigin ||
        url.pathname !== '/custom-checkout' ||
        url.hash !== '#' + session.checkoutSessionId ||
        url.searchParams.get('mk') !== config.merchantKey
      ) {
        fail(502, 'invalid_checkout_session');
      }
      if (
        (await config.rememberSession({
          customerId: customer.id,
          sessionHash: hash(session.checkoutSessionId),
          cartId: cart.id,
          cartVersion: cart.version,
        })) !== true
      ) {
        fail(503, 'session_binding_unconfirmed');
      }
      return { checkoutSessionId: session.checkoutSessionId, checkoutUrl: url.href };
    }),
    verify: route(async (req: Request) => {
      const customer = await authenticated(req);
      const input = await body(req, ['checkoutSessionId']);
      const token = input.checkoutSessionId;
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        fail(400, 'invalid_session');
      }
      if ((await config.ownsSession(customer.id, hash(token))) !== true) {
        fail(403, 'session_not_owned');
      }
      const status = await upstream(
        '/api/custom/v1/status',
        { Authorization: 'Bearer ' + token },
        '{}',
      );
      if (status.checkoutSessionId !== token || !['confirmed', 'pending'].includes(status.status)) {
        fail(502, 'invalid_checkout_status');
      }
      if (
        status.status === 'confirmed' &&
        (typeof status.orderId !== 'string' || !status.orderId || status.orderId.length > 128)
      ) {
        fail(502, 'invalid_checkout_order');
      }
      const order =
        status.status === 'confirmed' && status.order && status.quote
          ? {
              transactionId: 'custom:' + config.merchantKey + ':' + status.orderId,
              currency: status.order.currency,
              totalMinor: status.order.totalMinor,
              method: status.order.method,
              paidMinor:
                status.order.paidMinor ?? (status.order.method === 'online' ? status.order.totalMinor : 0),
              balanceMinor:
                status.order.balanceMinor ?? (status.order.method === 'cod' ? status.order.totalMinor : 0),
              items: status.quote.items.map((i: any) => ({
                id: i.variantId,
                title: i.title,
                quantity: i.quantity,
                unitPriceMinor: i.unitPriceMinor,
              })),
            }
          : null;
      return {
        checkoutSessionId: token,
        status: status.status,
        orderId: status.status === 'confirmed' ? status.orderId : null,
        ...(order ? { order } : {}),
      };
    }),
  };
}

export async function handleWebRouteWithExpress(
  webHandler: (req: Request) => Promise<Response>,
  expressReq: any,
  expressRes: any,
) {
  const protocol = expressReq.headers['x-forwarded-proto'] || expressReq.protocol || 'https';
  const host = expressReq.headers['x-forwarded-host'] || expressReq.headers['host'] || 'tohay.in';
  const url = `${protocol}://${host}${expressReq.originalUrl || expressReq.url}`;

  const headers = new Headers();
  for (const [key, val] of Object.entries(expressReq.headers)) {
    if (val !== undefined) {
      if (Array.isArray(val)) {
        val.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, String(val));
      }
    }
  }

  let rawBody = expressReq.rawBody;
  if (rawBody === undefined) {
    if (typeof expressReq.body === 'string') {
      rawBody = expressReq.body;
    } else if (expressReq.body && typeof expressReq.body === 'object') {
      rawBody = JSON.stringify(expressReq.body);
    } else {
      rawBody = '';
    }
  }

  const isBodyAllowed = expressReq.method !== 'GET' && expressReq.method !== 'HEAD';
  const bodyBuffer = isBodyAllowed ? Buffer.from(rawBody, 'utf-8') : undefined;

  if (isBodyAllowed && !headers.has('content-length')) {
    headers.set('content-length', String(bodyBuffer?.length || 0));
  }

  const webReq = new Request(url, {
    method: expressReq.method,
    headers,
    body: bodyBuffer,
    // @ts-ignore
    duplex: 'half',
  });

  const webRes = await webHandler(webReq);

  expressRes.status(webRes.status);
  webRes.headers.forEach((value, key) => {
    expressRes.setHeader(key, value);
  });

  const data = await webRes.json();
  return expressRes.json(data);
}
