---
name: "Phase 73: Confirm Lockfile Stability & No Phantom Installs"
about: Ensure dependency lockfiles are stable, reproducible, and free from phantom installations
title: "[Phase 73] Confirm Lockfile Stability & No Phantom Installs"
labels: phase-73, dependencies, stability, security
assignees: ''
---

## 🎯 Objective
Verify that lockfiles are stable, commits are reproducible, and no phantom or unexpected dependencies are installed.

## 📋 Tasks

### Frontend Lockfile Verification (npm)
- [ ] Delete `node_modules` and `package-lock.json`
- [ ] Run `npm install` and verify clean install
- [ ] Check for any warnings about deprecated packages
- [ ] Verify lockfile version matches npm version
- [ ] Run `npm audit` and address vulnerabilities
- [ ] Check for duplicate packages: `npm dedupe`
- [ ] Verify lockfile format is consistent (lockfileVersion: 3)

### Backend Lockfile Verification (Go)
- [ ] Run `go mod verify` to check checksums
- [ ] Run `go mod tidy` and verify no changes
- [ ] Check for indirect dependencies that should be direct
- [ ] Verify `go.sum` is complete and accurate
- [ ] Run `go mod graph` to visualize dependencies
- [ ] Check for replace/exclude directives and document reasons

### Reproducibility Testing
- [ ] Fresh clone on different machine/container
- [ ] Run install without cache
  ```bash
  # Frontend
  npm ci --prefer-offline=false
  
  # Backend
  go clean -modcache && go mod download
  ```
- [ ] Verify builds are identical (checksum comparison)
- [ ] Test in CI environment matches local

### Phantom Install Detection
- [ ] Check for packages in `node_modules` not in `package-lock.json`
- [ ] Verify no global packages leak into local install
- [ ] Check for peer dependency warnings
- [ ] Ensure devDependencies don't leak to production
- [ ] Audit `postinstall` scripts for unexpected behavior

### Version Pinning Strategy
- [ ] Document version pinning strategy in `docs/VERSION_MATRIX.md`
- [ ] Verify critical dependencies are pinned (exact versions)
- [ ] Check for overly restrictive version constraints
- [ ] Consider using `npm shrinkwrap` for published packages
- [ ] Document acceptable version ranges

### CI/CD Integration
- [ ] Update CI to use `npm ci` instead of `npm install`
- [ ] Add lockfile validation in CI pipeline
- [ ] Cache dependencies correctly in CI
- [ ] Verify builds are reproducible in CI
- [ ] Add job to check for lockfile drift

## ✅ Acceptance Criteria
- [ ] `npm ci` runs without errors or warnings
- [ ] `go mod verify` passes successfully
- [ ] Fresh installs are reproducible across environments
- [ ] No phantom packages detected
- [ ] No lockfile drift after `npm install` or `go mod tidy`
- [ ] All dependency checksums verified
- [ ] CI builds are reproducible
- [ ] Documentation updated with pinning strategy

## 🧪 Verification Steps
1. Fresh clone in clean Docker container
2. Install dependencies without cache
3. Run builds and compare checksums
4. Verify no unexpected files in `node_modules`
5. Check CI logs for any warnings

## 📊 Success Metrics
- Total dependencies (frontend): ___
- Total dependencies (backend): ___
- Vulnerabilities: ___ (should be 0 high/critical)
- Lockfile conflicts: ___ (should be 0)
- Reproducibility: ___% (should be 100%)

## 🔗 Related Documentation
- [npm ci documentation](https://docs.npmjs.com/cli/ci)
- [go mod verify](https://golang.org/ref/mod#go-mod-verify)
- [VERSION_MATRIX.md](../docs/VERSION_MATRIX.md)

## 📝 Notes
- Always use `npm ci` in CI/CD pipelines
- Commit lockfiles to version control
- Run `npm audit fix` carefully, test after updates
- Document any version pinning decisions
