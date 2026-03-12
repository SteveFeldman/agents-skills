---
name: k6
description: Write and execute k6 load tests, performance checks, and validation scripts. Generates scripts with proper scenarios, checks, thresholds, custom metrics, and structured output. Use when the user wants to create k6 tests, performance benchmarks, or site validation scripts.
user_invocable: true
---

# k6 Load Testing & Validation Skill

Write and execute k6 scripts for load testing, performance benchmarking, and site validation.

**CRITICAL WORKFLOW — Follow these steps in order:**

1. **Clarify the test goal** — Determine which type of test the user needs:
   - **Load/Performance test** — measure response times, throughput, error rates under load
   - **Validation/Smoke test** — verify pages or APIs return correct content
   - **Data collection** — iterate through URLs/stores/products and extract structured results

2. **Determine the executor** — Pick the right scenario executor based on the goal (see Scenarios section)

3. **Write scripts to the project's k6 directory or /tmp** — Never overwrite existing scripts without asking. Use `/tmp/k6-check-*.js` for exploratory one-offs.

4. **Execute via k6 CLI**:
   ```bash
   k6 run /path/to/script.js
   ```
   With environment variables:
   ```bash
   k6 run -e TARGET_ENV=prod -e CONCURRENCY=5 /path/to/script.js
   ```

---

## Test Lifecycle

Every k6 script follows four stages. Code placement matters — only the `default` function runs per-VU.

```javascript
// 1. INIT — runs once per VU at startup
// Imports, SharedArray, constants, options — all go here.
// NO http requests allowed in init.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

export const options = { /* scenarios, thresholds */ };

// 2. SETUP — runs once before VUs start (optional)
export function setup() {
  // Fetch shared test data, warm caches, etc.
  // Return value is passed to default() and teardown()
  return { startTime: Date.now() };
}

// 3. DEFAULT — runs once per iteration per VU (the actual test)
export default function (data) {
  // data = return value from setup()
  // HTTP requests, checks, sleeps go here
}

// 4. TEARDOWN — runs once after all VUs finish (optional)
export function teardown(data) {
  // Cleanup, final logging
}

// BONUS: handleSummary — runs after teardown, receives all metrics
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    './results/summary.json': JSON.stringify(data, null, 2),
  };
}
```

**Key rules:**
- `open()` and `SharedArray` only work in init context (top-level)
- `http.*` calls only work in `default`, `setup`, and `teardown`
- `setup()` return value is serialized as JSON — no functions or circular refs

---

## Scenarios & Executors

Define scenarios in `options.scenarios`. Each scenario uses one executor.

### shared-iterations — Fixed total work, split across VUs
Best for: data collection, validation sweeps, one-pass-per-item tests.

```javascript
export const options = {
  scenarios: {
    validation: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 500,        // total across all VUs
      maxDuration: '30m',
    },
  },
};
```

### per-vu-iterations — Each VU runs N iterations
Best for: consistent per-user behavior testing.

```javascript
export const options = {
  scenarios: {
    user_flow: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 10,         // each VU runs 10 iterations
      maxDuration: '10m',
    },
  },
};
```

### constant-vus — Steady state load
Best for: soak tests, baseline measurement.

```javascript
export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30m',
    },
  },
};
```

### ramping-vus — Ramp up/down through stages
Best for: stress tests, finding breaking points.

```javascript
export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',  target: 50 },   // ramp up
        { duration: '5m',  target: 50 },   // hold
        { duration: '2m',  target: 100 },  // push higher
        { duration: '5m',  target: 100 },  // hold
        { duration: '2m',  target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
};
```

### constant-arrival-rate — Fixed requests/sec (open model)
Best for: SLA validation, throughput targets.

```javascript
export const options = {
  scenarios: {
    sla_test: {
      executor: 'constant-arrival-rate',
      rate: 100,               // 100 iterations per timeUnit
      timeUnit: '1s',          // = 100 RPS
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 200,             // scale up if needed
    },
  },
};
```

### ramping-arrival-rate — Variable requests/sec
Best for: spike tests, progressive load increase.

```javascript
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '2m', target: 10 },    // warm up
        { duration: '1m', target: 200 },   // spike
        { duration: '5m', target: 200 },   // hold spike
        { duration: '2m', target: 10 },    // recover
      ],
    },
  },
};
```

