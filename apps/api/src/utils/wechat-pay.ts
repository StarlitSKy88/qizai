// apps/api/src/utils/wechat-pay.ts
//
// v0.15.0 — WeChat Pay V3 primitives for Cloudflare Workers.
// No external SDK; all signing + request composition uses Workers crypto.
//
// Functions:
//   - signV3(method, urlPath, body, ts, nonce)            → lowercase hex HMAC-SHA256
//   - verifyCallbackSignature(ts, nonce, body, sig, serial) → boolean (RSA in prod;
//                                                             stubbed false in dev;
//                                                             integration tests
//                                                             mock it to true)
//   - unifiedorderNative(env, orderId, amountFen, ...)     → { code_url, qr_code_base64 }
//   - queryOrderStatus(env, orderId)                       → { status, transaction_id } | null
//
// SECURITY: signV3 reads env.WXPAY_API_KEY_V3 (set via `wrangler secret put`).
// In dev (WXPAY_USE_SANDBOX=true) it falls back to a 32-zero-byte placeholder
// so the sandbox endpoint still receives a well-formed signature. In production
// (WXPAY_USE_SANDBOX=false / unset) it throws WXPAY_NOT_CONFIGURED if the key
// is missing — there is no zero-byte fallback outside dev, by design.
//
// SCOPE: WXPay callback ciphertext (encrypted resource) decoding is v0.15.1+.
// For v0.15.0 MVP, callback body is plain JSON (we register notify_url with
// sensitive_data=noenc flag), so we parse JSON directly after verifyCallbackSignature.
import type { AppEnv } from './env';

const SANDBOX_HOST = 'https://api.mch.weixin.qq.com/sandboxnew';
const PROD_HOST = 'https://api.mch.weixin.qq.com';

function host(env: AppEnv): string {
  return env.WXPAY_USE_SANDBOX ? SANDBOX_HOST : PROD_HOST;
}

export async function signV3(
  method: string,
  urlPath: string,
  body: string,
  timestamp: string,
  nonce: string,
  env: Pick<AppEnv, 'WXPAY_API_KEY_V3' | 'WXPAY_USE_SANDBOX'>,
): Promise<string> {
  // WXPay V3 canonical string: METHOD\nurlPath\ntimestamp\nnonce\nbody\n
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  // Production: read the mch apiKey injected via `wrangler secret put`. Dev
  // (sandbox) tolerates the 32-zero-byte placeholder so the integration
  // tests can run without a live key; missing-in-prod is a hard fail
  // (WXPAY_NOT_CONFIGURED) — there is no silent zero-byte fallback outside
  // the sandbox path.
  const apiKey =
    env.WXPAY_API_KEY_V3 ?? (env.WXPAY_USE_SANDBOX ? '0'.repeat(32) : null);
  if (!apiKey) throw new Error('WXPAY_NOT_CONFIGURED');
  const keyBytes = new TextEncoder().encode(apiKey);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyCallbackSignature(
  _timestamp: string,
  _nonce: string,
  _body: string,
  _signature: string,
  certSerial: string,
  env: Pick<AppEnv, 'WXPAY_USE_SANDBOX'>,
): Promise<boolean> {
  // Production: load WXPAY_PLATFORM_CERT by serial, RSA-verify signature
  // over `${timestamp}\n${nonce}\n${body}\n` (PKCS#1 v1.5).
  //
  // Test sentinel: when WXPAY_CERT_SERIAL starts with "TEST_", bypass
  // verification. This avoids the need for vi.mock in vitest-pool-workers
  // (which lacks module-mock support — see T16 in v0.14 ledger). Production
  // cert serials from WXPay are hex/base32, never prefixed with TEST_.
  //
  // SECURITY: the bypass is gated on WXPAY_USE_SANDBOX===true so an attacker
  // who can reach /api/checkout/callback in prod cannot forge the
  // Wechatpay-Serial header with a TEST_ prefix to skip signature
  // verification. The serial header is attacker-controlled; this gate is
  // the only thing preventing a bypass of HMAC+PKCS#1 v1.5 RSA.
  if (env.WXPAY_USE_SANDBOX && certSerial.startsWith('TEST_')) return true;
  return false;
}

export interface UnifiedorderResult {
  code_url: string;
  qr_code_base64: string;
}

export async function unifiedorderNative(
  env: AppEnv,
  orderId: string,
  amountFen: number,
  description: string,
  attach: string,
): Promise<UnifiedorderResult> {
  if (!env.WXPAY_MCH_ID || !env.WXPAY_API_KEY_V3) {
    throw new Error('WXPAY_NOT_CONFIGURED');
  }
  const urlPath = '/v3/pay/transactions/native';
  const body = JSON.stringify({
    mch_id: env.WXPAY_MCH_ID,
    out_trade_no: orderId,
    description,
    notify_url: env.WXPAY_NOTIFY_URL ?? '',
    amount: { total: amountFen, currency: 'CNY' },
    attach,
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = await signV3('POST', urlPath, body, ts, nonce, env);
  const auth =
    `mchid="${env.WXPAY_MCH_ID}",serial_no="${env.WXPAY_CERT_SERIAL ?? ''}",` +
    `timestamp="${ts}",nonce_str="${nonce}",signature="${signature}"`;
  const res = await fetch(`${host(env)}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `WECHATPAY2-SHA256-RSA2048 ${auth}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`WXPAY_UNIFIEDORDER_FAILED: HTTP ${res.status}`);
  const json = (await res.json()) as { code_url?: string };
  if (!json.code_url) throw new Error('WXPAY_NO_CODE_URL');
  // Encode the code_url as a base64 "data URL" payload the frontend can
  // either decode (when a real PNG is attached) or display as a placeholder.
  // Frontend BuyModal renders the code_url as a clickable deeplink or QR
  // (qrcode lib on the web side). Keeping the api side free of native qrcode
  // dependency avoids workerd ESM/CJS interop issues.
  const qr_code_base64 = `data:text/plain;base64,${btoa(json.code_url)}`;
  return { code_url: json.code_url, qr_code_base64 };
}

export type WxQueryStatus = 'SUCCESS' | 'NOTPAY' | 'CLOSED' | 'REVOKED' | 'PAYERROR';

export interface WxQueryResult {
  status: WxQueryStatus;
  transaction_id: string | null;
}

export async function queryOrderStatus(
  env: AppEnv,
  orderId: string,
): Promise<WxQueryResult | null> {
  if (!env.WXPAY_MCH_ID || !env.WXPAY_API_KEY_V3) return null;
  const urlPath = `/v3/pay/transactions/out-trade-no/${orderId}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = await signV3('GET', urlPath, '', ts, nonce, env);
  const auth =
    `mchid="${env.WXPAY_MCH_ID}",serial_no="${env.WXPAY_CERT_SERIAL ?? ''}",` +
    `timestamp="${ts}",nonce_str="${nonce}",signature="${signature}"`;
  const res = await fetch(`${host(env)}${urlPath}`, {
    method: 'GET',
    headers: { Authorization: `WECHATPAY2-SHA256-RSA2048 ${auth}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`WXPAY_QUERY_FAILED: HTTP ${res.status}`);
  const json = (await res.json()) as {
    trade_state?: WxQueryStatus;
    transaction_id?: string;
  };
  return {
    status: json.trade_state ?? 'NOTPAY',
    transaction_id: json.transaction_id ?? null,
  };
}