# npm / Node.js Dependency Security — Command Reference

## Data Gathering

```bash
# Check what's installed on the BASE branch (Dependabot's source of truth)
git show origin/BASEBRANCH:package-lock.json | node -e "
const chunks=[]; process.stdin.on('data',c=>chunks.push(c)); process.stdin.on('end',()=>{
  const lock=JSON.parse(Buffer.concat(chunks));
  ['pkg1','pkg2','pkg3'].forEach(p=>{
    const e=lock.packages['node_modules/'+p];
    if(e) console.log(p+':', e.version, e.dev?'(dev)':'(runtime)');
  });
});"

# Check all installed versions of a package (catches nested/hoisted installs)
node -e "
const lock=require('./package-lock.json');
Object.entries(lock.packages)
  .filter(([k])=>k.endsWith('/PKGNAME') || k==='node_modules/PKGNAME')
  .forEach(([k,v])=>console.log(k, v.version, v.dev?'(dev)':'(runtime)'));
"

# Trace a package's full dependency chain
npm why <package>

# Check current overrides and dep declarations
cat package.json | jq '{dependencies, devDependencies, overrides}'
```

**Key distinction:** Dependabot reads the lock file on the base branch, not `node_modules`. Always check the lock file, not the installed state, when assessing alert status.

---

## Scope Classification

npm Dependabot alerts include a `scope` field:
- `runtime` — required at runtime (in `dependencies`)
- `development` — dev/test toolchain only (in `devDependencies`)

Dev-only packages (test runners, linters, bundlers) are not in the production bundle and cannot be exploited by end users. Adjust risk accordingly (−2 levels).

---

## Short-Term Patch — Override Syntax

Add to `package.json` `"overrides"` block:

```json
"overrides": {
  "vulnerable-pkg": "PATCHED_VERSION",

  "parent-pkg": {
    "vulnerable-nested-pkg": "PATCHED_VERSION"
  }
}
```

Use scoped overrides (second form) when:
- The package is used by many consumers at different versions
- A global override risks breaking internal component libraries
- The parent pins an exact version (e.g. `"uuid": "9.0.1"`)

**After any change:** `npm install` to regenerate `package-lock.json`.

**Verify the override took effect:**
```bash
node -e "require('./node_modules/PKGNAME/package.json').version"

# If multiple nested installs, check all of them:
node -e "
const lock=require('./package-lock.json');
Object.entries(lock.packages)
  .filter(([k])=>k.endsWith('/PKGNAME'))
  .forEach(([k,v])=>console.log(k, v.version));
"
```

**If override isn't taking effect:** check whether the parent's `package.json` pins an exact version — npm overrides cannot downgrade exact-version pins from upstream packages without a parent-scoped override.

---

## Long-Term Remediation Commands

```bash
# Bump a direct dependency
npm install PKG@VERSION

# Remove a package from dependencies (if moving to devDependencies)
npm uninstall PKG
npm install --save-dev PKG

# Check for available updates to direct deps
npx npm-check-updates

# After updating package.json, regenerate lock file cleanly
npm install
```

---

## Post-Patch Verification

```bash
# 1. Version check for root-level install
node -e "require('./node_modules/PKG/package.json').version"

# 2. Regression: unit tests
npm test

# 3. Regression: lint (catches glob/brace-expansion/minimatch issues)
npm run lint

# 4. Regression: build
npm run build

# 5. If SSR app: server startup
npm run start:server
# Then: curl http://localhost:PORT/healthcheck

# 6. False positive check — installed version vs alert's vulnerable_range
# If installed > patched version: dismiss alert in GitHub UI, no code change needed
```

---

## Common npm-Specific Pitfalls

| Pitfall | Fix |
|---------|-----|
| `npm ci` installs from lock file — override in `package.json` but lock file not regenerated | Run `npm install` (not `npm ci`) after adding overrides, then commit the updated lock file |
| Override set to `^X.Y.Z` but lock file has older version pinned | `npm install` will NOT automatically upgrade a pinned lock entry; delete the lock file entry or run `npm update PKG` |
| `npm why PKG` shows "overridden" but `node_modules` still has old version | `node_modules` wasn't reinstalled; run `npm install` |
| Multiple nested installs — only the hoisted one was overridden | Check all paths with the `node -e lock.packages` snippet above |
