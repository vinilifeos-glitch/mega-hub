import * as Crypto from 'expo-crypto';

export async function hashPassword(salt: string, password: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);
}
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
export const newSalt = () => hex(Crypto.getRandomBytes(16));
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export const randomPassword = (n = 10) => Array.from(Crypto.getRandomBytes(n), b => ALPHA[b % ALPHA.length]).join('');
