# JavaScript Design Patterns for Microfrontend Architecture

## Table of Contents
1. [React Component Patterns](#react-component-patterns)
2. [State Management Patterns](#state-management-patterns)
3. [Microfrontend-Specific Patterns](#microfrontend-specific-patterns)
4. [Code Organization Patterns](#code-organization-patterns)
5. [Performance Patterns](#performance-patterns)
6. [Communication Patterns](#communication-patterns)
7. [Implementation Guidelines](#implementation-guidelines)

## React Component Patterns

### 1. Container/Presentational Pattern

**Purpose:** Separates data management from rendering logic for better component reusability and testability.

**Implementation:**
```javascript
// Container Component (Smart Component)
const ProductListContainer = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchProducts().then(data => {
      setProducts(data);
      setLoading(false);
    });
  }, []);
  
  return (
    <ProductList 
      products={products} 
      loading={loading}
      onProductSelect={handleProductSelect}
    />
  );
};

// Presentational Component (Dumb Component)
const ProductList = ({ products, loading, onProductSelect }) => {
  if (loading) return <LoadingSpinner />;
  
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

**Benefits in Microfrontends:**
- Enables component sharing across different MFEs
- Simplifies testing of business logic vs. presentation
- Allows different MFEs to use the same presentational components with different data sources

### 2. Higher-Order Components (HOCs)

**Purpose:** Reuse component logic across multiple components without code duplication.

**Implementation:**
```javascript
// HOC for authentication
const withAuth = (WrappedComponent) => {
  return function AuthenticatedComponent(props) {
    const { user, loading } = useAuth();
    
    if (loading) return <LoadingSpinner />;
    if (!user) return <LoginPrompt />;
    
    return <WrappedComponent {...props} user={user} />;
  };
};

// Usage across MFEs
const SecureCheckout = withAuth(CheckoutComponent);
const SecureProfile = withAuth(ProfileComponent);
```

**Microfrontend Benefits:**
- Consistent cross-cutting concerns (auth, logging, error handling)
- Reusable across different MFEs
- Centralized logic updates

### 3. Render Props Pattern

**Purpose:** Share code between components using a prop whose value is a function.

**Implementation:**
```javascript
// Shared data fetching logic
const DataFetcher = ({ url, children }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchData(url)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);
  
  return children({ data, loading, error });
};

// Usage in different MFEs
const ProductMFE = () => (
  <DataFetcher url="/api/products">
    {({ data, loading, error }) => (
      <ProductList products={data} loading={loading} error={error} />
    )}
  </DataFetcher>
);
```

### 4. Compound Components

**Purpose:** Create flexible, composable component interfaces.

**Implementation:**
```javascript
// Modal compound component
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

// Usage
const CheckoutModal = () => (
  <Modal isOpen={isOpen} onClose={handleClose}>
    <Modal.Header>
      <h2>Checkout</h2>
    </Modal.Header>
    <Modal.Body>
      <CheckoutForm />
    </Modal.Body>
    <Modal.Footer>
      <Button onClick={handleSubmit}>Complete Purchase</Button>
    </Modal.Footer>
  </Modal>
);
```

## State Management Patterns

### 1. Redux Ducks Pattern

**Purpose:** Organize Redux logic by feature, keeping actions, reducers, and selectors together.

**File Structure:**
```
/src
  /features
    /cart
      cartSlice.ts
      cartSelectors.ts
      cartThunks.ts
    /checkout
      checkoutSlice.ts
      checkoutSelectors.ts
    /products
      productsSlice.ts
      productsSelectors.ts
```

**Implementation:**
```javascript
// features/cart/cartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunk
export const addToCart = createAsyncThunk(
  'cart/addItem',
  async (product) => {
    const response = await api.addToCart(product);
    return response.data;
  }
);

// Slice
const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null
  },
  reducers: {
    clearCart: (state) => {
      state.items = [];
      state.total = 0;
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      const item = state.items.find(item => item.id === id);
      if (item) {
        item.quantity = quantity;
        state.total = calculateTotal(state.items);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(addToCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
        state.total = calculateTotal(state.items);
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCart, updateQuantity } = cartSlice.actions;
export default cartSlice.reducer;

// Selectors
export const selectCartItems = (state) => state.cart.items;
export const selectCartTotal = (state) => state.cart.total;
export const selectCartLoading = (state) => state.cart.loading;
```

### 2. Feature-Based State Organization

**Purpose:** Organize state by domain features rather than technical layers.

**Store Configuration:**
```javascript
// app/store.js
import { configureStore } from '@reduxjs/toolkit';
import cartReducer from '../features/cart/cartSlice';
import checkoutReducer from '../features/checkout/checkoutSlice';
import productsReducer from '../features/products/productsSlice';
import userReducer from '../features/user/userSlice';

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    checkout: checkoutReducer,
    products: productsReducer,
    user: userReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
});
```

## Microfrontend-Specific Patterns

### 1. Module Federation Pattern

**Purpose:** Share code and dependencies between MFEs at runtime.

**Implementation:**
```javascript
// webpack.config.js for shared components
const ModuleFederationPlugin = require('@module-federation/webpack');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shared_components',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button',
        './Modal': './src/components/Modal',
        './ProductCard': './src/components/ProductCard'
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true }
      }
    })
  ]
};

