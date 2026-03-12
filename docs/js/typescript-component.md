# TypeScript Component Development Guidelines

## Overview

This document provides comprehensive guidelines for developing TypeScript components within the organization's ecosystem, based on systematic analysis of 8 production repositories: change-location-component, add-to-cart-component, header-component, footer-component, rich-relevance-component, location-slideout-component, merge-cart-component, and nearby-stores-component.

## Table of Contents

1. [Architecture Principles](#architecture-principles)
2. [Technology Stack Standards](#technology-stack-standards)
3. [Component Patterns](#component-patterns)
4. [TypeScript Best Practices](#typescript-best-practices)
5. [OpenComponents Integration](#opencomponents-integration)
6. [State Management Patterns](#state-management-patterns)
7. [Testing Standards](#testing-standards)
8. [File Structure and Organization](#file-structure-and-organization)
9. [UI/UX Patterns](#uiux-patterns)
10. [Performance Optimization](#performance-optimization)
11. [Error Handling](#error-handling)
12. [Code Quality Standards](#code-quality-standards)

## Architecture Principles

### Component-Based Architecture
**ALWAYS follow these architectural principles:**

```typescript
// ✅ GOOD - Class-based React components with comprehensive TypeScript
interface AppProps {
  baseUrl: string
  // Additional props with clear typing
}

interface AppState {
  loading: boolean
  error: string | null
  data: any[]
}

export class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props)
    this.state = {
      loading: false,
      error: null,
      data: []
    }
  }
  
  componentDidMount() {
    // OC integration and event registration
    GetOC().push((oc: any) => {
      oc.events.on('EVENT_TYPE', this.handleEvent)
      oc.events.fire('COMPONENT_LOADED')
    })
  }
}
```

**DO:**
- Use class-based React components for consistency with component ecosystem
- Define comprehensive TypeScript interfaces for props and state
- Implement proper lifecycle methods for OC integration
- Follow established naming conventions and architectural patterns

**DON'T:**
- Mix functional and class components within component ecosystem
- Omit TypeScript type definitions
- Skip OC event integration patterns

### OpenComponents (OC) Integration
**ALWAYS integrate with OpenComponents architecture:**

```typescript
// ✅ GOOD - Proper OC integration pattern
componentDidMount() {
  GetOC().push((oc: any) => {
    // Register event listeners
    oc.events.on(OC_EVENT_TYPE, this.handleEvent)
    oc.events.on('LOCATION_CHANGED', this.handleLocationChange)
    
    // Fire component ready event
    oc.events.fire('COMPONENT_LOADED', { 
      component: 'component-name',
      version: '1.0.0'
    })
  })
}

handleEvent = (eventDetails: any, eventData: any) => {
  // Process OC events with proper error handling
  try {
    this.processEventData(eventData)
  } catch (error) {
    console.error('Event processing failed:', error)
  }
}
```

## Technology Stack Standards

### Core Dependencies
**ALWAYS use these specific versions for consistency:**

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "@types/react": "^18.3.16",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.1.3"
  },
  "devDependencies": {
    "vite": "^6.3.5",
    "vitest": "^2.1.8",
    "@vitejs/plugin-react": "^4.3.4"
  }
}
```

### Shared Library Ecosystem
**ALWAYS leverage shared libraries:**

```typescript
// Core imports
import { GetOC } from "@org/oc-utils"
import GetDeviceSize from "@org/get-device-size"
import { serverClient } from "oc-server"

// UI Component imports
import Modal from "@org/modal"
import Button from "@org/button"
import Icon from "@org/icon"

// Specialized functionality
import { AddEngravingEntry, RemoveEngravingEntry } from "@org/engraving/build/helpers"
```

### Build System Configuration
**ALWAYS use Vite with these configurations:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ComponentName',
      fileName: (format) => `component-name.${format}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
})
```

## Component Patterns

### Class Component Structure
**ALWAYS follow this component structure:**

```typescript
// ✅ GOOD - Comprehensive class component pattern
interface ComponentProps {
  baseUrl: string
  config?: ComponentConfig
  onEvent?: (data: any) => void
}

interface ComponentState {
  isLoading: boolean
  error: string | null
  data: DataType[]
  uiState: UIStateType
}

export class ComponentName extends React.Component<ComponentProps, ComponentState> {
  private componentRef: React.RefObject<HTMLDivElement>
  
  constructor(props: ComponentProps) {
    super(props)
    this.state = {
      isLoading: false,
      error: null,
      data: [],
      uiState: 'idle'
    }
    
    // Bind methods and create refs
    this.componentRef = React.createRef<HTMLDivElement>()
    this.handleEvent = this.handleEvent.bind(this)
  }
  
  componentDidMount() {
    this.initializeComponent()
  }
  
  componentWillUnmount() {
    this.cleanupComponent()
  }
  
  private initializeComponent() {
    // OC integration and setup
    GetOC().push((oc: any) => {
      oc.events.on('EVENT_TYPE', this.handleEvent)
      oc.events.fire('COMPONENT_MOUNTED')
    })
  }
  
  private cleanupComponent() {
    // Cleanup logic
  }
  
  render() {
    return (
      <div ref={this.componentRef} className="component-container">
        {this.renderContent()}
      </div>
    )
  }
}
```

### Redux Integration Pattern
**For components requiring Redux (alternative pattern):**

```typescript
// ✅ GOOD - Redux integration with HOC pattern
import { createStore } from "redux"
import withRedux from "./withRedux"

const store = createStore(
  reducers,
  typeof window !== "undefined" && 
  window.__REDUX_DEVTOOLS_EXTENSION__ && 
  window.__REDUX_DEVTOOLS_EXTENSION__()
)

const mapStateToProps = (state: AppState) => ({
  data: state.data,
  loading: state.loading
})

const mapDispatchToProps = {
  updateData: updateDataAction,
  resetState: resetStateAction
}

export default withRedux(
  store, 
  mapStateToProps, 
  mapDispatchToProps, 
  loadInitialParamsFromOC
)(ComponentClass)
```

## TypeScript Best Practices

### Interface Definitions
**ALWAYS define comprehensive interfaces:**

```typescript
// ✅ GOOD - Comprehensive type definitions
interface BaseProps {
  baseUrl: string
  className?: string
  'data-testid'?: string
}

interface ProductData {
  id: string
  name: string
  price: number
  image?: string
  inStock: boolean
  metadata?: Record<string, any>
}

interface APIResponse<T> {
  data: T
  success: boolean
  error?: string
  timestamp: number
}

interface ComponentConfig {
  showHeader?: boolean
  enableFeature?: boolean
  apiEndpoint?: string
  retryAttempts?: number
}

// Union types for state management
type LoadingState = 'idle' | 'loading' | 'success' | 'error'
type ModalState = 'closed' | 'opening' | 'open' | 'closing'
```

### Event Handling Types
**ALWAYS type event handlers properly:**

```typescript
// ✅ GOOD - Properly typed event handlers
interface OCEventData {
  eventType: string
  payload: any
  timestamp: number
}

class Component extends React.Component<Props, State> {
  handleOCEvent = (eventDetails: any, eventData: OCEventData): void => {
    const { eventType, payload } = eventData
    
    switch (eventType) {
      case 'DATA_UPDATED':
        this.handleDataUpdate(payload)
        break
      case 'ERROR_OCCURRED':
        this.handleError(payload)
        break
      default:
        console.warn(`Unhandled event type: ${eventType}`)
    }
  }
  
  handleDataUpdate = (data: any): void => {
    this.setState({ data, isLoading: false })
  }
  
  handleError = (error: string): void => {
    this.setState({ error, isLoading: false })
  }
}
```

### Generic Types and Utilities
**ALWAYS use generic types for reusability:**

```typescript
// ✅ GOOD - Generic utility types
interface APIClient<T> {
  get(endpoint: string): Promise<APIResponse<T>>
  post(endpoint: string, data: any): Promise<APIResponse<T>>
  put(endpoint: string, data: any): Promise<APIResponse<T>>
  delete(endpoint: string): Promise<APIResponse<boolean>>
}

interface Repository<T, K = string> {
  findById(id: K): Promise<T | null>
  findAll(filters?: Partial<T>): Promise<T[]>
  create(data: Omit<T, 'id'>): Promise<T>
  update(id: K, data: Partial<T>): Promise<T>
  delete(id: K): Promise<boolean>
}

// Conditional types for advanced scenarios
type ComponentProps<T> = T extends { modal: true } 
  ? BaseProps & ModalProps 
  : BaseProps & StandardProps
```

## OpenComponents Integration

### Event System Patterns
**ALWAYS implement proper OC event handling:**

```typescript
// ✅ GOOD - Comprehensive OC event integration
class Component extends React.Component<Props, State> {
  private ocEvents = {
    COMPONENT_LOADED: 'COMPONENT_LOADED',
    DATA_REQUEST: 'DATA_REQUEST',
    ERROR_OCCURRED: 'ERROR_OCCURRED'
  } as const
  
  componentDidMount() {
    this.registerOCEvents()
  }
  
  private registerOCEvents(): void {
    GetOC().push((oc: any) => {
      // Register event listeners
      oc.events.on('EXTERNAL_EVENT', this.handleExternalEvent)
      oc.events.on('LOCATION_CHANGED', this.handleLocationChange)
      oc.events.on('USER_AUTH_CHANGED', this.handleAuthChange)
      
      // Fire component ready events
      oc.events.fire(this.ocEvents.COMPONENT_LOADED, {
        component: 'component-name',
        version: process.env.PACKAGE_VERSION,
        capabilities: ['feature1', 'feature2']
      })
    })
  }
  
  private handleExternalEvent = (cb: any, data: any): void => {
    try {
      this.processExternalData(data)
    } catch (error) {
      this.fireErrorEvent(error)
    }
  }
  
  private fireErrorEvent(error: Error): void {
    GetOC().push((oc: any) => {
      oc.events.fire(this.ocEvents.ERROR_OCCURRED, {
        error: error.message,
        component: 'component-name',
        timestamp: Date.now()
      })
    })
  }
}
```

### Server Integration
**ALWAYS use serverClient for API calls:**

```typescript
// ✅ GOOD - Proper server client usage
import { serverClient } from "oc-server"

class Component extends React.Component<Props, State> {
  private async fetchData(params: RequestParams): Promise<void> {
    this.setState({ isLoading: true, error: null })
    
    try {
      const response = await serverClient.getData(params)
      
      if (response.isError) {
        throw new Error(response.details?.message || 'Request failed')
      }
      
      this.setState({ 
        data: response.data,
        isLoading: false 
      })
    } catch (error) {
      this.setState({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      })
    }
  }
  
  private async submitData(data: FormData): Promise<boolean> {
    try {
      const result = await serverClient.submitForm({ 
        formData: data,
        endpoint: this.props.apiEndpoint 
      })
      
      return !result.isError
    } catch (error) {
      console.error('Submit failed:', error)
      return false
    }
  }
}
```

## State Management Patterns

### Component State Management
**ALWAYS manage state with clear patterns:**

```typescript
// ✅ GOOD - Comprehensive state management
interface ComponentState {
  // Data state
  data: DataType[]
  selectedItem: DataType | null
  
  // UI state
  isLoading: boolean
  error: string | null
  modalOpen: boolean
  activeTab: string
  
  // Form state
  formData: FormDataType
  formErrors: Record<string, string>
  isSubmitting: boolean
  
  // Cache state
  lastUpdated: number
  cacheValid: boolean
}

class Component extends React.Component<Props, ComponentState> {
  constructor(props: Props) {
    super(props)
    this.state = this.getInitialState()
  }
  
  private getInitialState(): ComponentState {
    return {
      data: [],
      selectedItem: null,
      isLoading: false,
      error: null,
      modalOpen: false,
      activeTab: 'default',
      formData: this.getInitialFormData(),
      formErrors: {},
      isSubmitting: false,
      lastUpdated: 0,
      cacheValid: false
    }
  }
  
  // State update methods
  private updateData = (newData: DataType[]): void => {
    this.setState({
      data: newData,
      lastUpdated: Date.now(),
      cacheValid: true,
      error: null
    })
  }
  
  private setError = (error: string): void => {
    this.setState({ 
      error, 
      isLoading: false,
      isSubmitting: false 
    })
  }
  
  private resetState = (): void => {
    this.setState(this.getInitialState())
  }
}
```

### Redux Pattern (Alternative)
**For complex state requirements:**

```typescript
// ✅ GOOD - Redux integration pattern
// reducers/index.ts
interface AppState {
  data: DataState
  ui: UIState
  user: UserState
}

interface DataState {
  items: DataItem[]
  loading: boolean
  error: string | null
}

const initialDataState: DataState = {
  items: [],
  loading: false,
  error: null
}

const dataReducer = (state = initialDataState, action: any): DataState => {
  switch (action.type) {
    case 'FETCH_DATA_START':
      return { ...state, loading: true, error: null }
    case 'FETCH_DATA_SUCCESS':
      return { ...state, loading: false, items: action.payload }
    case 'FETCH_DATA_ERROR':
      return { ...state, loading: false, error: action.payload }
    default:
      return state
  }
}

// withRedux HOC usage
const withRedux = (store: any, mapState: any, mapDispatch: any, initializer?: any) => 
  (Component: any) => (props: any) => {
    // HOC implementation
    return <Component {...props} store={store} />
  }
```

## Testing Standards

### Vitest Configuration
**ALWAYS use Vitest with proper setup:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

### Component Testing Patterns
**ALWAYS write comprehensive tests:**

```typescript
// ✅ GOOD - Component testing pattern
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Component } from './Component'

describe('Component', () => {
  const defaultProps = {
    baseUrl: 'https://example.com',
    onEvent: vi.fn()
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('renders correctly with default props', () => {
    render(<Component {...defaultProps} />)
    expect(screen.getByTestId('component-container')).toBeInTheDocument()
  })
  
  it('handles loading state properly', async () => {
    render(<Component {...defaultProps} />)
    
    // Trigger loading
    fireEvent.click(screen.getByTestId('load-button'))
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })
  
  it('handles errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<Component {...defaultProps} />)
    
    // Trigger error condition
    fireEvent.click(screen.getByTestId('error-trigger'))
    
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument()
    })
    
    consoleSpy.mockRestore()
  })
})
```

### Mock Patterns
**ALWAYS mock external dependencies:**

```typescript
// ✅ GOOD - Mocking patterns
import { vi } from 'vitest'

// Mock OC integration
vi.mock('@org/oc-utils', () => ({
  GetOC: () => ({
    push: (callback: Function) => {
      callback({
        events: {
          on: vi.fn(),
          fire: vi.fn()
        }
      })
    }
  })
}))

// Mock server client
vi.mock('oc-server', () => ({
  serverClient: {
    getData: vi.fn().mockResolvedValue({ data: [], isError: false }),
    submitForm: vi.fn().mockResolvedValue({ success: true, isError: false })
  }
}))

// Mock device detection
vi.mock('@org/get-device-size', () => ({
  default: vi.fn().mockReturnValue('desktop')
}))
```

## File Structure and Organization

### Standard Project Structure
**ALWAYS organize files following this pattern:**

```
src/
├── components/          # Reusable UI components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.module.css
│   └── Modal/
│       ├── Modal.tsx
│       ├── Modal.test.tsx
│       └── Modal.module.css
├── types/              # TypeScript type definitions
│   ├── index.ts
│   ├── api.ts
│   └── components.ts
├── utils/              # Utility functions
│   ├── index.ts
│   ├── api.ts
│   ├── helpers.ts
│   └── constants.ts
├── hooks/              # Custom React hooks (if using functional patterns)
│   └── useApi.ts
├── services/           # API and external service integrations
│   ├── api.ts
│   └── oc-integration.ts
├── styles/             # Global styles and themes
│   ├── globals.css
│   └── variables.css
├── test/               # Test utilities and setup
│   ├── setup.ts
│   ├── mocks.ts
│   └── utils.ts
├── App.tsx             # Main component
├── index.ts            # Entry point
└── vite-env.d.ts       # Vite type definitions
```

### Naming Conventions
**ALWAYS follow these naming patterns:**

```typescript
// ✅ GOOD - File naming conventions
// Components: PascalCase
App.tsx
ProductCard.tsx
CartModal.tsx

// Types: PascalCase interfaces, camelCase files
types/productTypes.ts
interface ProductData { }
interface APIResponse<T> { }

// Utilities: camelCase
utils/apiHelpers.ts
utils/formatUtils.ts
utils/validationHelpers.ts

// Constants: SCREAMING_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com'
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT = 5000

// CSS classes: kebab-case
.component-container { }
.modal-overlay { }
.button-primary { }
```

## UI/UX Patterns

### Modal Implementation
**ALWAYS implement modals following this pattern:**

```typescript
// ✅ GOOD - Modal implementation pattern
import Modal from "@org/modal"

interface ModalState {
  showModal: boolean
  modalContent: 'loading' | 'content' | 'error'
  previousElement: HTMLElement | null
}

class Component extends React.Component<Props, State & ModalState> {
  private modalRef: React.RefObject<HTMLDivElement>
  
  constructor(props: Props) {
    super(props)
    this.modalRef = React.createRef<HTMLDivElement>()
    
    this.state = {
      ...this.getInitialState(),
      showModal: false,
      modalContent: 'content',
      previousElement: null
    }
  }
  
  private openModal = (): void => {
    this.setState({
      showModal: true,
      previousElement: document.activeElement as HTMLElement
    })
  }
  
  private closeModal = (): void => {
    const { previousElement } = this.state
    
    this.setState({ showModal: false }, () => {
      // Restore focus
      if (previousElement) {
        previousElement.focus()
      }
    })
  }
  
  private onAfterModalOpen = (): void => {
    // Focus management after modal opens
    this.modalRef.current?.focus()
  }
  
  render() {
    const { showModal, modalContent } = this.state
    
    return (
      <>
        <button onClick={this.openModal}>Open Modal</button>
        
        <Modal
          showModal={showModal}
          onAfterOpen={this.onAfterModalOpen}
          onAfterClose={this.closeModal}
          closeModal={this.closeModal}
          staticPath={this.props.baseUrl}
          headerContent={this.renderModalHeader()}
          bodyContent={this.renderModalBody()}
          footerContent={this.renderModalFooter()}
        />
      </>
    )
  }
}
```

### Responsive Design Patterns
**ALWAYS implement responsive design:**

```typescript
// ✅ GOOD - Responsive design implementation
import GetDeviceSize from "@org/get-device-size"

class Component extends React.Component<Props, State> {
  state = {
    deviceSize: 'desktop' as 'mobile' | 'tablet' | 'desktop'
  }
  
  componentDidMount() {
    this.updateDeviceSize()
    window.addEventListener('resize', this.updateDeviceSize)
  }
  
  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDeviceSize)
  }
  
  private updateDeviceSize = (): void => {
    const deviceSize = GetDeviceSize()
    this.setState({ deviceSize })
  }
  
  render() {
    const { deviceSize } = this.state
    
    return (
      <div className={`component-container device-${deviceSize}`}>
        {deviceSize === 'mobile' ? this.renderMobileView() : this.renderDesktopView()}
      </div>
    )
  }
  
  private renderMobileView() {
    return (
      <div className="mobile-layout">
        {/* Mobile-specific content */}
      </div>
    )
  }
  
  private renderDesktopView() {
    return (
      <div className="desktop-layout">
        {/* Desktop-specific content */}
      </div>
    )
  }
}
```

### Form Handling Patterns
**ALWAYS implement forms with proper validation:**

```typescript
// ✅ GOOD - Form handling with React Hook Form
import { useForm, Controller } from 'react-hook-form'

interface FormData {
  email: string
  firstName: string
  lastName: string
  preferences: string[]
}

interface FormErrors {
  [key: string]: string
}

class FormComponent extends React.Component<Props, State> {
  state = {
    formData: {} as FormData,
    formErrors: {} as FormErrors,
    isSubmitting: false
  }
  
  private validateForm = (data: FormData): FormErrors => {
    const errors: FormErrors = {}
    
    if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    if (!data.firstName?.trim()) {
      errors.firstName = 'First name is required'
    }
    
    if (!data.lastName?.trim()) {
      errors.lastName = 'Last name is required'
    }
    
    return errors
  }
  
  private handleSubmit = async (data: FormData): Promise<void> => {
    const errors = this.validateForm(data)
    
    if (Object.keys(errors).length > 0) {
      this.setState({ formErrors: errors })
      return
    }
    
    this.setState({ isSubmitting: true, formErrors: {} })
    
    try {
      const result = await serverClient.submitForm({ formData: data })
      
      if (result.isError) {
        throw new Error(result.details?.message || 'Submission failed')
      }
      
      // Handle success
      this.handleFormSuccess(result)
    } catch (error) {
      this.setState({ 
        formErrors: { 
          general: error instanceof Error ? error.message : 'Submission failed' 
        }
      })
    } finally {
      this.setState({ isSubmitting: false })
    }
  }
}
```

## Performance Optimization

### Component Optimization
**ALWAYS implement performance optimizations:**

```typescript
// ✅ GOOD - Performance optimization patterns
class OptimizedComponent extends React.Component<Props, State> {
  // Implement shouldComponentUpdate for unnecessary re-renders
  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    // Deep comparison for complex props
    if (JSON.stringify(this.props.data) !== JSON.stringify(nextProps.data)) {
      return true
    }
    
    // Shallow comparison for simple state
    return this.state.isLoading !== nextState.isLoading ||
           this.state.error !== nextState.error
  }
  
  // Memoize expensive calculations
  private getMemoizedData = (() => {
    let cache: { [key: string]: any } = {}
    
    return (input: any): any => {
      const key = JSON.stringify(input)
      
      if (cache[key]) {
        return cache[key]
      }
      
      const result = this.expensiveCalculation(input)
      cache[key] = result
      
      return result
    }
  })()
  
  // Debounce frequent operations
  private debouncedSearch = this.debounce((searchTerm: string) => {
    this.performSearch(searchTerm)
  }, 300)
  
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), wait)
    }
  }
}
```

### Bundle Optimization
**ALWAYS optimize bundle size:**

```typescript
// ✅ GOOD - Code splitting and lazy loading
import { lazy, Suspense } from 'react'

