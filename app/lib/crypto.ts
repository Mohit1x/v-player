/**
 * AES-256-GCM helpers.
 * The key is derived from RESPONSE_SECRET (env var, server-only).
 * Never import this file from client components.
 */

const SECRET = process.env.RESPONSE_SECRET ?? "default-dev-secret-change-in-prod";

async function getKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(SECRET.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(data: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Pack iv + ciphertext as base64: "<iv_b64>.<cipher_b64>"
  const toB64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf)));
  return `${toB64(iv)}.${toB64(cipher)}`;
}

export async function decrypt(token: string): Promise<unknown> {
  const [ivB64, cipherB64] = token.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Invalid token");
  const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) },
    key,
    fromB64(cipherB64)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