// Consumer MFE
const RemoteButton = React.lazy(() => import('shared_components/Button'));

const MyComponent = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <RemoteButton onClick={handleClick}>Click me</RemoteButton>
  </Suspense>
);
```

### 2. Shell Application Pattern

**Purpose:** Provide a container application that orchestrates multiple MFEs.

**Implementation:**
```javascript
// Shell App Router
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';

const HomepageMFE = React.lazy(() => import('homepage_mfe/App'));
const ProductMFE = React.lazy(() => import('product_mfe/App'));
const CartMFE = React.lazy(() => import('cart_mfe/App'));
const CheckoutMFE = React.lazy(() => import('checkout_mfe/App'));

const ShellApp = () => {
  return (
    <BrowserRouter>
      <div className="shell-app">
        <Header />
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomepageMFE />} />
            <Route path="/products/*" element={<ProductMFE />} />
            <Route path="/cart" element={<CartMFE />} />
            <Route path="/checkout/*" element={<CheckoutMFE />} />
          </Routes>
        </Suspense>
        <Footer />
      </div>
    </BrowserRouter>
  );
};
```

### 3. Shared State Management Pattern

**Purpose:** Manage shared state across multiple MFEs.

**Implementation:**
```javascript
// Shared event bus
class EventBus {
  constructor() {
    this.events = {};
  }
  
  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }
  
  publish(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}

// Global instance
window.eventBus = new EventBus();

// Usage in Cart MFE
useEffect(() => {
  const unsubscribe = window.eventBus.subscribe('user.login', (user) => {
    // Update cart state based on user login
    dispatch(loadUserCart(user.id));
  });
  
  return unsubscribe;
}, []);

// Usage in User MFE
const handleLogin = (user) => {
  window.eventBus.publish('user.login', user);
};
```

## Code Organization Patterns

### 1. Feature Folders Structure

**Purpose:** Organize code by business features rather than technical layers.

**Directory Structure:**
```
/src
  /app
    store.ts
    App.tsx
  /features
    /cart
      /components
        CartItem.tsx
        CartSummary.tsx
      /hooks
        useCart.ts
      /services
        cartApi.ts
      cartSlice.ts
      index.ts
    /checkout
      /components
        CheckoutForm.tsx
        PaymentForm.tsx
      /hooks
        useCheckout.ts
      /services
        checkoutApi.ts
      checkoutSlice.ts
      index.ts
  /shared
    /components
      Button.tsx
      Modal.tsx
    /hooks
      useAuth.ts
    /utils
      formatters.ts
```

### 2. Barrel Exports Pattern

**Purpose:** Simplify imports and create clean public APIs for features.

**Implementation:**
```javascript
// features/cart/index.ts
export { default as cartReducer } from './cartSlice';
export { selectCartItems, selectCartTotal } from './cartSlice';
export { addToCart, removeFromCart } from './cartSlice';
export { CartItem, CartSummary } from './components';
export { useCart } from './hooks/useCart';

// Clean imports
import { cartReducer, selectCartItems, CartItem, useCart } from '../features/cart';
```

### 3. Layered Architecture Pattern

**Purpose:** Separate concerns into distinct layers for better maintainability.

**Layer Structure:**
```
/src
  /presentation    # React components, hooks
  /domain         # Business logic, entities
  /infrastructure # API calls, external services
  /application    # Use cases, orchestration
```

## Performance Patterns

### 1. Code Splitting and Lazy Loading

**Purpose:** Reduce initial bundle size and improve loading performance.

**Implementation:**
```javascript
// Route-based code splitting
const ProductDetails = lazy(() => import('./ProductDetails'));
const ProductList = lazy(() => import('./ProductList'));

// Component-based code splitting
const ExpensiveChart = lazy(() => import('./ExpensiveChart'));

const ProductPage = () => {
  const [showChart, setShowChart] = useState(false);
  
  return (
    <div>
      <ProductInfo />
      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <ExpensiveChart />
        </Suspense>
      )}
    </div>
  );
};
```

### 2. Memoization Patterns

**Purpose:** Prevent unnecessary re-renders and expensive calculations.

**Implementation:**
```javascript
// Component memoization
const ProductCard = React.memo(({ product, onAddToCart }) => {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={() => onAddToCart(product)}>Add to Cart</button>
    </div>
  );
});

// Expensive calculation memoization
const ProductList = ({ products, filters }) => {
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      return filters.category ? product.category === filters.category : true;
    }).sort((a, b) => {
      return filters.sortBy === 'price' ? a.price - b.price : a.name.localeCompare(b.name);
    });
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

### 3. Virtual Scrolling Pattern

**Purpose:** Handle large lists efficiently by only rendering visible items.

