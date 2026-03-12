# JavaScript Caching Strategies for Microfrontend Architecture

## Executive Summary

This document outlines comprehensive caching strategies for our React-based microfrontend architecture, covering client-side caching, server state management, HTTP caching, and cross-MFE coordination. Based on analysis of our existing codebase (cart-mfe, checkout-mfe, product-mfe, homepage-mfe, etc.), these strategies will improve performance, reduce network requests, and enhance user experience.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Client-Side Caching Strategies](#client-side-caching-strategies)
3. [TanStack Query for Server State Management](#tanstack-query-for-server-state-management)
4. [RTK Query for Redux-Based Caching](#rtk-query-for-redux-based-caching)
5. [HTTP Caching Best Practices](#http-caching-best-practices)
6. [Browser Storage Strategies](#browser-storage-strategies)
7. [CDN and Asset Caching](#cdn-and-asset-caching)
8. [Cache Invalidation Strategies](#cache-invalidation-strategies)
9. [Cross-MFE Cache Coordination](#cross-mfe-cache-coordination)
10. [Performance Optimization](#performance-optimization)
11. [Cache Warming and Prefetching](#cache-warming-and-prefetching)
12. [Memory Management and Limits](#memory-management-and-limits)
13. [Offline Functionality](#offline-functionality)
14. [Implementation Guidelines](#implementation-guidelines)
15. [Monitoring and Debugging](#monitoring-and-debugging)

## Current State Analysis

### Existing Architecture
- **Redux State Management**: All MFEs use Redux with consistent store structure
- **Server-Side Rendering**: SSR implementation across all MFEs
- **Axios Interceptors**: Basic API request/response handling
- **Webpack Code Splitting**: Bundle optimization in place
- **Basic Caching**: Limited caching patterns, no comprehensive strategy

### Identified Gaps
- No centralized server state management
- Limited cache invalidation strategies
- No cross-MFE cache coordination
- Minimal offline functionality
- No cache warming or prefetching

## Client-Side Caching Strategies

### 1. Memory-Based Caching

#### React Component-Level Caching
```javascript
// Use React.memo for component memoization
const ProductCard = React.memo(({ product }) => {
  return <div>{product.name}</div>;
}, (prevProps, nextProps) => {
  return prevProps.product.id === nextProps.product.id &&
         prevProps.product.updatedAt === nextProps.product.updatedAt;
});

// Use useMemo for expensive calculations
const ExpensiveProductList = ({ products, filters }) => {
  const filteredProducts = useMemo(() => {
    return products.filter(product => 
      filters.every(filter => filter.test(product))
    );
  }, [products, filters]);
  
  return <ProductList products={filteredProducts} />;
};
```

#### Custom Hook Caching
```javascript
const useProductCache = () => {
  const [cache, setCache] = useState(new Map());
  
  const getProduct = useCallback((productId) => {
    if (cache.has(productId)) {
      return cache.get(productId);
    }
    return null;
  }, [cache]);
  
  const setProduct = useCallback((productId, product) => {
    setCache(prev => new Map(prev).set(productId, product));
  }, []);
  
  return { getProduct, setProduct };
};
```

### 2. State-Based Caching

#### Redux Normalized State
```javascript
// Normalized state structure for efficient caching
const initialState = {
  entities: {
    products: {},
    categories: {},
    users: {}
  },
  ui: {
    loading: {},
    errors: {}
  },
  cache: {
    lastUpdated: {},
    ttl: {}
  }
};

// Selectors with memoization
const selectProductById = createSelector(
  [selectProducts, (state, productId) => productId],
  (products, productId) => products[productId]
);
```

## TanStack Query for Server State Management

### 1. Basic Implementation

#### Setup and Configuration
```javascript
// queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data for 10 minutes
      cacheTime: 10 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Refetch on window focus
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
  },
});
```

#### Query Implementation
```javascript
// useProductQuery.js
import { useQuery, useQueryClient } from '@tanstack/react-query';

const useProductQuery = (productId) => {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}`);
      if (!response.ok) throw new Error('Product not found');
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!productId,
  });
};

// Usage in component
const ProductDetail = ({ productId }) => {
  const { data: product, isLoading, error } = useProductQuery(productId);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <ProductDisplay product={product} />;
};
```

### 2. Advanced Caching Patterns

#### Dependent Queries
```javascript
const useProductWithReviews = (productId) => {
  // Primary query
  const productQuery = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });
  
  // Dependent query - only runs when product is loaded
  const reviewsQuery = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchProductReviews(productId),
    enabled: !!productQuery.data,
  });
  
  return {
    product: productQuery.data,
    reviews: reviewsQuery.data,
    isLoading: productQuery.isLoading || reviewsQuery.isLoading,
  };
};
```

#### Infinite Queries for Pagination
```javascript
const useProductListInfinite = (filters) => {
  return useInfiniteQuery({
    queryKey: ['products', filters],
    queryFn: ({ pageParam = 0 }) => 
      fetchProducts({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000,
  });
};
```

#### Optimistic Updates
```javascript
const useUpdateProductMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProduct,
    onMutate: async (newProduct) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['product', newProduct.id]);
      
      // Snapshot previous value
      const previousProduct = queryClient.getQueryData(['product', newProduct.id]);
      
      // Optimistically update
      queryClient.setQueryData(['product', newProduct.id], newProduct);
      
      return { previousProduct };
    },
    onError: (err, newProduct, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ['product', newProduct.id],
        context.previousProduct
      );
    },
    onSettled: (data, error, variables) => {
      // Refetch after mutation
      queryClient.invalidateQueries(['product', variables.id]);
    },
  });
};
```

## RTK Query for Redux-Based Caching

### 1. API Slice Setup

#### Basic API Configuration
```javascript
// api/productsApi.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const productsApi = createApi({
  reducerPath: 'productsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/products',
    prepareHeaders: (headers, { getState }) => {
      const token = getState().auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Product', 'Category'],
  endpoints: (builder) => ({
    getProducts: builder.query({
      query: (filters) => ({
        url: '',
        params: filters,
      }),
      providesTags: ['Product'],
      // Transform response
      transformResponse: (response) => response.data,
      // Cache for 5 minutes
      keepUnusedDataFor: 300,
    }),
    getProductById: builder.query({
      query: (id) => `/${id}`,
      providesTags: (result, error, id) => [{ type: 'Product', id }],
    }),
    updateProduct: builder.mutation({
      query: ({ id, ...patch }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: patch,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Product', id }],
    }),
  }),
});

export const { 
  useGetProductsQuery, 
  useGetProductByIdQuery, 
  useUpdateProductMutation 
} = productsApi;
```

### 2. Advanced RTK Query Patterns

#### Conditional Queries
```javascript
const ProductComponent = ({ productId, shouldFetch }) => {
  const { data: product, isLoading } = useGetProductByIdQuery(productId, {
    skip: !shouldFetch || !productId,
    refetchOnMountOrArgChange: true,
  });
  
  return product ? <ProductDetails product={product} /> : null;
};
```

#### Manual Cache Management
```javascript
const useProductCache = () => {
  const dispatch = useDispatch();
  
  const prefetchProduct = useCallback((productId) => {
    dispatch(productsApi.util.prefetch('getProductById', productId));
  }, [dispatch]);
  
  const invalidateProduct = useCallback((productId) => {
    dispatch(productsApi.util.invalidateTags([{ type: 'Product', id: productId }]));
  }, [dispatch]);
  
  return { prefetchProduct, invalidateProduct };
};
```

#### Streaming Updates
```javascript
const useProductUpdates = (productId) => {
  const dispatch = useDispatch();
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/products/${productId}/updates`);
    
    eventSource.onmessage = (event) => {
      const updatedProduct = JSON.parse(event.data);
      
      // Update cache directly
      dispatch(
        productsApi.util.updateQueryData('getProductById', productId, (draft) => {
          Object.assign(draft, updatedProduct);
        })
      );
    };
    
    return () => eventSource.close();
  }, [productId, dispatch]);
};
```

## HTTP Caching Best Practices

### 1. Cache Headers Configuration

#### Static Assets
```javascript
// webpack.config.js - Asset caching
module.exports = {
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].chunk.js',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};

// Server configuration (Express.js)
app.use('/static', express.static('public', {
  maxAge: '1y', // Cache for 1 year
  etag: true,
  lastModified: true,
}));
```

#### API Response Caching
```javascript
// API middleware for caching headers
const setCacheHeaders = (req, res, next) => {
  // Product data - cache for 10 minutes
  if (req.path.startsWith('/api/products')) {
    res.set('Cache-Control', 'public, max-age=600');
    res.set('ETag', generateETag(req.path));
  }
  
  // User-specific data - no cache
  if (req.path.startsWith('/api/user')) {
    res.set('Cache-Control', 'private, no-cache');
  }
  
  next();
};
```

### 2. Service Worker Implementation

#### Basic Service Worker
```javascript
// sw.js
const CACHE_NAME = 'mfe-cache-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/api/products/categories',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});
```

#### Advanced Service Worker with Strategies
```javascript
// sw-strategies.js
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { registerRoute } from 'workbox-routing';

// Cache static assets
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [{
      cacheKeyWillBeUsed: async ({ request }) => {
        return `${request.url}?version=${BUILD_VERSION}`;
      }
    }]
  })
);

// Network first for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        return response.status === 200 ? response : null;
      }
    }]
  })
);

// Stale while revalidate for products
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/products'),
  new StaleWhileRevalidate({
    cacheName: 'products-cache',
  })
);
```

## Browser Storage Strategies

### 1. localStorage Implementation

#### Storage Utilities
```javascript
// utils/storage.js
class StorageManager {
  constructor(storageType = 'localStorage') {
    this.storage = window[storageType];
    this.prefix = 'mfe_';
  }
  
  set(key, value, ttl = null) {
    const item = {
      value,
      timestamp: Date.now(),
      ttl
    };
    
    try {
      this.storage.setItem(this.prefix + key, JSON.stringify(item));
      return true;
    } catch (error) {
      console.warn('Storage quota exceeded', error);
      this.cleanup();
      return false;
    }
  }
  
  get(key) {
    try {
      const item = JSON.parse(this.storage.getItem(this.prefix + key));
      
      if (!item) return null;
      
      // Check TTL
      if (item.ttl && (Date.now() - item.timestamp) > item.ttl) {
        this.remove(key);
        return null;
      }
      
      return item.value;
    } catch (error) {
      console.warn('Storage read error', error);
      return null;
    }
  }
  
  remove(key) {
    this.storage.removeItem(this.prefix + key);
  }
  
  cleanup() {
    const keys = Object.keys(this.storage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        const item = this.get(key.replace(this.prefix, ''));
        if (!item) {
          this.storage.removeItem(key);
        }
      }
    });
  }
}

export const localStorage = new StorageManager('localStorage');
export const sessionStorage = new StorageManager('sessionStorage');
```

### 2. IndexedDB Implementation

#### Database Setup
```javascript
// db/indexedDB.js
class IndexedDBManager {
  constructor(dbName, version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }
  
  async set(storeName, data) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.put(data);
  }
  
  async get(storeName, key) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  async getAll(storeName, indexName = null, query = null) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    
    return new Promise((resolve, reject) => {
      const request = source.getAll(query);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const productDB = new IndexedDBManager('ProductCache');
```

## CDN and Asset Caching

### 1. CDN Configuration

#### CloudFront Setup
```javascript
// CDN configuration for static assets
const cdnConfig = {
  // Long-term caching for versioned assets
  static: {
    cacheBehavior: {
      targetOriginId: 'static-assets',
      pathPattern: '/static/*',
      cachePolicyId: 'long-term-cache', // 1 year
      compress: true,
    }
  },
  
  // Short-term caching for API responses
  api: {
    cacheBehavior: {
      targetOriginId: 'api-server',
      pathPattern: '/api/*',
      cachePolicyId: 'short-term-cache', // 5 minutes
      allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
    }
  }
};
```

### 2. Asset Optimization

#### Image Optimization
```javascript
// Image caching and optimization
const ImageCache = {
  cache: new Map(),
  
  async getOptimizedImage(src, options = {}) {
    const cacheKey = `${src}-${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const optimizedSrc = await this.optimizeImage(src, options);
    this.cache.set(cacheKey, optimizedSrc);
    
    return optimizedSrc;
  },
  
  optimizeImage(src, { width, height, quality = 80, format = 'webp' }) {
    // Use image optimization service or generate responsive URLs
    const params = new URLSearchParams({
      w: width,
      h: height,
      q: quality,
      f: format,
    });
    
    return `${CDN_BASE_URL}/images/${src}?${params}`;
  }
};
```

## Cache Invalidation Strategies

### 1. Time-Based Invalidation

#### TTL Implementation
```javascript
// Time-based cache invalidation
class TTLCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }
  
  set(key, value, ttl) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    // Set cache value
    this.cache.set(key, value);
    
    // Set TTL timer
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
  }
  
  get(key) {
    return this.cache.get(key);
  }
  
  invalidate(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }
}
```

### 2. Event-Based Invalidation

#### WebSocket Integration
```javascript
// Real-time cache invalidation
class RealtimeCacheManager {
  constructor() {
    this.subscribers = new Map();
    this.setupWebSocket();
  }
  