### Multiple named scenarios with `exec`
Run different test functions as separate scenarios, each with its own executor and thresholds.
Pattern from `product-detail/perf-test/kibo_script.js`:

```javascript
// Each scenario points to a named export via `exec`
export const options = {
  scenarios: {
    single_product_test: {
      executor: 'ramping-vus',
      exec: 'testSingleProduct',       // calls exported function by name
      startVUs: 1,
      stages: [{ duration: '30s', target: 10 }],
      gracefulRampDown: '10s',
      startTime: '0s',
    },
    batch_products_test: {
      executor: 'ramping-vus',
      exec: 'testBatchProducts',
      startVUs: 1,
      stages: [{ duration: '30s', target: 10 }],
      gracefulRampDown: '10s',
      startTime: '70s',                // stagger start after first scenario
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_duration{scenario:single_product_test}': ['p(95)<1500'],
    'http_req_duration{scenario:batch_products_test}': ['p(95)<3000'],
  },
};

// Named exports — each is a standalone test function
export function testSingleProduct() {
  const res = http.get(url, {
    tags: { scenario: 'single_product_test', name: 'get-single-product' },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}

export function testBatchProducts() {
  const res = http.get(batchUrl, {
    tags: { scenario: 'batch_products_test', name: 'get-batch-products' },
  });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Scenario selection via environment variables
Let users pick which scenarios to run at runtime.
Pattern from `product-detail/perf-test/kibo_script.js`:

```javascript
const scenarioLibrary = {
  single_product_test: { executor: 'ramping-vus', exec: 'testSingleProduct', /* ... */ },
  batch_products_test: { executor: 'ramping-vus', exec: 'testBatchProducts', /* ... */ },
  mixed_traffic_test:  { executor: 'ramping-vus', exec: 'testMixedTraffic',  /* ... */ },
};

// Select scenarios from env: k6 run -e SCENARIOS=single_product_test,batch_products_test script.js
const selected = (__ENV.SCENARIOS || '').split(',').filter(Boolean);
const scenarios = selected.length > 0
  ? selected.reduce((acc, name, i) => {
      if (scenarioLibrary[name]) {
        acc[name] = { ...scenarioLibrary[name], startTime: `${i * 70}s` };
      }
      return acc;
    }, {})
  : defaultScenarios;

export const options = { scenarios };
```

### Staggered scenario timing
When running multiple scenarios sequentially, calculate `startTime` offsets:

```javascript
const GRACEFUL_RAMP_DOWN_SECONDS = 10;
const BUFFER_DURATION = 30;
const SCENARIO_DURATION = __ENV.K6_SCENARIO_DURATION || '30s';