**Implementation:**
```javascript
import { FixedSizeList as List } from 'react-window';

const VirtualProductList = ({ products }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ProductCard product={products[index]} />
    </div>
  );
  
  return (
    <List
      height={600}
      itemCount={products.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

## Communication Patterns

### 1. Custom Events Pattern

**Purpose:** Enable communication between MFEs using native browser events.

**Implementation:**
```javascript
// Publisher (Cart MFE)
const addToCart = (product) => {
  // Update local state
  dispatch(addItem(product));
  
  // Notify other MFEs
  window.dispatchEvent(new CustomEvent('cart:item-added', {
    detail: { product, cartTotal: getCartTotal() }
  }));
};

// Subscriber (Header MFE)
useEffect(() => {
  const handleCartUpdate = (event) => {
    const { cartTotal } = event.detail;
    setCartBadgeCount(cartTotal);
  };
  
  window.addEventListener('cart:item-added', handleCartUpdate);
  
  return () => {
    window.removeEventListener('cart:item-added', handleCartUpdate);
  };
}, []);
```

### 2. Shared Store Pattern

**Purpose:** Share state across MFEs using a centralized store.

**Implementation:**
```javascript
// Shared store setup
const createSharedStore = () => {
  const store = configureStore({
    reducer: {
      user: userReducer,
      cart: cartReducer,
      notifications: notificationsReducer
    }
  });
  
  window.__SHARED_STORE__ = store;
  return store;
};

// MFE integration
const useSharedStore = () => {
  const store = window.__SHARED_STORE__;
  if (!store) {
    throw new Error('Shared store not initialized');
  }
  return store;
};

// Usage in MFE
const CartMFE = () => {
  const store = useSharedStore();
  const cartItems = useSelector(selectCartItems);
  
  return <CartComponent items={cartItems} />;
};
```

### 3. Props Drilling Alternative Pattern

**Purpose:** Avoid props drilling in complex component hierarchies.

**Implementation:**
```javascript
// Context pattern for shared data
const CartContext = createContext();

const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  
  const addToCart = (product) => {
    setCart(prev => [...prev, product]);
  };
  
  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };
  
  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook for consuming context
const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
```

## Implementation Guidelines

### 1. Microfrontend Integration Checklist

**Before Implementation:**
- [ ] Define clear boundaries between MFEs
- [ ] Establish communication protocols
- [ ] Set up shared component library
- [ ] Configure module federation
- [ ] Define deployment strategy

**During Development:**
- [ ] Implement error boundaries
- [ ] Add loading states
- [ ] Handle cross-MFE navigation
- [ ] Implement shared authentication
- [ ] Add performance monitoring

**Testing Strategy:**
- [ ] Unit tests for components
- [ ] Integration tests for MFE communication
- [ ] End-to-end tests for user flows
- [ ] Performance tests for loading times

### 2. Code Quality Standards

**Component Guidelines:**
```javascript
// Good: Single responsibility, clear props
const ProductCard = ({ product, onAddToCart, onViewDetails }) => {
  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <div className="actions">
        <button onClick={() => onAddToCart(product)}>Add to Cart</button>
        <button onClick={() => onViewDetails(product.id)}>View Details</button>
      </div>
    </div>
  );
};

// Bad: Multiple responsibilities, unclear props
const ProductCard = ({ data, handlers }) => {
  return (
    <div>
      <img src={data.img} />
      <h3>{data.title}</h3>
      <button onClick={handlers.cart}>Add</button>
      <button onClick={handlers.details}>View</button>
    </div>
  );
};
```

**State Management Guidelines:**
```javascript
// Good: Normalized state, clear actions
const productsSlice = createSlice({
  name: 'products',
  initialState: {
    byId: {},
    allIds: [],
    loading: false,
    error: null
  },
  reducers: {
    productsLoading: (state) => {
      state.loading = true;
      state.error = null;
    },
    productsLoaded: (state, action) => {
      state.loading = false;
      state.byId = action.payload.entities;
      state.allIds = action.payload.ids;
    },
    productUpdated: (state, action) => {
      const { id, changes } = action.payload;
      if (state.byId[id]) {
        Object.assign(state.byId[id], changes);
      }
    }
  }
});
```

### 3. Performance Optimization Guidelines

**Bundle Optimization:**
- Use dynamic imports for route-based code splitting
- Implement component-level lazy loading
- Optimize shared dependencies in module federation
- Use tree shaking to eliminate dead code

**Runtime Optimization:**
- Implement proper memoization strategies
- Use React.memo for expensive components
- Optimize re-renders with useCallback and useMemo
- Implement virtual scrolling for large lists

**Network Optimization:**
- Implement proper caching strategies
- Use service workers for offline functionality
- Optimize API calls with request deduplication
- Implement progressive loading for images

### 4. Error Handling Patterns

**Error Boundary Implementation:**
```javascript
class MFEErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log error to monitoring service
    console.error('MFE Error:', error, errorInfo);
    
    // Send to error tracking service
    if (window.errorTracker) {
      window.errorTracker.captureException(error, {
        extra: errorInfo,
        tags: {
          mfe: this.props.mfeName
        }
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

This comprehensive guide provides practical patterns and implementation strategies specifically tailored for React microfrontend architectures. The patterns focus on maintainability, performance, and scalability while ensuring consistency across your MFE ecosystem.