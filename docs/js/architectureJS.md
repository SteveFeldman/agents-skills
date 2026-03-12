# JavaScript Architecture Standards & Best Practices

## Overview
This document outlines architectural standards and best practices for JavaScript applications, focusing on microfrontend architecture patterns derived from our existing codebase analysis and industry standards.

## Architecture Principles

### Microfrontend Architecture Foundations
- **Independent Deployment**: Each MFE can be built, tested, and deployed independently
- **Technology Agnostic**: Teams can choose optimal tech stacks for their domain
- **Fault Isolation**: Failures in one MFE don't cascade to others
- **Organizational Alignment**: Architecture reflects team boundaries and ownership

### System Design Patterns
- **Event-Driven Architecture**: Loose coupling through events and message passing
- **Domain-Driven Design**: Business capabilities drive architectural boundaries
- **API-First Design**: Well-defined contracts between services and MFEs
- **Progressive Enhancement**: Graceful degradation when components fail

## Current Architecture Analysis

### Strengths Identified
1. **Consistent Foundation**: All MFEs built on `@org/base-mfe`
2. **Shared Component Library**: Reusable components via `@org/shared-components`
3. **SSR Support**: Server-side rendering across all applications
4. **Redux Architecture**: Consistent state management patterns
5. **Build System**: Standardized webpack configurations

### Architectural Improvements Needed
1. **Module Federation**: Implement for better code sharing
2. **Event Architecture**: Standardize cross-MFE communication
3. **Error Boundaries**: Enhance fault isolation
4. **Testing Strategy**: Improve integration testing across MFEs

## Microfrontend Architecture Patterns

### Horizontal Split (Feature-Based)
```
┌─────────────────────────────────────────────────────┐
│                    Shell Application                 │
├─────────────────────────────────────────────────────┤
│  Header MFE  │  Navigation MFE  │  User Profile MFE │
├─────────────────────────────────────────────────────┤
│     Cart MFE     │    Search MFE    │  Products MFE  │
├─────────────────────────────────────────────────────┤
│              Content MFE / Homepage MFE              │
├─────────────────────────────────────────────────────┤
│                   Footer MFE                        │
└─────────────────────────────────────────────────────┘
```

### Vertical Split (Domain-Based)
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Product MFE   │ │   Cart MFE      │ │  Checkout MFE   │
│                 │ │                 │ │                 │
│ • Product List  │ │ • Add to Cart   │ │ • Payment       │
│ • Product Detail│ │ • Cart Summary  │ │ • Shipping      │
│ • Search        │ │ • Quantity Mgmt │ │ • Order Review  │
│ • Filters       │ │ • Wishlist      │ │ • Confirmation  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Integration Patterns

### 1. Build-Time Integration
```javascript
// webpack.config.js - Module Federation
const ModuleFederationPlugin = require('@module-federation/webpack');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        cartMfe: 'cartMfe@http://localhost:3001/remoteEntry.js',
        productMfe: 'productMfe@http://localhost:3002/remoteEntry.js',
        checkoutMfe: 'checkoutMfe@http://localhost:3003/remoteEntry.js'
      },
      shared: {
        react: { singleton: true, eager: true },
        'react-dom': { singleton: true, eager: true },
        '@org/base-mfe': { singleton: true }
      }
    })
  ]
};
```

### 2. Runtime Integration
```javascript
// Dynamic MFE loading
const loadMFE = async (mfeName, containerSelector) => {
  try {
    const container = document.querySelector(containerSelector);
    if (!container) throw new Error(`Container ${containerSelector} not found`);
    
    // Load remote module
    const module = await import(`${mfeName}/bootstrap`);
    
    // Mount MFE
    await module.mount(container, {
      initialState: getSharedState(),
      eventBus: getEventBus(),
      theme: getCurrentTheme()
    });
    
    console.log(`MFE ${mfeName} loaded successfully`);
  } catch (error) {
    console.error(`Failed to load MFE ${mfeName}:`, error);
    // Fallback to skeleton or default content
    renderFallback(containerSelector);
  }
};
```