// Each scenario starts after the previous one finishes
// startTime = (duration + rampDown + buffer) * index
const offsetPerScenario = parseInt(SCENARIO_DURATION) + GRACEFUL_RAMP_DOWN_SECONDS + BUFFER_DURATION;
// Scenario 0: startTime '0s'
// Scenario 1: startTime '70s'
// Scenario 2: startTime '140s'
```

---

## Load Test Type Templates

### Smoke Test
Minimal load to verify basic functionality.

```javascript
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};
```

### Average Load Test
Simulate typical production traffic.

```javascript
export const options = {
  stages: [
    { duration: '5m',  target: 50 },   // ramp up to typical load
    { duration: '30m', target: 50 },   // hold
    { duration: '5m',  target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
};
```

### Stress Test
Push beyond normal capacity.

```javascript
export const options = {
  stages: [
    { duration: '2m',  target: 50 },
    { duration: '5m',  target: 50 },
    { duration: '2m',  target: 100 },
    { duration: '5m',  target: 100 },
    { duration: '2m',  target: 200 },
    { duration: '5m',  target: 200 },
    { duration: '5m',  target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};
```

### Soak Test
Sustained load over hours to find memory leaks, connection pool exhaustion, etc.

```javascript
export const options = {
  stages: [
    { duration: '5m',  target: 50 },
    { duration: '4h',  target: 50 },   // long hold
    { duration: '5m',  target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};
```

### Spike Test
Sudden burst to test auto-scaling and recovery.

```javascript
export const options = {
  stages: [
    { duration: '1m',  target: 10 },
    { duration: '10s', target: 500 },  // instant spike
    { duration: '3m',  target: 500 },
    { duration: '10s', target: 10 },   // drop back
    { duration: '3m',  target: 10 },   // recovery
    { duration: '1m',  target: 0 },
  ],
};
```

---

## HTTP Requests

### GET with headers, cookies, tags, and timeout

```javascript
const params = {
  headers: {
    'User-Agent': 'k6-load-test/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  cookies: {
    session_id: 'abc123',
  },
  tags: {
    page: 'homepage',
    env: 'prod',
  },
  timeout: '15s',
  redirects: 5,
};

const res = http.get('https://example.com/', params);
```

### POST JSON

```javascript
const payload = JSON.stringify({ username: 'testuser', action: 'login' });
const params = {
  headers: { 'Content-Type': 'application/json' },
};
const res = http.post('https://api.example.com/auth', payload, params);
```

### POST form data

```javascript
const res = http.post('https://example.com/login', {
  username: 'testuser',
  password: 'testpass',
});
```

### Batch requests (parallel)

```javascript
const responses = http.batch([
  ['GET', 'https://example.com/api/users', null, { tags: { name: 'Users' } }],
  ['GET', 'https://example.com/api/products', null, { tags: { name: 'Products' } }],
  ['GET', 'https://example.com/api/orders', null, { tags: { name: 'Orders' } }],
]);
```

### Response handling

```javascript
const res = http.get('https://api.example.com/data');

// Status
res.status;              // 200
res.status_text;         // "OK"

// Body
res.body;                // raw string
res.json();              // parsed JSON
res.json('data.items');  // JSONPath extraction
res.html();              // HTML selection object

// Timings
res.timings.duration;    // total request time (ms)
res.timings.waiting;     // TTFB (ms)
res.timings.connecting;  // TCP connect time (ms)
res.timings.tls_handshaking; // TLS handshake (ms)

// Headers
res.headers['Content-Type'];
```

---

## Checks

Checks are assertions that don't abort the test on failure. They contribute to the `checks` metric.

### Basic checks

```javascript
const res = http.get('https://example.com/');

check(res, {
  'status is 200': (r) => r.status === 200,
  'body contains welcome': (r) => r.body.includes('Welcome'),
  'response time < 500ms': (r) => r.timings.duration < 500,
  'content-type is html': (r) => r.headers['Content-Type'].includes('text/html'),
});
```

### Checks on JSON responses

```javascript
const res = http.get('https://api.example.com/users/1');
const body = res.json();

check(res, {
  'status is 200': (r) => r.status === 200,
  'user has name': () => body.name !== undefined,
  'user has email': () => body.email !== undefined,
  'user is active': () => body.active === true,
});
```

### Conditional check logic (pattern from existing scripts)

```javascript
const statusOk = check(res, {
  'status 200': (r) => r.status === 200,
});

if (!statusOk) {
  httpErrors.add(1, { category: 'wine' });
  return; // skip further checks if HTTP failed
}

// Only run content checks when status was OK
check(res, {
  'has products': (r) => r.body.includes('results'),
  'has pagination': (r) => r.body.includes('next'),
});
```

### Grouped checks with `group()`

```javascript
group('Homepage', function () {
  const res = http.get('https://example.com/');
  check(res, { 'homepage loads': (r) => r.status === 200 });
});

group('Product Page', function () {
  const res = http.get('https://example.com/product/123');
  check(res, { 'product loads': (r) => r.status === 200 });
});
```

### Dynamic check objects (pattern from go-live-validation.js)
Build check objects programmatically for data-driven validation:

```javascript
function validatePage(res, testCase) {
  const results = [];
  const body = res.body || '';

  results.push({ label: 'HTTP Status', passed: res.status === 200 });

  if (testCase.expectedText) {
    results.push({
      label: `Contains "${testCase.expectedText}"`,
      passed: body.toLowerCase().includes(testCase.expectedText.toLowerCase()),
    });
  }

  // Register as k6 checks for metrics
  const checkObj = {};
  for (const r of results) {
    checkObj[`${testCase.id} ${r.label}`] = () => r.passed;
  }
  check(res, checkObj);

  return results;
}
```

---

## Thresholds

Thresholds define pass/fail criteria. If any threshold fails, k6 exits with code 99.

### Common threshold patterns

```javascript
export const options = {
  thresholds: {
    // Built-in HTTP metrics
    http_req_failed: ['rate<0.01'],                    // <1% errors
    http_req_duration: ['p(95)<500', 'p(99)<1000'],    // 95th < 500ms, 99th < 1s
    http_reqs: ['rate>100'],                           // >100 RPS

    // Check pass rate
    checks: ['rate>0.99'],                             // >99% checks pass

    // Custom metrics (by name)
    my_custom_trend: ['p(95)<200', 'avg<100'],
    my_custom_rate: ['rate>0.95'],
    my_custom_counter: ['count<50'],

    // Tagged sub-metrics
    'http_req_duration{page:homepage}': ['p(95)<300'],
    'http_req_duration{page:api}': ['p(95)<200'],
  },
};
```

### Abort on threshold failure

```javascript
export const options = {
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.1', abortOnFail: true, delayAbortEval: '10s' },
    ],
  },
};
```

---

## Custom Metrics

### Counter — cumulative count

```javascript
const httpErrors = new Counter('http_errors');
const extractionErrors = new Counter('extraction_errors');

// In default():
httpErrors.add(1, { env: 'prod', category: 'wine' });
```

### Trend — statistical distribution (avg, min, max, percentiles)

```javascript
const responseTime = new Trend('page_response_time', true); // true = time values

// In default():
responseTime.add(res.timings.duration, { page: 'homepage' });
```

### Rate — proportion of true/false

```javascript
const successRate = new Rate('successful_requests');

// In default():
successRate.add(res.status === 200);  // true = success
successRate.add(true);                // explicit
successRate.add(false);               // explicit failure
```

### Gauge — last value (instantaneous)

```javascript
const activeUsers = new Gauge('active_users');

// In default():
activeUsers.add(currentCount);
```

---

## Tags & Groups

### Request-level tags

```javascript
const res = http.get(url, {
  tags: {
    env: 'prod',
    store: '3101',
    category: 'wine',
    type: 'plp',
  },
});
```

### Metric-level tags

```javascript
responseTime.add(res.timings.duration, {
  env: envConfig.key,
  category: category.key,
});

httpErrors.add(1, { env: envKey, test: test.id });
```

### Filtering results by tag
Tags enable per-tag thresholds and result filtering:

```javascript
export const options = {
  thresholds: {
    'http_req_duration{env:prod}': ['p(95)<500'],
    'http_req_duration{env:uat}': ['p(95)<2000'],
    'http_errors{category:wine}': ['count<10'],
  },
};
```

---

## Data Parameterization

### SharedArray with JSON file

```javascript
const stores = new SharedArray('stores', function () {
  return JSON.parse(open('./stores.json'));
});
// stores[i] in default() — shared memory across VUs
```

### SharedArray with CSV

```javascript
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

const csvData = new SharedArray('users', function () {
  return papaparse.parse(open('./users.csv'), { header: true }).data;
});
```

### Environment variables

```javascript
const ENV = __ENV.TARGET_ENV || 'prod';
const CONCURRENCY = parseInt(__ENV.CONCURRENCY || '10', 10);
const SINGLE_STORE = __ENV.STORE || '';
const IS_STRICT = (__ENV.STRICT || '').toLowerCase() === 'true';

// Usage: k6 run -e TARGET_ENV=uat -e CONCURRENCY=5 -e STRICT=true script.js
```

### Iteration-based data distribution (pattern from existing scripts)
Assign unique work items to each VU iteration using `exec.scenario.iterationInTest`:

```javascript
import exec from 'k6/execution';

export default function () {
  const iterIndex = exec.scenario.iterationInTest;
  const envIndex = iterIndex % envKeys.length;
  const storeIndex = Math.floor(iterIndex / envKeys.length);

  if (storeIndex >= allStores.length) return;

  const store = allStores[storeIndex];
  const envKey = envKeys[envIndex];
  // Each iteration gets a unique store+env combination
}
```

---

## Result Handling & Reporting

### handleSummary with textSummary

```javascript
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

export function handleSummary(data) {
  const timestamp = new Date().toISOString()
    .replace(/T/, '_').replace(/:/g, '-').replace(/\.\d+Z$/, '');

  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    [`./results/k6_summary_${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`./results/k6_summary_${timestamp}.md`]: buildMarkdownSummary(data),
  };
}
```

### Safe metric extraction helper

```javascript
function safeMetric(metrics, key, valuePath, suffix, fallback) {
  try {
    const m = metrics[key];
    if (!m || !m.values) return fallback || 'N/A';
    const val = valuePath.split('.').reduce((o, k) => o[k], m.values);
    if (val === undefined || val === null) return fallback || 'N/A';
    return typeof val === 'number'
      ? val.toFixed(suffix === '%' ? 1 : 0) + (suffix || '')
      : String(val);
  } catch {
    return fallback || 'N/A';
  }
}
```

### Markdown summary builder

```javascript
function buildMarkdownSummary(data) {
  const m = data.metrics;
  return [
    '# k6 Test Results',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| HTTP Requests | ${safeMetric(m, 'http_reqs', 'count')} |`,
    `| Error Rate | ${safeMetric(m, 'http_req_failed', 'rate', '%')} |`,
    `| Avg Response | ${safeMetric(m, 'http_req_duration', 'avg', 'ms')} |`,
    `| p95 Response | ${safeMetric(m, 'http_req_duration', 'p(95)', 'ms')} |`,
    `| p99 Response | ${safeMetric(m, 'http_req_duration', 'p(99)', 'ms')} |`,
  ].join('\n');
}
```

---

## Parseable Console Logging

For scripts that collect data (not just measure performance), use structured logging for downstream parsing:

```javascript
// Pipe-delimited format for CSV generation
const row = [
  store.storeNum,
  store.storeName,
  envConfig.name,
  status,
  errors.join('; '),
].join('|');
console.log(`RESULT|${row}`);

// Separate failure lines for easy grep
if (failed > 0) {
  console.log(`FAILURE|${store.storeNum}|${envConfig.name}|${failedLabels}`);
}
```

Parse with: `k6 run script.js 2>&1 | node parse-results.js`

---

## Multi-Environment Configuration

Pattern for running against prod, UAT, or both:

```javascript
const ENV = __ENV.TARGET_ENV || 'both'; // prod, uat, or both

const ENVIRONMENTS = {
  prod: {
    key: 'prod',
    name: 'Prod',
    baseUrl: 'https://www.example.com',
  },
  uat: {
    key: 'uat',
    name: 'UAT',
    baseUrl: 'https://uat.example.com',
  },
};

const envKeys = ENV === 'both' ? ['prod', 'uat'] : [ENV];
const totalIterations = dataItems.length * envKeys.length;
```

---

## Weighted Traffic Distribution

Simulate real production traffic ratios across endpoints.
Pattern from `product-detail/perf-test/helpers.js`:

```javascript
function getRandomEndpointByTraffic() {
  const rand = Math.random() * 100;

  // Based on real traffic statistics (Source: Grafana):
  // GetProduct:  91.92%
  // GetProducts:  7.44%
  // NearByStores: 0.30%

  if (rand < 91.92) return 'single_product';
  if (rand < 99.36) return 'batch_products';  // 91.92 + 7.44
  return 'nearby_stores';
}

// In the test function:
export function testMixedTraffic() {
  const endpoint = getRandomEndpointByTraffic();
  if (endpoint === 'single_product') { /* ... */ }
  else if (endpoint === 'batch_products') { /* ... */ }
  else { /* nearby_stores */ }
  sleep(1);
}
```

Generic weighted random selection:

```javascript
function getRandomWeighted(items) {
  // items = [['option_a', 70], ['option_b', 20], ['option_c', 10]]
  let total = items.reduce((sum, item) => sum + item[1], 0);
  let rand = Math.random() * total;
  let cumulative = 0;
  for (const [value, weight] of items) {
    cumulative += weight;
    if (rand < cumulative) return value;
  }
  return items[items.length - 1][0];
}
```

---

## Helper Modules

Extract reusable utilities into a separate `helpers.js` file.
Pattern from `product-detail/perf-test/helpers.js`:

```javascript
// helpers.js
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function getRandomRecord(records) {
  return records[randomIntFromInterval(0, records.length - 1)];
}

function getNRecords(records, n) {
  return records.slice(0, n);
}

function getBranch() {
  if (!__ENV.TEST_BRANCH_NAME) return 'develop-';
  return __ENV.TEST_BRANCH_NAME !== 'master' ? __ENV.TEST_BRANCH_NAME + '-' : '';
}

export { getRandomRecord, getNRecords, getBranch, randomIntFromInterval };
```

Import in test scripts:
```javascript
import { getRandomRecord, getNRecords, getBranch } from './helpers.js';
```

---

## Profile-Driven Configuration

Load environment-specific options from JSON config files.
Pattern from `tw_performance/common.js` and `tw_performance/main.js`:

```javascript
// common.js
export const jsonParseOpen = (filename) => JSON.parse(open(filename));

export const initProfile = (PROFILE) => {
  const env = (PROFILE || 'uat').toLowerCase();
  const profilesOptions = jsonParseOpen(`config/${env}-options.json`);
  const profilesInfo_APP = jsonParseOpen(`config/${env}-config-app.json`);
  const profilesInfo_WEB = jsonParseOpen(`config/${env}-config-web.json`);
  return { profilesOptions, profilesInfo_APP, profilesInfo_WEB };
};

// main.js
const { profilesOptions } = initProfile(__ENV.PROFILE);
export let options = profilesOptions.options;
// k6 run -e PROFILE=prod main.js
```

Example config file (`config/uat-options.json`):
```json
{
  "options": {
    "scenarios": {
      "webScenario1": {
        "executor": "constant-vus",
        "exec": "webScenario1",
        "vus": 5,
        "duration": "10m"
      }
    }
  }
}
```

---

## Runtime Config Logging

Log the resolved configuration at startup for traceability.
Pattern from `product-detail/perf-test/kibo_script.js`:

```javascript
const runtimeConfig = {
  branch: getBranch(),
  env: {
    ENV: __ENV.ENV || 'not set',
    BASE_URL: __ENV.BASE_URL || 'not set',
    SCENARIOS: __ENV.SCENARIOS || 'default',
    K6_VUS: __ENV.K6_VUS || '10',
    K6_SCENARIO_DURATION: __ENV.K6_SCENARIO_DURATION || '30s',
  },
  scenarios: Object.keys(options.scenarios),
};
console.log('perf config snapshot:', JSON.stringify(runtimeConfig, null, 2));
```

---

## VU-Aware Deterministic Data

Generate unique data per VU using `__VU` and `__ITER`.
Pattern from `tw_performance/userCreation.js`:

```javascript
const vus = __ENV.VUS ? parseInt(__ENV.VUS) : 20;
const iterations = __ENV.ITERATIONS ? parseInt(__ENV.ITERATIONS) : Math.ceil(1000 / vus);

export const options = {
  scenarios: {
    user_creation: {
      executor: 'per-vu-iterations',
      vus: vus,
      iterations: iterations,
      maxDuration: '30m',
    },
  },
};

export default function () {
  // Deterministic user number: VU 1 iter 0 = user 1, VU 1 iter 1 = user 2, etc.
  const userNumber = ((__VU - 1) * iterations) + __ITER + 1;
  const email = `load-test-user-${userNumber}@example.com`;

  console.log(`[VU ${__VU}][${__ITER}] Creating user #${userNumber}: ${email}`);
  // ... registration logic
}
```

---

## Conditional Headers

Add headers conditionally based on env vars or feature flags.
Pattern from `product-detail/perf-test/kibo_script.js`:

```javascript
function getKiboHeader() {
  return __ENV.K6_KIBO_HEADER !== undefined;
}

// In test function:
let requestOptions = {
  tags: { scenario: 'single_product_test', name: 'get-single-product' },
};

if (getKiboHeader()) {
  requestOptions.headers = { 'x-twl-kibo-product': 'true' };
}

const res = http.get(url, requestOptions);
```

---

## Check with Error Logging

Log detailed error context when checks fail for debugging.
Pattern from `tw_performance/common.js`:

```javascript
function checkResponseSuccess(info, response, checkName) {
  if (!check(response, { [checkName]: (r) => r.status === 200 }, { name: checkName })) {
    console.error(
      `*******FAILED CHECK*******\n` +
      `check: ${checkName}\n` +
      `url: ${response.url}\n` +
      `method: ${response.request.method}\n` +
      `status: ${response.status}\n` +
      `response: ${response.body}\n` +
      `*******END ERROR*******`
    );
    return false;
  }
  return true;
}

// Conditional group execution — skip downstream groups on failure
function executeGroup(isSuccess, groupName, fn) {
  if (isSuccess) {
    group(groupName, fn);
  }
}
```

---

## Best Practices

### Pacing & rate limiting
Always add sleep between requests to avoid overwhelming the target:

```javascript
sleep(0.2 + Math.random() * 0.3); // 200-500ms jitter
sleep(1);                          // fixed 1s think time
```

### Realistic headers
Use real browser User-Agent strings so requests aren't blocked:

```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
},
```

### Environment-specific timeouts
UAT/staging is often slower — set longer timeouts:

```javascript
timeout: envKey === 'uat' ? '30s' : '15s',
```

### SharedArray for large datasets
Always use `SharedArray` — not raw `JSON.parse(open(...))` — to share data across VUs without duplicating memory:

```javascript
// GOOD — shared memory
const data = new SharedArray('name', () => JSON.parse(open('./data.json')));

// BAD — each VU gets a copy
const data = JSON.parse(open('./data.json'));
```

### Keep init context clean
- No HTTP requests in init
- Use `open()` and `SharedArray` only in init
- Keep options and metric declarations at top level

### Tag everything
Tags enable per-dimension analysis. Tag requests with env, category, test ID, page type, etc.

### Use `group()` for logical sections
Groups create sub-metrics and improve readability in results:

```javascript
group('Login Flow', () => { /* ... */ });
group('Search', () => { /* ... */ });
group('Checkout', () => { /* ... */ });
```

### Threshold early, threshold often
Set thresholds so CI pipelines can gate on performance:

```javascript
thresholds: {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<500'],
  checks: ['rate>0.99'],
},
```

### Don't mix load testing and data collection
If the goal is data collection (iterate every store, extract counts), use `shared-iterations` with no thresholds. If the goal is load testing, use ramping executors with thresholds.

---

## Complete Example: Site Validation Script

```javascript
import http from 'k6/http';
import exec from 'k6/execution';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend, Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const ENV = __ENV.TARGET_ENV || 'prod';
const CONCURRENCY = parseInt(__ENV.CONCURRENCY || '10', 10);

const ENVIRONMENTS = {
  prod: { key: 'prod', name: 'Prod', baseUrl: 'https://www.example.com' },
  uat:  { key: 'uat',  name: 'UAT',  baseUrl: 'https://uat.example.com' },
};

const TEST_PAGES = [
  { id: 'TC01', name: 'Homepage', path: '/', expect: 'Welcome' },
  { id: 'TC02', name: 'About',   path: '/about', expect: 'About Us' },
  { id: 'TC03', name: 'Contact', path: '/contact', expect: 'Contact' },
];

// ─── Data ───────────────────────────────────────────────────────────────────

const envKeys = ENV === 'both' ? ['prod', 'uat'] : [ENV];
const totalIterations = TEST_PAGES.length * envKeys.length;

// ─── Options ────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    validation: {
      executor: 'shared-iterations',
      vus: CONCURRENCY,
      iterations: totalIterations,
      maxDuration: '30m',
    },
  },
};

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const pageResponseTime = new Trend('page_response_time', true);
const httpErrors = new Counter('http_errors');
const testPassRate = new Rate('test_pass_rate');