  setupWebSocket() {
    this.ws = new WebSocket(WS_CACHE_INVALIDATION_URL);
    
    this.ws.onmessage = (event) => {
      const { type, key, data } = JSON.parse(event.data);
      
      switch (type) {
        case 'INVALIDATE':
          this.invalidateCache(key);
          break;
        case 'UPDATE':
          this.updateCache(key, data);
          break;
        case 'CLEAR':
          this.clearCache(key);
          break;
      }
    };
  }
  
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
  }
  
  invalidateCache(key) {
    // Invalidate in all cache layers
    queryClient.invalidateQueries([key]);
    localStorage.remove(key);
    
    // Notify subscribers
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(callback => callback());
    }
  }
}
```

## Cross-MFE Cache Coordination

### 1. Shared Cache State

#### Cross-MFE State Management
```javascript
// shared-cache.js
class SharedCacheManager {
  constructor() {
    this.channel = new BroadcastChannel('mfe-cache');
    this.localCache = new Map();
    
    this.channel.onmessage = (event) => {
      const { type, key, value, source } = event.data;
      
      // Don't process our own messages
      if (source === window.location.pathname) return;
      
      switch (type) {
        case 'SET':
          this.localCache.set(key, value);
          break;
        case 'DELETE':
          this.localCache.delete(key);
          break;
        case 'CLEAR':
          this.localCache.clear();
          break;
      }
    };
  }
  