// Lazy load heavy components
const HeavyModal = lazy(() => import('./components/HeavyModal'))
const ChartComponent = lazy(() => import('./components/Chart'))

class App extends React.Component<Props, State> {
  render() {
    return (
      <div>
        {this.state.showHeavyModal && (
          <Suspense fallback={<div>Loading...</div>}>
            <HeavyModal onClose={this.closeHeavyModal} />
          </Suspense>
        )}
        
        {this.state.showChart && (
          <Suspense fallback={<div>Loading chart...</div>}>
            <ChartComponent data={this.state.chartData} />
          </Suspense>
        )}
      </div>
    )
  }
}

// Tree shaking - import only what you need
import { debounce } from 'lodash/debounce'  // ✅ Good
import _ from 'lodash'  // ❌ Bad - imports entire library
```

## Error Handling

### Comprehensive Error Boundaries
**ALWAYS implement error boundaries:**

```typescript
// ✅ GOOD - Error boundary implementation
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }
  
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    
    // Log error to monitoring service
    this.logErrorToService(error, errorInfo)
    
    // Fire OC error event
    this.fireOCErrorEvent(error, errorInfo)
  }
  
  private logErrorToService(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Component Error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })
  }
  
  private fireOCErrorEvent(error: Error, errorInfo: React.ErrorInfo): void {
    GetOC().push((oc: any) => {
      oc.events.fire('COMPONENT_ERROR', {
        error: error.message,
        component: 'ErrorBoundary',
        errorInfo,
        timestamp: Date.now()
      })
    })
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      )
    }
    
    return this.props.children
  }
}
```

### API Error Handling
**ALWAYS handle API errors gracefully:**

```typescript
// ✅ GOOD - Comprehensive API error handling
class Component extends React.Component<Props, State> {
  private async makeAPICall<T>(
    apiCall: () => Promise<T>,
    retryCount: number = 3
  ): Promise<T | null> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const result = await apiCall()
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        console.warn(`API call attempt ${attempt} failed:`, lastError.message)
        
