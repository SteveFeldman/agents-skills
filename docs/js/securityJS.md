# JavaScript Security Standards & Best Practices

## Overview
This document outlines security standards and best practices for JavaScript applications, focusing on defensive security measures based on our existing codebase analysis and industry security standards.

## Security Principles

### Defense in Depth
- **Multiple Security Layers**: Authentication, authorization, input validation, and output encoding
- **Fail Securely**: Default to secure states when errors occur
- **Least Privilege**: Grant minimum necessary permissions
- **Security by Design**: Build security into architecture from the start

### Trust Boundaries
- **Client-Side**: Never trust user input or client-side validation
- **Server-Side**: Validate all data at server boundaries
- **Third-Party**: Validate all external API responses
- **MFE Communication**: Secure inter-MFE communication channels

## Current Security Analysis

### Strengths Identified
1. **Authentication Headers**: Axios interceptors for token management
2. **Input Validation**: Comprehensive validation in checkout-mfe
3. **Error Handling**: Proper error states without information leakage
4. **ESLint Security**: Security plugin usage across MFEs

### Security Gaps
1. **XSS Prevention**: Limited output encoding patterns
2. **CSRF Protection**: Inconsistent CSRF token handling
3. **Content Security Policy**: Basic CSP implementation
4. **Dependency Management**: No automated vulnerability scanning

## Authentication & Authorization

### Token Management
```javascript
// Secure token storage and handling
const tokenManager = {
  getToken: () => {
    // Prefer httpOnly cookies over localStorage
    return getCookie('auth_token') || sessionStorage.getItem('auth_token');
  },
  
  setToken: (token) => {
    // Set httpOnly cookie with secure flags
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
```

### API Authentication
```javascript
// Axios interceptors for secure API calls
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

// Handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenManager.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Input Validation & Sanitization

### Client-Side Validation
```javascript
// Validation patterns from checkout-mfe
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateCreditCard = (cardNumber) => {
  // Luhn algorithm implementation
  const cleanNumber = cardNumber.replace(/\D/g, '');
  if (cleanNumber.length < 13 || cleanNumber.length > 19) return false;
  
  let sum = 0;
  let alternate = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  
  return sum % 10 === 0;
};

// Sanitization helpers
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};
```

### Form Security
```javascript
// Secure form handling
const SecureForm = ({ onSubmit, children }) => {
  const [csrfToken, setCsrfToken] = useState('');
  
  useEffect(() => {
    // Fetch CSRF token on mount
    fetchCsrfToken().then(setCsrfToken);
  }, []);
  
  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    // Add CSRF token
    formData.append('_token', csrfToken);
    
    // Validate all inputs
    const isValid = validateFormData(formData);
    if (!isValid) {
      showError('Please correct the errors in the form');
      return;
    }
    
    onSubmit(formData);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="_token" value={csrfToken} />
      {children}
    </form>
  );
};
```

## XSS Prevention

### Output Encoding
```javascript
// Safe HTML rendering
const SafeHTML = ({ html }) => {
  const sanitizedHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
  
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
};

// Template literal sanitization
const createSafeHTML = (strings, ...values) => {
  return strings.reduce((result, string, i) => {
    const value = values[i] ? escapeHTML(values[i]) : '';
    return result + string + value;
  }, '');
};

const escapeHTML = (str) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
```

### Content Security Policy
```javascript
// CSP headers configuration
const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Minimize usage
    'https://trusted-cdn.com'
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for CSS-in-JS
    'https://fonts.googleapis.com'
  ],
  'img-src': [
    "'self'",
    'data:',
    'https://images.example.com'
  ],
  'connect-src': [
    "'self'",
    'https://api.example.com'
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com'
  ],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};
