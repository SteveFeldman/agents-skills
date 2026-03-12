# JavaScript Code Style Guidelines for Microfrontend Architecture

## Overview

This document establishes comprehensive code style guidelines for our microfrontend architecture, ensuring consistency across all MFEs (cart-mfe, checkout-mfe, product-mfe, homepage-mfe, etc.). Based on industry best practices from Airbnb, Google, and Redux communities, these guidelines promote code maintainability, readability, and team collaboration.

## Table of Contents

1. [Code Formatting with Prettier](#code-formatting-with-prettier)
2. [JavaScript Style Guidelines](#javascript-style-guidelines)
3. [React/JSX Conventions](#reactjsx-conventions)
4. [Redux Code Organization](#redux-code-organization)
5. [ESLint Configuration](#eslint-configuration)
6. [File Naming and Organization](#file-naming-and-organization)
7. [Import/Export Conventions](#importexport-conventions)
8. [TypeScript Migration Guidelines](#typescript-migration-guidelines)
9. [Code Review Standards](#code-review-standards)
10. [Editor Configuration](#editor-configuration)
11. [Git Hooks and Quality Enforcement](#git-hooks-and-quality-enforcement)
12. [Cross-MFE Consistency](#cross-mfe-consistency)

## Code Formatting with Prettier

### Configuration

Create a `.prettierrc` file in each MFE root:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "jsxSingleQuote": true,
  "bracketSameLine": false
}
```

### Prettier Ignore File

Create `.prettierignore`:

```
# Dependencies
node_modules/

# Build outputs
build/
dist/
coverage/

# Configuration files
*.min.js
*.bundle.js

# Generated files
public/static/
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "format:staged": "prettier --write"
  }
}
```

## JavaScript Style Guidelines

### Variable Declarations

```javascript
// ✅ Good - Use const for all references
const items = [];
const user = { name: 'John' };

// ✅ Good - Use let when reassignment is needed
let count = 0;
count++;

// ❌ Bad - Avoid var
var outdated = 'no';
```

### Object Practices

```javascript
// ✅ Good - Use object literal syntax
const item = {};

// ✅ Good - Use computed property names
const getKey = (k) => k;
const obj = {
  [getKey('enabled')]: true,
};

// ✅ Good - Use object method shorthand
const atom = {
  value: 1,
  addValue(value) {
    return atom.value + value;
  },
};

// ✅ Good - Group shorthand properties
const anakinSkywalker = 'Anakin Skywalker';
const lukeSkywalker = 'Luke Skywalker';
const obj = {
  lukeSkywalker,
  anakinSkywalker,
  episodeOne: 1,
  twoJediWalkIntoACantina: 2,
};

// ✅ Good - Use object spread
const original = { a: 1, b: 2 };
const copy = { ...original, c: 3 };
```

### Array Practices

```javascript
// ✅ Good - Use array literal syntax
const items = [];

// ✅ Good - Use push() instead of direct assignment
const someStack = [];
someStack.push('abracadabra');

// ✅ Good - Use array spreads to copy arrays
const itemsCopy = [...items];

// ✅ Good - Convert array-like objects to arrays
const foo = document.querySelectorAll('.foo');
const nodes = Array.from(foo);

// ✅ Good - Use Array.from with mapping function
const baz = Array.from(foo, bar);
```

### Function Definitions

```javascript
// ✅ Good - Use arrow functions for callbacks
[1, 2, 3].map(x => x * x);

// ✅ Good - Use explicit return for multiline
[1, 2, 3].map(number => {
  const nextNumber = number + 1;
  return `A string containing the ${nextNumber}.`;
});

// ✅ Good - Use arrow functions for single expressions
const itemHeight = item => item.height || defaultHeight;
```

### Naming Conventions

```javascript
// ✅ Good - Use camelCase for variables and functions
const isValid = true;
const getUserName = () => 'john';

// ✅ Good - Use PascalCase for classes
class UserManager {
  constructor(name) {
    this.name = name;
  }
}

// ✅ Good - Use CONSTANT_CASE for constants
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_COUNT = 3;
```

## React/JSX Conventions

### Component Structure

```javascript
// ✅ Good - Functional component with hooks
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const UserProfile = ({ userId, onUpdate }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <LoadingSpinner />;
  if (!user) return <ErrorMessage />;

  return (
    <div className='user-profile'>
      <h1>{user.name}</h1>
      <UserDetails user={user} onUpdate={onUpdate} />
    </div>
  );
};

UserProfile.propTypes = {
  userId: PropTypes.string.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

export default UserProfile;
```

### JSX Formatting

```javascript
// ✅ Good - Multi-line JSX with proper indentation
const button = (
  <Button
    type='submit'
    disabled={isLoading}
    onClick={handleSubmit}
    className='primary-button'
  >
    Submit Form
  </Button>
);

// ✅ Good - Single quotes for JSX attributes
<div className='container' data-testid='user-container'>
  <span>Hello World</span>
</div>

// ✅ Good - Self-closing tags
<img src={avatarUrl} alt='User avatar' />
<UserProfile userId={id} />
```

### Event Handlers

```javascript
// ✅ Good - Use arrow functions for event handlers
const handleClick = event => {
  event.preventDefault();
  // Handle click
};

// ✅ Good - Name handlers with 'handle' prefix
const handleSubmit = async formData => {
  setLoading(true);
  try {
    await submitForm(formData);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

## Redux Code Organization

### File Structure

```
src/
  features/
    cart/
      cartSlice.js
      cartSelectors.js
      cartTypes.js
    checkout/
      checkoutSlice.js
      checkoutSelectors.js
      checkoutTypes.js
    products/
      productsSlice.js
      productsSelectors.js
      productsTypes.js
  store/
    index.js
    middleware.js
```

### Redux Slice Structure

```javascript
// features/cart/cartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Action types follow domain/eventName pattern
export const fetchCartItems = createAsyncThunk(
  'cart/fetchItems',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await cartAPI.getItems(userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    loading: false,
    error: null,
    totalAmount: 0,
  },
  reducers: {
    addItem: (state, action) => {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
      state.totalAmount = calculateTotal(state.items);
    },
    removeItem: (state, action) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      state.totalAmount = calculateTotal(state.items);
    },
    clearCart: state => {
      state.items = [];
      state.totalAmount = 0;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchCartItems.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCartItems.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.totalAmount = calculateTotal(state.items);
      })
      .addCase(fetchCartItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addItem, removeItem, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
```

### Selector Patterns

```javascript
// features/cart/cartSelectors.js
import { createSelector } from '@reduxjs/toolkit';

// Base selectors
export const selectCart = state => state.cart;
export const selectCartItems = state => state.cart.items;
export const selectCartLoading = state => state.cart.loading;
export const selectCartError = state => state.cart.error;

// Memoized selectors
export const selectCartItemCount = createSelector(
  [selectCartItems],
  items => items.reduce((total, item) => total + item.quantity, 0)
);

export const selectCartTotal = createSelector(
  [selectCartItems],
  items => items.reduce((total, item) => total + item.price * item.quantity, 0)
);

export const selectCartItemById = createSelector(
  [selectCartItems, (state, id) => id],
  (items, id) => items.find(item => item.id === id)
);
```

## ESLint Configuration

### Base Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    '@eslint/js/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/recommended',
    'plugin:security/recommended',
    'prettier',
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'import', 'security'],
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // JavaScript rules
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    
    // React rules
    'react/prop-types': 'error',
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],
    'react/jsx-props-no-spreading': 'off',
    'react/require-default-props': 'off',
    
    // Import rules
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
      },
    ],
    'import/no-unresolved': 'error',
    'import/no-named-as-default': 'off',
    
    // Security rules
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
  },
};
```

## File Naming and Organization

### Naming Conventions

```
// Component files
UserProfile.js          // PascalCase for React components
UserProfile.test.js     // Component tests
UserProfile.stories.js  // Storybook stories

// Utility files
userUtils.js           // camelCase for utilities
constants.js           // lowercase for constants
apiHelpers.js          // camelCase for helpers

// Hook files
useUserData.js         // camelCase with 'use' prefix
useLocalStorage.js

// Redux files
userSlice.js          // camelCase with 'Slice' suffix
userSelectors.js      // camelCase with 'Selectors' suffix
userTypes.js          // camelCase with 'Types' suffix
```

### Directory Structure

```
src/
  components/
    common/              # Shared components
      Button/
        Button.js
        Button.test.js
        Button.stories.js
        index.js
    layout/              # Layout components
      Header/
      Footer/
      Sidebar/
  features/              # Feature-specific code
    cart/
      components/
      hooks/
      services/
      cartSlice.js
      cartSelectors.js
  hooks/                 # Shared hooks
    useApi.js
    useLocalStorage.js
  services/              # API services
    api.js
    cartService.js
    userService.js
  utils/                 # Utility functions
    formatters.js
    validators.js
    constants.js
  styles/                # Global styles
    globals.css
    variables.css
    mixins.css
```

## Import/Export Conventions

### Import Order

```javascript
// 1. React and React-related imports
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

// 2. External library imports
import axios from 'axios';
import { format } from 'date-fns';

// 3. Internal imports (absolute paths)
import { Button } from 'components/common';
import { useUserData } from 'hooks/useUserData';
import { selectUser } from 'features/user/userSelectors';

// 4. Relative imports
import './UserProfile.css';
```

### Export Patterns

```javascript
// Named exports for utilities
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Default export for components
const UserProfile = ({ userId }) => {
  // Component implementation
};

export default UserProfile;

// Index file exports
export { default as UserProfile } from './UserProfile';
export { default as UserSettings } from './UserSettings';
export { default as UserList } from './UserList';
```

## TypeScript Migration Guidelines

### Phase 1: Setup and Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### Phase 2: Type Definitions

```typescript
// types/index.ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// Component prop types
export interface UserProfileProps {
  userId: string;
  onUpdate: (user: User) => void;
  className?: string;
}
```

### Phase 3: Component Migration

```typescript
// UserProfile.tsx
import React, { useState, useEffect } from 'react';
import { UserProfileProps, User } from 'types';

const UserProfile: React.FC<UserProfileProps> = ({ 
  userId, 
  onUpdate, 
  className = '' 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
      try {
        const userData = await userService.getUser(userId);
        setUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className={`user-profile ${className}`}>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};

export default UserProfile;
```

## Code Review Standards

### Checklist for Code Reviews

#### JavaScript/React
- [ ] Variables use `const` or `let` (never `var`)
- [ ] Functions use arrow syntax where appropriate
- [ ] Components are functional with hooks
- [ ] PropTypes are defined for all props
- [ ] Event handlers use proper naming (`handle` prefix)
- [ ] No unused variables or imports
- [ ] Consistent naming conventions followed

#### Redux
- [ ] Action types follow `domain/eventName` pattern
- [ ] Reducers are pure functions
- [ ] Selectors are memoized when needed
- [ ] Async operations use createAsyncThunk
- [ ] State shape is normalized

#### Performance
- [ ] React.memo used for expensive components
- [ ] useMemo/useCallback used appropriately
- [ ] Large lists use virtualization
- [ ] Images are optimized and lazy loaded
- [ ] Bundle size impact considered

#### Testing
- [ ] Unit tests cover main functionality
- [ ] Integration tests for user flows
- [ ] Accessibility tests included
- [ ] Error states are tested
- [ ] Loading states are tested

#### Security
- [ ] No sensitive data in console.log
- [ ] User input is sanitized
- [ ] XSS vulnerabilities addressed
- [ ] CSRF protection implemented
- [ ] Dependencies are up to date

### Automated Checks

```json
// package.json scripts
{
  "scripts": {
    "lint": "eslint src/ --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src/ --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "type-check": "tsc --noEmit"
  }
}
```

## Editor Configuration

### .editorconfig

```ini
# EditorConfig helps maintain consistent coding styles
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yml,yaml}]
indent_size = 2
```

### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.workingDirectories": ["src"],
  "typescript.preferences.importModuleSpecifier": "relative",
  "javascript.preferences.importModuleSpecifier": "relative",
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
```

### VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-jest",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

## Git Hooks and Quality Enforcement

### Pre-commit Hook Setup

```bash
# Install husky and lint-staged
npm install --save-dev husky lint-staged

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

### lint-staged Configuration

```json
// package.json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "jest --bail --findRelatedTests",
      "git add"
    ],
    "src/**/*.{css,scss,md}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

### Commit Message Standards

```bash
# .gitmessage template
# <type>(<scope>): <subject>
#
# <body>
#
# <footer>

# Types: feat, fix, docs, style, refactor, test, chore
# Scope: component, feature, or area of change
# Subject: brief description in present tense
# Body: detailed explanation of changes
# Footer: breaking changes, issue references

# Example:
# feat(cart): add item quantity validation
#
# Add client-side validation to prevent users from adding
# invalid quantities to cart items.
#
# Closes #123
```

## Cross-MFE Consistency

### Shared Configuration Files

Create a shared configuration package:

```javascript
// @company/eslint-config/index.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    // Shared rules across all MFEs
  },
};

// @company/prettier-config/index.js
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
};
```

### Consistent Package.json Scripts

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src/ --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src/ --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",
    "test:coverage": "npm test -- --coverage --watchAll=false",
    "analyze": "npm run build && npx bundle-analyzer build/static/js/*.js"
  }
}
```

### Shared Design System

```javascript
// Design tokens
export const colors = {
  primary: '#007bff',
  secondary: '#6c757d',
  success: '#28a745',
  danger: '#dc3545',
  warning: '#ffc107',
  info: '#17a2b8',
};

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
};

export const breakpoints = {
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
};
```

### Documentation Standards

Each MFE should include:

1. **README.md** with:
   - Project description
   - Setup instructions
   - Available scripts
   - Testing guidelines
   - Deployment process

2. **CONTRIBUTING.md** with:
   - Code style guidelines
   - Pull request process
   - Issue reporting
   - Development workflow

3. **API Documentation** with:
   - Service contracts
   - Data models
   - Error handling
   - Authentication requirements

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Prettier configuration across all MFEs
- [ ] Configure ESLint with shared rules
- [ ] Set up editor configuration files
- [ ] Install and configure git hooks

### Phase 2: Standardization (Week 3-4)
- [ ] Standardize file naming conventions
- [ ] Implement consistent import/export patterns
- [ ] Refactor Redux code organization
- [ ] Update component structure standards

### Phase 3: Quality Assurance (Week 5-6)
- [ ] Set up automated testing pipeline
- [ ] Configure code coverage requirements
- [ ] Implement security scanning
- [ ] Create code review templates

### Phase 4: TypeScript Migration (Week 7-12)
- [ ] Set up TypeScript configuration
- [ ] Define shared type definitions
- [ ] Migrate core components
- [ ] Update build and test processes

### Phase 5: Optimization (Week 13-16)
- [ ] Implement performance monitoring
- [ ] Set up bundle analysis
- [ ] Configure dependency updates
- [ ] Create documentation standards

## Conclusion

These guidelines provide a comprehensive framework for maintaining consistent, high-quality JavaScript code across our microfrontend architecture. By following these standards, we ensure:

- **Consistency**: All MFEs follow the same patterns and conventions
- **Maintainability**: Code is readable and easy to modify
- **Quality**: Automated tools prevent common errors and enforce standards
- **Collaboration**: Clear guidelines facilitate team development
- **Scalability**: Standards support growth and new team members

Regular review and updates of these guidelines ensure they remain relevant as our architecture evolves and new best practices emerge.