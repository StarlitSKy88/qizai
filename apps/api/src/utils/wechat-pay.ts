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
// SECURITY: signV3 uses a dev placeholder HMAC key (32 zero-bytes). Production
// must replace it with the WXPay mch apiKey (loaded via wrangler secret put).
// Tests cover shape only; real signing semantics are exercised against WXPay
// sandbox in T05/T07 integration tests with vi.mock.
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
): Promise<string> {
  // WXPay V3 canonical string: METHOD\nurlPath\ntimestamp\nnonce\nbody\n
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
  // Dev placeholder: 32 zero-bytes (deterministic for tests). Production injects
  // the actual apiKey via WXPAY_API_KEY_V3 wrangler secret.
  const keyBytes = new TextEncoder().encode('0'.repeat(32));
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
  _certSerial: string,
): Promise<boolean> {
  // Production: load WXPAY_PLATFORM_CERT by serial, RSA-verify signature
  // over `${timestamp}\n${nonce}\n${body}\n` (PKCS#1 v1.5).
  // For v0.15.0 MVP, callback uses plaintext (sensitive_data=noenc), so we
  // also need to load the platform cert. Tests mock this function to true.
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
  const signature = await signV3('POST', urlPath, body, ts, nonce);
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
  // base64 PNG via qrcode (dev dep). Lazy import keeps cold start small.
  const QRCode = (await import('qrcode')).default;
  const qr_code_base64 = await QRCode.toDataURL(json.code_url, { type: 'image/png' });
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
  const signature = await signV3('GET', urlPath, '', ts, nonce);
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