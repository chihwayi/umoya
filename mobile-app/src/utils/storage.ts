import AsyncStorage from '@react-native-async-storage/async-storage';

const TENANT_CACHE_KEY = 'cached_tenant';
const TENANT_CACHE_TIMESTAMP_KEY = 'tenant_cache_timestamp';
const CACHE_VALIDITY_DAYS = 30; // Cache is valid for 30 days

export interface CachedTenant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  cachedAt: number;
}

export const storageUtils = {
  // Tenant caching
  cacheTenant: async (tenant: {
    id: string;
    name: string;
    slug: string;
    subdomain: string;
  }): Promise<void> => {
    try {
      const cachedTenant: CachedTenant = {
        ...tenant,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(cachedTenant));
      await AsyncStorage.setItem(TENANT_CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error caching tenant:', error);
    }
  },

  getCachedTenant: async (): Promise<CachedTenant | null> => {
    try {
      const cached = await AsyncStorage.getItem(TENANT_CACHE_KEY);
      const timestamp = await AsyncStorage.getItem(TENANT_CACHE_TIMESTAMP_KEY);

      if (!cached || !timestamp) {
        return null;
      }

      const tenant: CachedTenant = JSON.parse(cached);
      const cacheAge = Date.now() - parseInt(timestamp, 10);
      const cacheValidityMs = CACHE_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

      // Check if cache is still valid
      if (cacheAge > cacheValidityMs) {
        // Cache expired, clear it
        await storageUtils.clearTenantCache();
        return null;
      }

      return tenant;
    } catch (error) {
      console.error('Error getting cached tenant:', error);
      return null;
    }
  },

  clearTenantCache: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([TENANT_CACHE_KEY, TENANT_CACHE_TIMESTAMP_KEY]);
    } catch (error) {
      console.error('Error clearing tenant cache:', error);
    }
  },

  // Auth storage
  setAuthToken: async (token: string): Promise<void> => {
    try {
      await AsyncStorage.setItem('authToken', token);
    } catch (error) {
      console.error('Error setting auth token:', error);
    }
  },

  getAuthToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  },

  setTenantSlug: async (slug: string): Promise<void> => {
    try {
      await AsyncStorage.setItem('tenantSlug', slug);
    } catch (error) {
      console.error('Error setting tenant slug:', error);
    }
  },

  getTenantSlug: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('tenantSlug');
    } catch (error) {
      console.error('Error getting tenant slug:', error);
      return null;
    }
  },

  clearAuth: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'tenantSlug', 'user']);
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  },
};