// ─── Main ───────────────────────────────────────────────────────────────────

export default function () {
  const iterIndex = exec.scenario.iterationInTest;
  const envIndex = iterIndex % envKeys.length;
  const testIndex = Math.floor(iterIndex / envKeys.length);

  if (testIndex >= TEST_PAGES.length) return;

  const testCase = TEST_PAGES[testIndex];
  const envKey = envKeys[envIndex];
  const envConfig = ENVIRONMENTS[envKey];
  const url = `${envConfig.baseUrl}${testCase.path}`;

  const res = http.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
    tags: { env: envKey, test: testCase.id },
    timeout: envKey === 'uat' ? '30s' : '15s',
    redirects: 5,
  });

  pageResponseTime.add(res.timings.duration, { env: envKey, test: testCase.id });

  const statusOk = check(res, {
    [`${testCase.id} status 200`]: (r) => r.status === 200,
  });

  if (!statusOk) {
    httpErrors.add(1, { env: envKey, test: testCase.id });
    testPassRate.add(false);
    console.log(`FAILURE|${envConfig.name}|${testCase.id}|HTTP ${res.status}`);
    return;
  }

  const contentOk = check(res, {
    [`${testCase.id} content`]: (r) => r.body.includes(testCase.expect),
  });

  testPassRate.add(contentOk);

  const status = contentOk ? 'PASS' : 'FAIL';
  console.log(`RESULT|${envConfig.name}|${testCase.id}|${testCase.name}|${status}|${res.timings.duration.toFixed(0)}ms`);

  sleep(0.3 + Math.random() * 0.3);
}