  set(key, value) {
    this.localCache.set(key, value);
    this.broadcast('SET', key, value);
  }
  
  get(key) {
    return this.localCache.get(key);
  }
  
  delete(key) {
    this.localCache.delete(key);
    this.broadcast('DELETE', key);
  }
  
  broadcast(type, key, value = null) {
    this.channel.postMessage({
      type,
      key,
      value,
      source: window.location.pathname,
      timestamp: Date.now()
    });
  }
}

export const sharedCache = new SharedCacheManager();
```

### 2. Cache Synchronization

#### Event-Driven Sync
```javascript
// cache-sync.js
class CacheSynchronizer {
  constructor() {
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  async syncCache(mfeName, cacheData) {
    if (!this.isOnline) {
      this.syncQueue.push({ mfeName, cacheData });
      return;
    }
    
    try {
      await fetch('/api/cache/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfeName, cacheData })
      });
    } catch (error) {
      console.error('Cache sync failed:', error);
      this.syncQueue.push({ mfeName, cacheData });
    }
  }
  
  async processSyncQueue() {
    while (this.syncQueue.length > 0 && this.isOnline) {
      const { mfeName, cacheData } = this.syncQueue.shift();
      await this.syncCache(mfeName, cacheData);
    }
  }
}
```

## Performance Optimization

### 1. Bundle Optimization

#### Code Splitting by Route
```javascript
// Route-based code splitting
const CartMFE = lazy(() => import('./mfe/CartMFE'));
const CheckoutMFE = lazy(() => import('./mfe/CheckoutMFE'));
const ProductMFE = lazy(() => import('./mfe/ProductMFE'));

