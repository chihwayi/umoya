import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

/**
 * Encrypts PHI before it touches AsyncStorage. AsyncStorage is plaintext,
 * OS-readable by anything with filesystem/backup access (rooted device, iOS
 * Finder backup) — offline caches (patient records, vitals, allergies, queued
 * writes) previously sat there unencrypted for up to a full 6-hour TTL. The
 * AES key itself lives in SecureStore (OS Keychain/Keystore), same as the
 * auth JWT, and never touches AsyncStorage.
 */

const KEY_STORE_NAME = 'umoya_local_enc_key';
let cachedKey: string | null = null;

async function getOrCreateKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const existing = await SecureStore.getItemAsync(KEY_STORE_NAME);
  if (existing) {
    cachedKey = existing;
    return existing;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(KEY_STORE_NAME, key);
  cachedKey = key;
  return key;
}

export async function encryptForStorage(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  return CryptoJS.AES.encrypt(plaintext, key).toString();
}

export async function decryptFromStorage(ciphertext: string): Promise<string | null> {
  try {
    const key = await getOrCreateKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext || null;
  } catch {
    return null;
  }
}

/** Drop-in encrypted replacement for the AsyncStorage.setItem/getItem pair. */
export const SecureLocalStorage = {
  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encryptForStorage(value);
    await AsyncStorage.setItem(key, encrypted);
  },

  async getItem(key: string): Promise<string | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return decryptFromStorage(raw);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async multiRemove(keys: string[]): Promise<void> {
    await AsyncStorage.multiRemove(keys);
  },

  async getAllKeys(): Promise<readonly string[]> {
    return AsyncStorage.getAllKeys();
  },
};