// ─── Summary ────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    './results/validation.json': JSON.stringify(data, null, 2),
  };
}
```

---

## Complete Example: Load Test Script

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://www.example.com';

const apiLatency = new Trend('api_latency', true);

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',  target: 20 },
        { duration: '5m',  target: 20 },
        { duration: '2m',  target: 50 },
        { duration: '5m',  target: 50 },
        { duration: '2m',  target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    api_latency: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/products`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'ProductList' },
  });

  apiLatency.add(res.timings.duration);

  check(res, {
    'status 200': (r) => r.status === 200,
    'has products': (r) => r.json('data.length') > 0,
    'response < 1s': (r) => r.timings.duration < 1000,
  });

  sleep(1 + Math.random());
}
```

---

## Troubleshooting

**"open() can only be called in init context"**
Move `open()` and `SharedArray` to the top level, outside `default()`.

**High memory usage with large data files**
Use `SharedArray` — it shares one copy across all VUs.

**Too many open files / connection errors**
Increase OS limits: `ulimit -n 65536`. On macOS: `sudo launchctl limit maxfiles 65536 200000`.

**Dropped iterations**
With arrival-rate executors, increase `maxVUs` or `preAllocatedVUs`.

**Thresholds passing but errors in output**
Thresholds evaluate on aggregated metrics. Individual failures may be within tolerance. Check `http_req_failed` rate and `checks` rate.

---

## Tips

- **Clarify goal FIRST** — load test vs validation vs data collection drives every design decision
- **Start with smoke** — always run a 1-VU smoke test before ramping up
- **SharedArray for data** — never `JSON.parse(open(...))` directly; always wrap in `SharedArray`
- **Tag requests** — enables per-dimension thresholds and analysis
- **Sleep between requests** — always add think time; real users don't click instantly
- **Use `shared-iterations` for data sweeps** — distributes fixed work across VUs evenly
- **Use `ramping-vus` for load tests** — simulates realistic traffic ramp
- **Use `constant-arrival-rate` for SLA tests** — guarantees target RPS regardless of response time
- **Pipe-delimited logging** — for data collection scripts, log `RESULT|field|field` for easy CSV parsing
- **handleSummary for reports** — output markdown, JSON, and stdout summary
- **Per-env timeouts** — staging is slower; give it more time
- **Realistic User-Agent** — prevents WAF/bot blocking
- **Helper modules** — extract random selection, branch detection, URL building into `helpers.js`
- **Multiple `exec` scenarios** — test different endpoints as named exports with per-scenario thresholds
- **Weighted traffic** — simulate production traffic ratios with `getRandomEndpointByTraffic()`
- **Runtime config logging** — `console.log` resolved config at startup for traceability
- **Deterministic VU data** — use `(__VU - 1) * iterations + __ITER` for unique per-VU data
- **Profile-driven options** — load `config/${env}-options.json` so options vary by environment

---

## Reference: Existing k6 Scripts

These repositories contain k6 scripts that informed this skill:

| Repository | Path | Description |
|---|---|---|
| `kibo/inventory_check` | `k6/inventory-check.js` | Shared-iterations sweep across stores, pipe-delimited logging, handleSummary |
| `kibo/inventory_check` | `k6/go-live-validation.js` | Data-driven PDP/PLP validation, dynamic check objects, strict/structural modes |
| `kibo/product-detail` | `perf-test/script.js` | Simple ramping-vus API load test with CSV data via PapaParse |
| `kibo/product-detail` | `perf-test/kibo_script.js` | Multi-scenario with `exec`, scenario selection via env, per-scenario thresholds, mixed traffic |
| `kibo/product-detail` | `perf-test/helpers.js` | Shared helper module: random records, branch detection, weighted endpoint selection |
| `tw_performance` | `main.js` | Profile-driven config, SharedArray init pattern, web/app scenario separation |
| `tw_performance` | `common.js` | Utility library: check with error logging, weighted random, params builders, sleep helpers |
| `tw_performance` | `userCreation.js` | Per-VU-iterations with deterministic user generation via `__VU`/`__ITER` |
| `tw_performance` | `test_kibo_products.js` | Constant-VUs targeted endpoint test with web/app scenarios |
| `tw_performance` | `test_kibo_micro.js` | Minimal 1-VU micro-benchmark for header validation |