const AppRouter = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/cart/*" element={<CartMFE />} />
        <Route path="/checkout/*" element={<CheckoutMFE />} />
        <Route path="/product/*" element={<ProductMFE />} />
      </Routes>
    </Suspense>
  </Router>
);
```

#### Component-Level Splitting
```javascript
// Component lazy loading with cache
const ComponentCache = new Map();

const loadComponent = async (componentName) => {
  if (ComponentCache.has(componentName)) {
    return ComponentCache.get(componentName);
  }
  
  const component = await import(`./components/${componentName}`);
  ComponentCache.set(componentName, component);
  
  return component;
};
```

### 2. Request Optimization

#### Request Deduplication
```javascript
// Deduplicate identical requests
class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }
  
  async request(url, options = {}) {
    const key = `${url}-${JSON.stringify(options)}`;
    
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    const promise = fetch(url, options)
      .then(response => response.json())
      .finally(() => {
        this.pendingRequests.delete(key);
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
}

export const deduplicator = new RequestDeduplicator();
```

## Cache Warming and Prefetching

### 1. Predictive Prefetching

#### User Behavior Analysis
```javascript
// Predictive prefetching based on user behavior
class PredictivePrefetcher {
  constructor() {
    this.userBehavior = new Map();
    this.prefetchQueue = new Set();
  }
  
  trackNavigation(from, to) {
    if (!this.userBehavior.has(from)) {
      this.userBehavior.set(from, new Map());
    }
    
    const destinations = this.userBehavior.get(from);
    const count = destinations.get(to) || 0;
    destinations.set(to, count + 1);
    
    // Prefetch likely next destinations
    this.schedulePrefetch(from);
  }
  
  schedulePrefetch(currentPage) {
    const destinations = this.userBehavior.get(currentPage);
    if (!destinations) return;
    
    // Sort by frequency and prefetch top destinations
    const sorted = Array.from(destinations.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    sorted.forEach(([destination]) => {
      this.prefetchPage(destination);
    });
  }
  
  async prefetchPage(route) {
    if (this.prefetchQueue.has(route)) return;
    
    this.prefetchQueue.add(route);
    
    // Prefetch route component
    await import(`./pages/${route}`);
    
    // Prefetch route data
    const routeData = await this.getRouteData(route);
    queryClient.setQueryData([route], routeData);
  }
}
```

### 2. Critical Resource Prefetching

#### Above-the-fold Content
```javascript
// Critical resource prefetching
const criticalResourcePrefetcher = {
  async prefetchCriticalResources() {
    // Prefetch critical API calls
    const criticalQueries = [
      'user-profile',
      'navigation-menu',
      'featured-products'
    ];
    
    await Promise.all(
      criticalQueries.map(query => 
        queryClient.prefetchQuery(query, () => this.fetchCriticalData(query))
      )
    );
  },
  
  prefetchOnIdle() {
    // Use requestIdleCallback for non-critical prefetching
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.prefetchSecondaryResources();
      });
    } else {
      setTimeout(() => this.prefetchSecondaryResources(), 100);
    }
  }
};
```

## Memory Management and Limits

### 1. Memory Monitoring

#### Memory Usage Tracking
```javascript
// Memory usage monitoring
class MemoryManager {
  constructor() {
    this.memoryThreshold = 50 * 1024 * 1024; // 50MB
    this.checkInterval = 30000; // 30 seconds
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }
  
  checkMemoryUsage() {
    if ('memory' in performance) {
      const memoryInfo = performance.memory;
      const usage = memoryInfo.usedJSHeapSize;
      
      if (usage > this.memoryThreshold) {
        this.performCleanup();
      }
    }
  }
  
  performCleanup() {
    // Clear old cache entries
    this.clearOldCacheEntries();
    
    // Clear unused component instances
    this.clearUnusedComponents();
    
    // Force garbage collection (if available)
    if (window.gc) {
      window.gc();
    }
  }
  
  clearOldCacheEntries() {
    const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes
    
    queryClient.getQueryCache().getAll().forEach(query => {
      if (query.state.dataUpdatedAt < cutoffTime) {
        queryClient.removeQueries(query.queryKey);
      }
    });
  }
}
```

### 2. Cache Size Limits

#### LRU Cache Implementation
```javascript
// LRU Cache with size limits
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.clear();
  }
}
```

## Offline Functionality

### 1. Service Worker Offline Support

#### Offline-First Strategy
```javascript
// Offline-first service worker
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Handle API requests
  if (request.url.includes('/api/')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // Return cached response
            return response;
          }
          
          // Try network
          return fetch(request)
            .then(networkResponse => {
              // Cache successful responses
              if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open('api-cache').then(cache => {
                  cache.put(request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              // Return offline fallback
              return new Response(
                JSON.stringify({ error: 'Offline mode' }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            });
        })
    );
  }
});
```

### 2. Background Sync

#### Offline Queue Management
```javascript
// Offline operation queue
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  addOperation(operation) {
    this.queue.push({
      ...operation,
      timestamp: Date.now(),
      id: generateUniqueId()
    });
    
    if (this.isOnline) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    while (this.queue.length > 0 && this.isOnline) {
      const operation = this.queue.shift();
      
      try {
        await this.executeOperation(operation);
      } catch (error) {
        console.error('Operation failed:', error);
        // Re-queue on failure
        this.queue.unshift(operation);
        break;
      }
    }
  }
  
  async executeOperation(operation) {
    const { type, url, method, data } = operation;
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }
}
```

## Implementation Guidelines

### 1. Cache Strategy Selection

#### Decision Matrix
```javascript
// Cache strategy decision helper
const selectCacheStrategy = (resourceType, updateFrequency, userSpecific) => {
  const strategies = {
    'static-assets': {
      strategy: 'CacheFirst',
      duration: '1year',
      storage: 'Service Worker'
    },
    
    'user-data': {
      strategy: 'NetworkFirst',
      duration: '5min',
      storage: 'Memory + IndexedDB'
    },
    
    'product-catalog': {
      strategy: 'StaleWhileRevalidate',
      duration: '1hour',
      storage: 'TanStack Query'
    },
    
    'real-time-data': {
      strategy: 'NetworkOnly',
      duration: 'none',
      storage: 'none'
    }
  };
  
  // Decision logic based on resource characteristics
  if (resourceType === 'static' && updateFrequency === 'never') {
    return strategies['static-assets'];
  }
  
  if (userSpecific && updateFrequency === 'high') {
    return strategies['user-data'];
  }
  
  if (updateFrequency === 'medium') {
    return strategies['product-catalog'];
  }
  
  return strategies['real-time-data'];
};
```

### 2. Performance Budgets

#### Cache Size Monitoring
```javascript
// Performance budget enforcement
class PerformanceBudget {
  constructor() {
    this.budgets = {
      totalCacheSize: 100 * 1024 * 1024, // 100MB
      queryCache: 50 * 1024 * 1024,      // 50MB
      localStorage: 10 * 1024 * 1024,    // 10MB
      sessionStorage: 5 * 1024 * 1024,   // 5MB
    };
  }
  
  checkBudget() {
    const usage = this.getCurrentUsage();
    
    Object.keys(this.budgets).forEach(key => {
      const budget = this.budgets[key];
      const currentUsage = usage[key];
      
      if (currentUsage > budget) {
        console.warn(`Budget exceeded: ${key} using ${currentUsage}, budget: ${budget}`);
        this.enforceBudget(key);
      }
    });
  }
  
  enforceBudget(cacheType) {
    switch (cacheType) {
      case 'queryCache':
        queryClient.clear();
        break;
      case 'localStorage':
        localStorage.cleanup();
        break;
      case 'sessionStorage':
        sessionStorage.cleanup();
        break;
    }
  }
}
```

## Monitoring and Debugging

### 1. Cache Analytics

#### Performance Metrics
```javascript
// Cache performance monitoring
class CacheAnalytics {
  constructor() {
    this.metrics = {
      hitRate: 0,
      missRate: 0,
      avgResponseTime: 0,
      cacheSize: 0,
      evictionCount: 0
    };
  }
  
  recordHit(key, responseTime) {
    this.metrics.hitRate++;
    this.updateAvgResponseTime(responseTime);
    
    // Send to analytics service
    this.sendMetric('cache.hit', {
      key,
      responseTime,
      timestamp: Date.now()
    });
  }
  
  recordMiss(key, responseTime) {
    this.metrics.missRate++;
    this.updateAvgResponseTime(responseTime);
    
    this.sendMetric('cache.miss', {
      key,
      responseTime,
      timestamp: Date.now()
    });
  }
  
  getHitRatio() {
    const total = this.metrics.hitRate + this.metrics.missRate;
    return total > 0 ? this.metrics.hitRate / total : 0;
  }
  
  generateReport() {
    return {
      hitRatio: this.getHitRatio(),
      avgResponseTime: this.metrics.avgResponseTime,
      cacheSize: this.metrics.cacheSize,
      evictionCount: this.metrics.evictionCount,
      timestamp: Date.now()
    };
  }
}
```

### 2. Debug Tools

#### Cache Inspector
```javascript
// Cache debugging utilities
const CacheDebugger = {
  inspectQueryCache() {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return queries.map(query => ({
      key: query.queryKey,
      state: query.state,
      observers: query.observers.length,
      dataUpdatedAt: new Date(query.state.dataUpdatedAt),
      isStale: query.isStale()
    }));
  },
  
  inspectLocalStorage() {
    const items = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      
      try {
        items[key] = JSON.parse(value);
      } catch {
        items[key] = value;
      }
    }
    return items;
  },
  
  clearAllCaches() {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
  }
};

// Expose in development
if (process.env.NODE_ENV === 'development') {
  window.CacheDebugger = CacheDebugger;
}
```

## Best Practices Summary

### 1. Cache Strategy Guidelines

- **Use TanStack Query for server state management** - Provides excellent defaults and automatic cache management
- **Implement RTK Query for Redux-based applications** - Maintains consistency with existing Redux patterns
- **Apply appropriate cache strategies** - CacheFirst for static assets, NetworkFirst for user data, StaleWhileRevalidate for product data
- **Set reasonable TTL values** - Balance between performance and data freshness
- **Monitor cache performance** - Track hit rates, response times, and memory usage

### 2. Performance Optimization

- **Implement code splitting** - Load only necessary code for each MFE
- **Use request deduplication** - Prevent duplicate API calls
- **Prefetch critical resources** - Improve perceived performance
- **Implement memory management** - Prevent memory leaks and excessive usage
- **Use service workers** - Enable offline functionality and advanced caching

### 3. Cross-MFE Coordination

- **Implement shared cache state** - Coordinate cache between MFEs
- **Use event-driven invalidation** - Keep cache synchronized across applications
- **Implement cache synchronization** - Handle offline/online scenarios
- **Monitor cache budgets** - Prevent excessive memory usage

### 4. Development Guidelines

- **Use consistent cache keys** - Ensure predictable cache behavior
- **Implement proper error handling** - Graceful fallbacks for cache failures
- **Add comprehensive logging** - Debug cache issues effectively
- **Test offline scenarios** - Ensure robust offline functionality
- **Document cache strategies** - Maintain team knowledge and consistency

This comprehensive caching strategy will significantly improve the performance and user experience of our microfrontend architecture while maintaining scalability and reliability.