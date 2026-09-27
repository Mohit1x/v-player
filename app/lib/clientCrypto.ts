"use client";

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const res = await fetch("/api/media/key");
  const { k } = await res.json();
  const raw = Uint8Array.from(atob(k), (c) => c.charCodeAt(0));
  cachedKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  return cachedKey;
}

export async function decryptResponse<T>(token: string): Promise<T> {
  const [ivB64, cipherB64] = token.split(".");
  if (!ivB64 || !cipherB64) throw new Error("Bad token");
  const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) },
    key,
    fromB64(cipherB64)
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