### 3. Server-Side Integration
```javascript
// SSR MFE composition
const renderMFEsOnServer = async (req, res) => {
  const mfePromises = [
    renderMFE('header', { user: req.user }),
    renderMFE('navigation', { currentRoute: req.path }),
    renderMFE('content', { pageData: req.pageData }),
    renderMFE('footer', {})
  ];
  
  try {
    const [headerHTML, navHTML, contentHTML, footerHTML] = await Promise.all(mfePromises);
    
    const pageHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${req.pageData.title}</title>
          <link rel="stylesheet" href="/styles/common.css">
        </head>
        <body>
          <div id="header">${headerHTML}</div>
          <div id="navigation">${navHTML}</div>
          <div id="content">${contentHTML}</div>
          <div id="footer">${footerHTML}</div>
          <script src="/scripts/hydration.js"></script>
        </body>
      </html>
    `;
    
    res.send(pageHTML);
  } catch (error) {
    res.status(500).send('Server error');
  }
};
```

## Communication Patterns

### Event-Driven Communication
```javascript
// Event Bus Implementation
class MFEEventBus {
  constructor() {
    this.events = {};
  }
  
  subscribe(eventType, callback) {
    if (!this.events[eventType]) {
      this.events[eventType] = [];
    }
    this.events[eventType].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[eventType] = this.events[eventType].filter(cb => cb !== callback);
    };
  }
  
  publish(eventType, data) {
    if (this.events[eventType]) {
      this.events[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }
}

// Usage in MFEs
const eventBus = new MFEEventBus();

// Cart MFE publishes cart updates
eventBus.publish('cart:updated', { 
  items: cartItems, 
  total: calculateTotal(cartItems) 
});

// Header MFE subscribes to cart updates
eventBus.subscribe('cart:updated', (cartData) => {
  updateCartBadge(cartData.items.length);
});
```

### Shared State Management
```javascript
// Cross-MFE State Store
class CrossMFEStore {
  constructor() {
    this.state = {
      user: null,
      cart: { items: [], total: 0 },
      preferences: {},
      navigation: { currentRoute: '/' }
    };
    this.subscribers = [];
  }
  
  getState() {
    return { ...this.state };
  }
  
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notifySubscribers();
  }
  
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.state));
  }
}

// Usage in MFEs
const globalStore = new CrossMFEStore();

// Update from any MFE
globalStore.setState({ 
  cart: { items: newItems, total: newTotal } 
});

// Subscribe from any MFE
const unsubscribe = globalStore.subscribe((state) => {
  console.log('Global state updated:', state);
});
```

## Component Architecture

### Container-Presentation Pattern
```javascript
// Container Component (Connected to data/state)
const ProductListContainer = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchProducts();
  }, []);
  
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productApi.getProducts();
      setProducts(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ProductListPresentation 
      products={products}
      loading={loading}
      error={error}
      onRetry={fetchProducts}
    />
  );
};

// Presentation Component (Pure UI)
const ProductListPresentation = ({ products, loading, error, onRetry }) => {
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
  
  return (
    <div className="product-list">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};
```

### Higher-Order Components
```javascript
// HOC for MFE-specific functionality
const withMFEContext = (Component) => {
  return (props) => {
    const mfeContext = {
      eventBus: getEventBus(),
      globalStore: getGlobalStore(),
      theme: getCurrentTheme(),
      featureFlags: getFeatureFlags()
    };
    
    return <Component {...props} mfeContext={mfeContext} />;
  };
};

// HOC for error boundaries
const withErrorBoundary = (Component, fallbackComponent) => {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
    
    static getDerivedStateFromError(error) {
      return { hasError: true };
    }
    
    componentDidCatch(error, errorInfo) {
      console.error('MFE Error:', error, errorInfo);
      // Report to monitoring service
    }
    
    render() {
      if (this.state.hasError) {
        return fallbackComponent || <div>Something went wrong</div>;
      }
      
      return <Component {...this.props} />;
    }
  };
};
```

## Data Architecture

### API Gateway Pattern
```javascript
// Centralized API client
class APIClient {
  constructor(baseURL, options = {}) {
    this.client = axios.create({
      baseURL,
      timeout: options.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    this.setupInterceptors();
  }
  
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleAuthError();
        }
        return Promise.reject(error);
      }
    );
  }
  
  // API methods
  async get(url, params = {}) {
    const response = await this.client.get(url, { params });
    return response.data;
  }
  
  async post(url, data = {}) {
    const response = await this.client.post(url, data);
    return response.data;
  }
  
  async put(url, data = {}) {
    const response = await this.client.put(url, data);
    return response.data;
  }
  
  async delete(url) {
    const response = await this.client.delete(url);
    return response.data;
  }
}
```

### Data Caching Strategy
```javascript
// Multi-layer caching
class DataCache {
  constructor() {
    this.memoryCache = new Map();
    this.sessionCache = sessionStorage;
    this.localCache = localStorage;
  }
  
