import { createHmac, createHash } from 'crypto';

interface SigV4Params {
  method: string;
  url: string;
  region: string;
  service: string;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export async function signAwsRequest(
  p: SigV4Params,
): Promise<Record<string, string>> {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const parsed = new URL(p.url);
  const host = parsed.host;

  const payloadHash = sha256Hex(p.body);
  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = [
    p.method,
    parsed.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credScope = `${dateStamp}/${p.region}/${p.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate    = hmacSha256(`AWS4${p.secretAccessKey}`, dateStamp);
  const kRegion  = hmacSha256(kDate, p.region);
  const kService = hmacSha256(kRegion, p.service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${p.accessKeyId}/${credScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Content-Type': 'application/json',
    'X-Amz-Date': amzDate,
    Authorization: authorization,
  };
}
