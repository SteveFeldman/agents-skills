# JavaScript CLAUDE.md - Comprehensive Development Guidelines

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Code Style & Conventions](#code-style--conventions)
4. [Performance Guidelines](#performance-guidelines)
5. [Security Best Practices](#security-best-practices)
6. [Scalability Patterns](#scalability-patterns)
7. [Design Patterns](#design-patterns)
8. [Testing Strategy](#testing-strategy)
9. [Caching Strategy](#caching-strategy)
10. [Error Handling](#error-handling)
11. [Development Workflow](#development-workflow)
12. [Code Review Checklist](#code-review-checklist)

## Overview

This document provides comprehensive guidelines for JavaScript development in microfrontend (MFE) architecture. Based on analysis of existing codebases including cart-mfe, checkout-mfe, product-mfe, homepage-mfe, and common-mfe, these guidelines ensure consistency, maintainability, and scalability across all applications.

## Architecture Principles

### Microfrontend Architecture

**ALWAYS implement microfrontends with these principles:**

```javascript
// ✅ GOOD - Independent deployment capability
const MFEApp = () => {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Initialize MFE independently
    initializeMFE().then(() => setIsReady(true));
  }, []);
  
  if (!isReady) return <LoadingSpinner />;
  
  return <App />;
};
```

**DO:**
- Build each MFE as an independent, deployable unit
- Use event-driven communication between MFEs
- Implement fault isolation with error boundaries
- Share common dependencies through `common-mfe` package
- Use consistent base architecture (`@org/base-mfe`)

**DON'T:**
- Create tight coupling between MFEs
- Share state directly across MFE boundaries
- Deploy multiple MFEs together

### State Management Architecture

**ALWAYS use Redux with this structure:**

```javascript
// Feature-based organization
src/
├── features/
│   ├── cart/
│   │   ├── cartSlice.js      // Redux Toolkit slice
│   │   ├── cartSelectors.js  // Memoized selectors
│   │   └── cartTypes.js      // TypeScript types
│   └── products/
│       ├── productsSlice.js
│       └── productsSelectors.js
```

```javascript
// ✅ GOOD - Redux Toolkit slice
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await productAPI.getProducts(filters);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {
    clearProducts: (state) => {
      state.items = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});
```

## Code Style & Conventions

### JavaScript/React Standards

**ALWAYS follow these conventions:**

```javascript
// ✅ GOOD - Modern React component structure
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import PropTypes from 'prop-types';

const ProductCard = ({ product, onAddToCart }) => {
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  
  const handleAddToCart = useCallback(async () => {
    setIsLoading(true);
    try {
      await onAddToCart(product);
    } finally {
      setIsLoading(false);
    }
  }, [product, onAddToCart]);
  
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button 
        onClick={handleAddToCart}
        disabled={isLoading}
        aria-label={`Add ${product.name} to cart`}
      >
        {isLoading ? 'Adding...' : 'Add to Cart'}
      </button>
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    image: PropTypes.string.isRequired
  }).isRequired,
  onAddToCart: PropTypes.func.isRequired
};

export default React.memo(ProductCard);
```

### Naming Conventions

**ALWAYS use these naming patterns:**

```javascript
// ✅ GOOD - Consistent naming
// Components: PascalCase
const ProductList = () => {};
const CartSummary = () => {};

// Functions and variables: camelCase
const fetchUserData = () => {};
const isAuthenticated = true;

// Constants: SCREAMING_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_COUNT = 3;

// Files match component names
ProductList.js
CartSummary.js
userUtils.js
constants.js
```

### File Organization

**ALWAYS organize files by feature:**

```
src/
├── features/
│   ├── cart/
│   │   ├── components/
│   │   │   ├── CartItem/
│   │   │   │   ├── CartItem.js
│   │   │   │   ├── CartItem.test.js
│   │   │   │   └── CartItem.scss
│   │   │   └── CartSummary/
│   │   ├── hooks/
│   │   │   └── useCart.js
│   │   ├── services/
│   │   │   └── cartAPI.js
│   │   ├── cartSlice.js
│   │   └── cartSelectors.js
```

## Performance Guidelines

### Component Optimization

**ALWAYS optimize components for performance:**

```javascript
// ✅ GOOD - Memoized component with optimized props
const ProductCard = React.memo(({ product, onAddToCart }) => {
  const handleClick = useCallback(() => {
    onAddToCart(product);
  }, [product, onAddToCart]);
  
  return (
    <div className="product-card">
      {/* Component content */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimization
  return prevProps.product.id === nextProps.product.id &&
         prevProps.product.updatedAt === nextProps.product.updatedAt;
});

// ✅ GOOD - Expensive calculations with useMemo
const ProductList = ({ products, filters }) => {
  const filteredProducts = useMemo(() => {
    return products
      .filter(product => filters.category ? 
        product.category === filters.category : true)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filters]);
  
  return (
    <div>
      {filteredProducts.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};
```

### Bundle Optimization

**ALWAYS implement code splitting:**

```javascript
// ✅ GOOD - Route-based code splitting
const CartMFE = lazy(() => import('./mfe/CartMFE'));
const CheckoutMFE = lazy(() => import('./mfe/CheckoutMFE'));

const AppRouter = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/cart/*" element={<CartMFE />} />
        <Route path="/checkout/*" element={<CheckoutMFE />} />
      </Routes>
    </Suspense>
  </Router>
);

// ✅ GOOD - Component-level lazy loading
const ExpensiveChart = lazy(() => import('./ExpensiveChart'));

const Dashboard = () => {
  const [showChart, setShowChart] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <ExpensiveChart />
        </Suspense>
      )}
    </div>
  );
};
```

### Performance Budgets

**ALWAYS enforce these limits:**

```javascript
// webpack.config.js
module.exports = {
  performance: {
    maxAssetSize: 500000, // 500KB
    maxEntrypointSize: 500000,
    hints: 'error'
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          enforce: true
        }
      }
    }
  }
};
```

## Security Best Practices

### Input Validation & Sanitization

**ALWAYS validate and sanitize user input:**

```javascript
// ✅ GOOD - Input validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

// ✅ GOOD - Form with validation
const ContactForm = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const sanitizedEmail = sanitizeInput(email);
    if (!validateEmail(sanitizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Submit form
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Submit</button>
    </form>
  );
};
```

### XSS Prevention

**ALWAYS prevent XSS attacks:**

```javascript
// ✅ GOOD - Safe HTML rendering with DOMPurify
import DOMPurify from 'dompurify';

const SafeHTML = ({ html }) => {
  const sanitizedHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
  
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
};

// ✅ GOOD - Escape HTML in template literals
const escapeHTML = (str) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
```

### Authentication & Authorization

**ALWAYS handle auth securely:**

```javascript
// ✅ GOOD - Secure token management
const tokenManager = {
  getToken: () => {
    // Prefer httpOnly cookies over localStorage
    return getCookie('auth_token') || sessionStorage.getItem('auth_token');
  },
  
  setToken: (token) => {
    setCookie('auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 3600
    });
  },
  
  removeToken: () => {
    removeCookie('auth_token');
    sessionStorage.removeItem('auth_token');
  }
};

// ✅ GOOD - API request with auth
axios.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add CSRF token for state-changing requests
  if (['post', 'put', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = getCsrfToken();
  }
  
  return config;
});
```

## Scalability Patterns

### Feature-Based Architecture

**ALWAYS organize by features, not technical layers:**

```javascript
// ✅ GOOD - Feature-based structure
src/
├── features/
│   ├── cart/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── cartSlice.js
│   │   └── index.js
│   └── products/
├── shared/
│   ├── components/
│   ├── hooks/
│   └── utils/
```

### Component Composition

**ALWAYS favor composition over inheritance:**

```javascript
// ✅ GOOD - Higher-order component for authentication
const withAuth = (WrappedComponent) => {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth();
    
    if (loading) return <LoadingSpinner />;
    if (!user) return <LoginPrompt />;
    
    return <WrappedComponent {...props} user={user} />;
  };
};

// ✅ GOOD - Compound component pattern
const Modal = ({ children, isOpen, onClose }) => {
  return isOpen ? (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  ) : null;
};

Modal.Header = ({ children }) => <div className="modal-header">{children}</div>;
Modal.Body = ({ children }) => <div className="modal-body">{children}</div>;
Modal.Footer = ({ children }) => <div className="modal-footer">{children}</div>;
```

### Module Federation

**ALWAYS share code efficiently between MFEs:**

```javascript
// webpack.config.js - Module Federation
const ModuleFederationPlugin = require('@module-federation/webpack');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'cart_mfe',
      exposes: {
        './CartComponent': './src/components/Cart',
        './cartReducer': './src/store/cartSlice'
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        '@org/base-mfe': { singleton: true }
      }
    })
  ]
};
```

## Design Patterns

### Container/Presentational Pattern

**ALWAYS separate data logic from presentation:**

```javascript
// ✅ GOOD - Container component (smart)
const ProductListContainer = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  const handleProductSelect = useCallback((product) => {
    // Handle selection logic
  }, []);
  
  return (
    <ProductListPresentation
      products={products}
      loading={loading}
      error={error}
      onProductSelect={handleProductSelect}
    />
  );
};

// ✅ GOOD - Presentational component (dumb)
const ProductListPresentation = ({ products, loading, error, onProductSelect }) => {
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div className="product-list">
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => onProductSelect(product)}
        />
      ))}
    </div>
  );
};
```

### Custom Hooks Pattern

**ALWAYS extract reusable logic into custom hooks:**

```javascript
// ✅ GOOD - Custom hook for API data
const useApi = (url, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(url);
        const result = await response.json();
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, dependencies);
  
  return { data, loading, error };
};

// Usage
const ProductList = () => {
  const { data: products, loading, error } = useApi('/api/products');
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};
```

## Testing Strategy

### Unit Testing Standards

**ALWAYS achieve 80%+ test coverage:**

```javascript
// ✅ GOOD - Component test structure
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    price: 99.99,
    image: '/test-image.jpg'
  };

  it('renders product information correctly', () => {
    render(<ProductCard product={mockProduct} />);
    
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByAltText('Test Product')).toHaveAttribute('src', '/test-image.jpg');
  });

  it('calls onAddToCart when add button is clicked', () => {
    const mockOnAddToCart = jest.fn();
    render(<ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />);
    
    fireEvent.click(screen.getByText('Add to Cart'));
    expect(mockOnAddToCart).toHaveBeenCalledWith(mockProduct);
  });

  it('handles loading state correctly', () => {
    render(<ProductCard product={mockProduct} loading={true} />);
    expect(screen.getByText('Adding...')).toBeInTheDocument();
  });
});
```

### Redux Testing

**ALWAYS test actions and reducers:**

```javascript
// ✅ GOOD - Redux slice testing
import { cartReducer, addItem, removeItem } from './cartSlice';

describe('cartSlice', () => {
  const initialState = {
    items: [],
    total: 0,
    loading: false,
    error: null
  };

  it('should add item to cart', () => {
    const item = { id: '1', name: 'Test Product', price: 99.99, quantity: 1 };
    const action = addItem(item);
    const newState = cartReducer(initialState, action);

    expect(newState.items).toHaveLength(1);
    expect(newState.items[0]).toEqual(item);
    expect(newState.total).toBe(99.99);
  });

  it('should update existing item quantity', () => {
    const existingState = {
      ...initialState,
      items: [{ id: '1', name: 'Test Product', price: 99.99, quantity: 1 }],
      total: 99.99
    };
    const action = addItem({ id: '1', name: 'Test Product', price: 99.99, quantity: 2 });
    const newState = cartReducer(existingState, action);

    expect(newState.items[0].quantity).toBe(3);
    expect(newState.total).toBe(299.97);
  });
});
```

### Integration Testing

**ALWAYS test component integration with Redux:**

```javascript
// ✅ GOOD - Integration test with Redux
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { App } from '../App';
import cartReducer from '../features/cart/cartSlice';

const server = setupServer(
  rest.get('/api/products', (req, res, ctx) => {
    return res(ctx.json([
      { id: '1', name: 'Test Product', price: 99.99, inStock: true }
    ]));
  }),
  rest.post('/api/cart/add', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Product to Cart Integration', () => {
  it('should add product to cart from product listing', async () => {
    const store = configureStore({
      reducer: {
        cart: cartReducer
      }
    });
    
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    // Wait for products to load
    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    // Add product to cart
    fireEvent.click(screen.getByText('Add to Cart'));

    // Verify cart updated
    await waitFor(() => {
      expect(screen.getByText('1 item in cart')).toBeInTheDocument();
    });
  });
});
```

## Caching Strategy

### Client-Side Caching

**ALWAYS implement efficient caching:**

```javascript
// ✅ GOOD - TanStack Query for server state
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
    enabled: !!productId
  });
};

// ✅ GOOD - Memory-based component caching
const ProductCard = React.memo(({ product }) => {
  return <div>{product.name}</div>;
}, (prevProps, nextProps) => {
  return prevProps.product.id === nextProps.product.id &&
         prevProps.product.updatedAt === nextProps.product.updatedAt;
});
```

### HTTP Caching

**ALWAYS configure proper cache headers:**

```javascript
// ✅ GOOD - Service Worker caching strategy
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
```

## Error Handling

### Component Error Boundaries

**ALWAYS implement error boundaries:**

```javascript
// ✅ GOOD - Error boundary component
class MFEErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('MFE Error:', error, errorInfo);
    
    // Send to error tracking service
    if (window.errorTracker) {
      window.errorTracker.captureException(error, {
        extra: errorInfo,
        tags: { mfe: this.props.mfeName }
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong in {this.props.mfeName}</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### API Error Handling

**ALWAYS handle API errors gracefully:**

```javascript
// ✅ GOOD - Axios error interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const userError = {
      message: 'An error occurred. Please try again.',
      code: 'GENERIC_ERROR',
      timestamp: Date.now()
    };
    
    if (error.response?.status === 401) {
      tokenManager.removeToken();
      window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      userError.message = 'Server error. Please try again later.';
    }
    
    // Log full error details for developers
    console.error('API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url
    });
    
    return Promise.reject(userError);
  }
);
```

## Development Workflow

### Git Workflow

**ALWAYS follow this commit process:**

```bash
# Create feature branch
git checkout -b feature/product-search

# Make changes with proper commit messages
git commit -m "feat(products): add search functionality

- Add search input component
- Implement debounced search API calls
- Add search results filtering

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push and create PR
git push -u origin feature/product-search
gh pr create --title "Add product search functionality" --body "..."
```

### Code Quality Gates

**ALWAYS enforce these quality checks:**

```json
// package.json
{
  "scripts": {
    "lint": "eslint src/ --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src/ --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "type-check": "tsc --noEmit",
    "build": "webpack --mode production",
    "analyze": "webpack-bundle-analyzer build/static/js/*.js"
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test && npm run type-check"
    }
  },
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests"
    ]
  }
}
```

## Code Review Checklist

### Architecture & Design

- [ ] Component follows single responsibility principle
- [ ] Proper separation between container and presentational components
- [ ] State management follows Redux patterns
- [ ] Event handlers use proper naming (handle prefix)
- [ ] Components are properly memoized when needed

### Performance

- [ ] Bundle size impact considered
- [ ] Code splitting implemented where appropriate
- [ ] React.memo used for expensive components
- [ ] useMemo/useCallback used appropriately
- [ ] Large lists use virtualization if needed

### Security

- [ ] No sensitive data in console.log
- [ ] User input is properly validated and sanitized
- [ ] XSS vulnerabilities addressed
- [ ] Authentication/authorization properly implemented
- [ ] Dependencies are up to date

### Testing

- [ ] Unit tests cover main functionality
- [ ] Integration tests for complex workflows
- [ ] Error states are tested
- [ ] Loading states are tested
- [ ] Accessibility tests included

### Code Quality

- [ ] Code follows established conventions
- [ ] Proper TypeScript/PropTypes usage
- [ ] No eslint errors or warnings
- [ ] Code is properly formatted
- [ ] Meaningful variable and function names

### Documentation

- [ ] Complex logic is commented
- [ ] API contracts are documented
- [ ] README updated if needed
- [ ] Breaking changes are noted

---

This CLAUDE.md serves as the definitive guide for JavaScript development in our microfrontend ecosystem. Always refer to this document when making architectural decisions, writing code, or reviewing pull requests. Regular updates ensure these guidelines evolve with our codebase and industry best practices.