  async get(key, options = {}) {
    const { ttl = 300000, useSession = false, useLocal = false } = options;
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      if (Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
    }
    
    // Check session storage
    if (useSession) {
      const sessionData = this.sessionCache.getItem(key);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (Date.now() - parsed.timestamp < ttl) {
          return parsed.data;
        }
      }
    }
    
    // Check local storage
    if (useLocal) {
      const localData = this.localCache.getItem(key);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Date.now() - parsed.timestamp < ttl) {
          return parsed.data;
        }
      }
    }
    
    return null;
  }
  
  set(key, data, options = {}) {
    const { useSession = false, useLocal = false } = options;
    const cacheEntry = { data, timestamp: Date.now() };
    
    // Always cache in memory
    this.memoryCache.set(key, cacheEntry);
    
    // Optional session storage
    if (useSession) {
      this.sessionCache.setItem(key, JSON.stringify(cacheEntry));
    }
    
    // Optional local storage
    if (useLocal) {
      this.localCache.setItem(key, JSON.stringify(cacheEntry));
    }
  }
}
```

## Build Architecture

### Webpack Configuration
```javascript
// Common webpack configuration
const path = require('path');
const ModuleFederationPlugin = require('@module-federation/webpack');

module.exports = {
  entry: './src/index.js',
  mode: 'development',
  
  devServer: {
    port: 3001,
    hot: true,
    historyApiFallback: true
  },
  
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react', '@babel/preset-env']
          }
        }
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      }
    ]
  },
  
  plugins: [
    new ModuleFederationPlugin({
      name: 'cartMfe',
      filename: 'remoteEntry.js',
      exposes: {
        './CartComponent': './src/components/Cart',
        './cartReducer': './src/store/cartSlice'
      },
      shared: {
        react: { singleton: true, eager: true },
        'react-dom': { singleton: true, eager: true },
        '@org/base-mfe': { singleton: true }
      }
    })
  ]
};
```

### CI/CD Pipeline Architecture
```yaml
# .github/workflows/mfe-pipeline.yml
name: MFE Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run security audit
        run: npm audit --audit-level=high
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build MFE
        run: npm run build
      - name: Upload build artifacts
        uses: actions/upload-artifact@v2
        with:
          name: build-files
          path: dist/
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to CDN
        run: |
          # Deploy to CDN
          # Update service discovery
          # Notify other MFEs
```

## Implementation Guidelines

### MFE Development Standards
1. **Single Responsibility**: Each MFE owns a specific business domain
2. **API Contracts**: Well-defined interfaces between MFEs
3. **Error Boundaries**: Proper error isolation and recovery
4. **Performance Budgets**: Size and loading time constraints
5. **Accessibility**: WCAG compliance across all MFEs

### Testing Strategy
1. **Unit Tests**: Component and utility function testing
2. **Integration Tests**: Cross-MFE communication testing
3. **Contract Tests**: API and event contract validation
4. **E2E Tests**: Critical user journey testing
5. **Performance Tests**: Load and stress testing

## Action Items

### Immediate (Next Sprint)
1. Implement Module Federation for cart and product MFEs
2. Create standardized event communication patterns
3. Establish error boundary standards
4. Define API contract standards

### Short-term (Next Quarter)
1. Implement comprehensive monitoring and observability
2. Create MFE deployment pipeline
3. Establish performance budgets
4. Implement advanced caching strategies

### Long-term (Next 6 Months)
1. Implement service mesh for MFE communication
2. Create advanced deployment strategies (blue-green, canary)
3. Implement automated scaling based on load
4. Create comprehensive developer tooling

## Success Metrics
- **Independent Deployments**: 100% of MFEs can deploy independently
- **Fault Isolation**: < 1% cross-MFE failure propagation
- **Development Velocity**: 50% increase in feature delivery speed
- **System Reliability**: 99.9% uptime across all MFEs
- **Performance**: < 3 second load time for all MFEs