```

## Data Protection

### Sensitive Data Handling
```javascript
// Credit card data handling
const CreditCardInput = ({ onCardChange }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [maskedDisplay, setMaskedDisplay] = useState('');
  
  const handleCardChange = (value) => {
    const cleanValue = value.replace(/\D/g, '');
    
    // Store only last 4 digits
    const lastFour = cleanValue.slice(-4);
    const masked = `****-****-****-${lastFour}`;
    
    setCardNumber(lastFour); // Store only last 4
    setMaskedDisplay(masked);
    
    // Never store full card number
    onCardChange({ lastFour, isValid: validateCreditCard(cleanValue) });
  };
  
  return (
    <input
      type="tel"
      value={maskedDisplay}
      onChange={(e) => handleCardChange(e.target.value)}
      autoComplete="cc-number"
      placeholder="1234-5678-9012-3456"
    />
  );
};
```

### PII Protection
```javascript
// Personal information handling
const PIIProtection = {
  encrypt: (data) => {
    // Use Web Crypto API for client-side encryption
    return crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
      key,
      new TextEncoder().encode(data)
    );
  },
  
  hash: (data) => {
    // One-way hashing for sensitive data
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  },
  
  redact: (data, field) => {
    // Redact sensitive fields in logs
    if (SENSITIVE_FIELDS.includes(field)) {
      return '[REDACTED]';
    }
    return data;
  }
};
```

## Security Monitoring

### Error Handling
```javascript
// Secure error handling
const secureErrorHandler = (error, context) => {
  // Log full error details for developers
  console.error('Security Error:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId()
  });
  
  // Return generic error to user
  const userError = {
    message: 'An error occurred. Please try again.',
    code: 'GENERIC_ERROR',
    timestamp: Date.now()
  };
  
  // Report to monitoring service
  securityMonitoring.reportError(error, context);
  
  return userError;
};
```

### Audit Logging
```javascript
// Security audit logging
const auditLogger = {
  logAuthentication: (userId, action, success) => {
    const logEntry = {
      event: 'AUTH_EVENT',
      userId,
      action,
      success,
      timestamp: new Date().toISOString(),
      ip: getClientIP(),
      userAgent: navigator.userAgent
    };
    
    sendToSecurityLog(logEntry);
  },
  
  logDataAccess: (userId, resource, action) => {
    const logEntry = {
      event: 'DATA_ACCESS',
      userId,
      resource,
      action,
      timestamp: new Date().toISOString()
    };
    
    sendToSecurityLog(logEntry);
  }
};
```

## Third-Party Security

### Dependency Management
```javascript
// Package.json security configuration
{
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "audit-fix": "npm audit fix",
    "security-check": "npm run audit && npm run test:security"
  },
  "dependencies": {
    // Pin exact versions for security
    "react": "17.0.2",
    "axios": "0.24.0"
  }
}
```

### Third-Party Integration
```javascript
// Secure third-party script loading
const loadSecureScript = (src, integrity) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    
    script.onload = resolve;
    script.onerror = reject;
    
    // Add security headers
    script.referrerPolicy = 'no-referrer';
    
    document.head.appendChild(script);
  });
};
```

## Microfrontend Security

### Cross-MFE Communication
```javascript
// Secure event communication
const secureMFEEvents = {
  send: (eventType, data, targetOrigin = window.location.origin) => {
    // Validate event type
    if (!ALLOWED_EVENTS.includes(eventType)) {
      throw new Error('Invalid event type');
    }
    
    // Sanitize data
    const sanitizedData = sanitizeEventData(data);
    
    window.postMessage({
      type: eventType,
      data: sanitizedData,
      timestamp: Date.now(),
      source: 'mfe-cart'
    }, targetOrigin);
  },
  
  listen: (eventType, callback) => {
    const handler = (event) => {
      // Validate origin
      if (!TRUSTED_ORIGINS.includes(event.origin)) {
        console.warn('Untrusted origin:', event.origin);
        return;
      }
      
      // Validate event structure
      if (!event.data || event.data.type !== eventType) {
        return;
      }
      
      callback(event.data);
    };
    
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }
};
```

## Implementation Guidelines

### Code Review Security Checklist
1. **Input Validation**: All user inputs validated and sanitized
2. **Output Encoding**: All dynamic content properly encoded
3. **Authentication**: Proper token handling and session management
4. **Authorization**: Access controls implemented correctly
5. **Error Handling**: No sensitive information leaked in errors
6. **Logging**: Security events properly logged
7. **Dependencies**: No known vulnerabilities in dependencies

### Security Testing
```javascript
// Security test examples
describe('Security Tests', () => {
  it('should prevent XSS attacks', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = sanitizeInput(maliciousInput);
    expect(sanitized).not.toContain('<script>');
  });
  
  it('should validate credit card numbers', () => {
    const invalidCard = '1234567890123456';
    expect(validateCreditCard(invalidCard)).toBe(false);
    
    const validCard = '4532015112830366';
    expect(validateCreditCard(validCard)).toBe(true);
  });
  
  it('should handle authentication errors securely', () => {
    const error = new Error('Invalid credentials');
    const userError = secureErrorHandler(error, 'login');
    expect(userError.message).toBe('An error occurred. Please try again.');
  });
});
```

## Action Items

### Immediate (Next Sprint)
1. Implement comprehensive input validation across all MFEs
2. Add XSS protection with DOMPurify
3. Enhance CSP headers configuration
4. Add automated security testing to CI/CD

### Short-term (Next Quarter)
1. Implement secure session management
2. Add comprehensive audit logging
3. Enhance error handling security
4. Implement dependency vulnerability scanning

### Long-term (Next 6 Months)
1. Implement advanced threat detection
2. Add security monitoring dashboard
3. Conduct penetration testing
4. Implement security training program

## Success Metrics
- **Zero** XSS vulnerabilities in production
- **Zero** high-severity dependency vulnerabilities
- **100%** of forms include CSRF protection
- **< 5 minutes** mean time to security patch deployment
- **Zero** sensitive data exposure incidents