        // Exponential backoff
        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 1000)
        }
      }
    }
    
    // All retries failed
    this.handleAPIError(lastError!)
    return null
  }
  
  private handleAPIError(error: Error): void {
    const userFriendlyMessage = this.getUserFriendlyErrorMessage(error)
    
    this.setState({ 
      error: userFriendlyMessage,
      isLoading: false 
    })
    
    // Fire OC error event
    GetOC().push((oc: any) => {
      oc.events.fire('API_ERROR', {
        error: error.message,
        component: this.constructor.name,
        timestamp: Date.now()
      })
    })
  }
  
  private getUserFriendlyErrorMessage(error: Error): string {
    if (error.message.includes('network')) {
      return 'Please check your internet connection and try again.'
    }
    
    if (error.message.includes('timeout')) {
      return 'The request is taking longer than expected. Please try again.'
    }
    
    if (error.message.includes('404')) {
      return 'The requested information could not be found.'
    }
    
    return 'An unexpected error occurred. Please try again later.'
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

## Code Quality Standards

### Linting and Formatting
**ALWAYS use comprehensive linting:**

```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "prefer-const": "error",
    "no-var": "error"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Documentation Standards
**ALWAYS document complex functionality:**

```typescript
// ✅ GOOD - Comprehensive documentation
/**
 * Main application component for the component system.
 * Handles OC integration, state management, and user interactions.
 * 
 * @example
 * ```tsx
 * <App 
 *   baseUrl="https://example.com"
 *   config={{ enableFeature: true }}
 *   onError={handleError}
 * />
 * ```
 */
interface AppProps {
  /** Base URL for API calls and asset loading */
  baseUrl: string
  
  /** Optional configuration object */
  config?: ComponentConfig
  
  /** Error handler callback */
  onError?: (error: Error) => void
  
  /** Additional CSS classes */
  className?: string
}

/**
 * Component state interface defining all possible state values
 */
interface AppState {
  /** Loading state indicator */
  isLoading: boolean
  
  /** Error message, null if no error */
  error: string | null
  
  /** Application data array */
  data: DataItem[]
  
  /** Current UI state */
  uiState: 'idle' | 'loading' | 'success' | 'error'
}

export class App extends React.Component<AppProps, AppState> {
  /**
   * Initializes the component and sets up OC integration.
   * Called automatically when component mounts.
   * 
   * @private
   */
  private initializeComponent(): void {
    // Implementation
  }
  
  /**
   * Handles external events from the OC system.
   * Processes event data and updates component state accordingly.
   * 
   * @param eventDetails - Event metadata from OC
   * @param eventData - Event payload data
   * @private
   */
  private handleOCEvent = (eventDetails: any, eventData: any): void => {
    // Implementation
  }
}
```

### Git Commit Standards
**ALWAYS follow conventional commit format:**

```bash
# Commit message format
type(scope): description

body

footer

# Examples:
feat(cart): add item quantity validation
fix(modal): resolve focus management issue
docs(readme): update installation instructions
test(api): add error handling test cases
refactor(utils): simplify validation helpers

# Types: feat, fix, docs, style, refactor, test, chore
# Scope: component area (cart, modal, api, etc.)
# Description: brief summary in present tense
# Body: detailed explanation (optional)
# Footer: breaking changes, issue references
```

## Implementation Checklist

### Component Development Checklist
- [ ] TypeScript interfaces defined for props and state
- [ ] Class-based React component structure
- [ ] OC integration with proper event handling
- [ ] Error boundaries and error handling
- [ ] Responsive design implementation
- [ ] Accessibility attributes (data-testid, aria-labels)
- [ ] Performance optimizations (shouldComponentUpdate, memoization)
- [ ] Comprehensive test coverage with Vitest
- [ ] Documentation for complex functionality
- [ ] ESLint/Prettier compliance

### Code Review Checklist
- [ ] TypeScript types are comprehensive and accurate
- [ ] Component follows established architectural patterns
- [ ] OC events are properly registered and handled
- [ ] Error handling covers all failure scenarios
- [ ] Performance implications considered
- [ ] Tests cover happy path and error cases
- [ ] Accessibility requirements met
- [ ] Documentation is clear and accurate
- [ ] Code follows established naming conventions
- [ ] Bundle size impact is minimal

## Conclusion

This comprehensive guide provides the foundation for developing high-quality TypeScript components within the component ecosystem. By following these patterns and best practices, teams can ensure consistency, maintainability, and reliability across all components.

Key principles to remember:
1. **Consistency**: Follow established patterns across all components
2. **Type Safety**: Leverage TypeScript for robust type checking
3. **OC Integration**: Proper event handling and server communication
4. **Error Resilience**: Comprehensive error handling and recovery
5. **Performance**: Optimize for bundle size and runtime performance
6. **Testing**: Maintain high test coverage with Vitest
7. **Accessibility**: Ensure components work for all users
8. **Documentation**: Clear documentation for maintainability

Regular review and updates of these guidelines ensure they remain relevant as the component ecosystem evolves and new requirements emerge.