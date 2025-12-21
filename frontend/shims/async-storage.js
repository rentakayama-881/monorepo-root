"use strict";

const hasWindowStorage = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function getStorage() {
  if (!hasWindowStorage) return null;
  try {
    const testKey = "__async_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

const backingStore = getStorage();

const AsyncStorage = {
  async getItem(key) {
    if (!backingStore) return null;
    return backingStore.getItem(key);
  },
  async setItem(key, value) {
    if (!backingStore) return null;
    backingStore.setItem(key, value);
    return null;
  },
  async removeItem(key) {
    if (!backingStore) return null;
    backingStore.removeItem(key);
    return null;
  },
  async clear() {
    if (!backingStore) return null;
    backingStore.clear();
    return null;
  },
  async getAllKeys() {
    if (!backingStore) return [];
    return Object.keys(backingStore);
  },
};

export { AsyncStorage };
export default AsyncStorage;
