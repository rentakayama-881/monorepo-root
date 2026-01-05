---
name: "Phase 71: Audit and Remove Unused Dependencies/Code Paths"
about: Identify and remove unused dependencies, dead code, and unnecessary imports
title: "[Phase 71] Audit and Remove Unused Dependencies/Code Paths"
labels: phase-71, cleanup, dependencies, technical-debt
assignees: ''
---

## 🎯 Objective
Audit the codebase to identify and remove unused dependencies, dead code paths, and unnecessary imports to reduce bundle size and improve maintainability.

## 📋 Tasks

### Frontend (Next.js/React)
- [ ] Run `npm ls` to visualize dependency tree
- [ ] Use `depcheck` to identify unused dependencies
  ```bash
  npx depcheck frontend/
  ```
- [ ] Audit `package.json` dependencies vs devDependencies
- [ ] Remove unused npm packages
- [ ] Check for duplicate dependencies with different versions
- [ ] Use `next bundle-analyzer` to identify large unused modules
- [ ] Remove unused imports (run ESLint with unused-imports rule)
- [ ] Verify no broken imports after cleanup

### Backend (Go/Gin)
- [ ] Run `go mod tidy` to clean up `go.mod` and `go.sum`
- [ ] Use `go mod graph | grep <module>` to find unused modules
- [ ] Check for unused imports with `goimports -l .`
- [ ] Run `go vet ./...` to identify unused code
- [ ] Consider using `golangci-lint` with `unused` linter enabled
- [ ] Remove commented-out code blocks
- [ ] Verify all imports are used

### General Code Cleanup
- [ ] Search for TODO/FIXME comments and create tickets or resolve
- [ ] Remove debug/console logs not needed in production
- [ ] Delete unused files and directories
- [ ] Remove feature flags for completed features
- [ ] Check for unreachable code paths

## ✅ Acceptance Criteria
- [ ] All unused dependencies removed from `package.json` and `go.mod`
- [ ] `npm ls` and `go mod graph` show clean dependency trees
- [ ] No unused imports detected by linters
- [ ] Bundle size reduced (document reduction percentage)
- [ ] All tests pass after cleanup
- [ ] CI/CD pipeline passes successfully
- [ ] Documentation updated if any public APIs removed

## 🧪 Verification Steps
1. Run frontend build and verify bundle size reduction
2. Run backend build and verify binary size
3. Execute full test suite (frontend + backend)
4. Run linters and type checkers
5. Manually test critical user flows

## 📊 Success Metrics
- Dependencies removed: ___ (count)
- Bundle size reduction: ___% 
- Build time improvement: ___% (if any)
- Dead code lines removed: ___

## 🔗 Related Documentation
- [package.json](../frontend/package.json)
- [go.mod](../backend/go.mod)
- [CI Workflows](../.github/workflows/)

## 📝 Notes
- Take backup/commit before major removals
- Test incrementally after each removal
- Document any removed functionality that might be needed later
