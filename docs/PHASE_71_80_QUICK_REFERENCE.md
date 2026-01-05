# Phase 71-80 Quick Reference Guide

This is a quick reference for teams executing the production readiness phases.

## Quick Links

- 📊 [Full Tracking Document](./PHASE_71_80_TRACKING.md)
- 📝 [Migration Guide](./MIGRATION.md)
- ✅ [PR Checklist](../PR_CHECKLIST.md)
- 🔢 [Version Matrix](./VERSION_MATRIX.md)
- 🗂️ [Issue Templates](../.github/ISSUE_TEMPLATE/)

## Phase Summary

### Critical Phases (Must Complete)
- **Phase 74**: Quality Gates - Establish baseline ⚠️
- **Phase 79**: Smoke Testing - Test everything ⚠️
- **Phase 80**: Final Verification - Production gate ⚠️

### High Priority Phases
- **Phase 71**: Dependency Cleanup
- **Phase 73**: Lockfile Stability
- **Phase 75**: Version Documentation

### Medium Priority Phases
- **Phase 72**: Tree-Shaking Optimization
- **Phase 78**: Tech Debt Review

### Completed Phases ✅
- **Phase 76**: Migration Documentation
- **Phase 77**: PR Checklist

## Quick Commands

### Frontend
```bash
# Audit dependencies
cd frontend
npx depcheck

# Bundle analysis
ANALYZE=true npm run build

# Full quality check
npm run lint && npm run typecheck && npm run build

# Fresh install
rm -rf node_modules package-lock.json
npm install
npm ci
```

### Backend
```bash
# Clean up dependencies
cd backend
go mod tidy
go mod verify

# Full quality check
go vet ./...
golangci-lint run --timeout=5m
go test -v -race -coverprofile=coverage.out ./...

# Fresh build
go clean -cache -modcache
go build -v ./...
```

### CI/CD
```bash
# Check CI locally (if using act)
act -j frontend-lint
act -j backend-test

# Security scan
trivy fs --severity HIGH,CRITICAL .
```

## Phase Checklist

### Week 1
- [ ] Create GitHub milestone "Phase 71-80"
- [ ] Create issues from templates
- [ ] Assign phase owners
- [ ] Run Phase 74 (baseline metrics)
- [ ] Start Phase 71 (dependency cleanup)
- [ ] Start Phase 73 (lockfile stability)

### Week 2
- [ ] Complete Phase 71
- [ ] Complete Phase 73
- [ ] Execute Phase 72 (tree-shaking)
- [ ] Execute Phase 78 (tech debt)
- [ ] Update Phase 75 (version docs)

### Week 3
- [ ] Execute Phase 79 (smoke testing)
- [ ] Execute Phase 80 (final verification)
- [ ] Get team sign-off
- [ ] Prepare for production release

## Common Issues & Solutions

### Issue: Dependency conflicts
**Solution**: 
```bash
# Frontend
npm ls <package-name>
npm dedupe

# Backend
go mod graph | grep <module>
go mod tidy
```

### Issue: Build failures after cleanup
**Solution**:
- Check for circular dependencies
- Verify import paths
- Review go.sum/package-lock.json for corruption
- Fresh install in clean environment

### Issue: Console errors in production
**Solution**:
- Build with production mode
- Check browser console (Chrome DevTools)
- Review Next.js build output
- Check server logs

### Issue: CI/CD pipeline failures
**Solution**:
- Compare local vs CI environment
- Check environment variables
- Verify cache isn't stale
- Review workflow logs

## Quality Gate Targets

| Metric | Target | Current |
|--------|--------|---------|
| Lint Errors | 0 | TBD |
| TypeScript Errors | 0 | TBD |
| Test Coverage | ≥70% | TBD |
| Security Vulnerabilities | 0 critical/high | TBD |
| Console Errors | 0 | TBD |
| Build Success | 100% | TBD |

## Key Deliverables

### Documentation
- [x] MIGRATION.md
- [x] VERSION_MATRIX.md
- [x] PR_CHECKLIST.md
- [x] PHASE_71_80_TRACKING.md
- [ ] TECH_DEBT.md (Phase 78)
- [ ] Updated CHANGELOG.md (Phase 75)

### Quality Metrics
- [ ] Baseline metrics recorded (Phase 74)
- [ ] Dependency audit complete (Phase 71)
- [ ] Bundle size optimization (Phase 72)
- [ ] Lockfile stability verified (Phase 73)
- [ ] All routes tested (Phase 79)
- [ ] Final builds pass (Phase 80)

### Production Readiness
- [ ] Zero critical bugs
- [ ] All tests passing
- [ ] Documentation complete
- [ ] CI/CD green
- [ ] Team sign-off
- [ ] Deployment ready

## Team Contacts

| Role | Responsibility | Contact |
|------|----------------|---------|
| Tech Lead | Overall coordination | TBD |
| Frontend Lead | Phases 71, 72, 79 | TBD |
| Backend Lead | Phases 71, 73 | TBD |
| QA Lead | Phases 74, 79, 80 | TBD |
| DevOps Lead | Phase 80 deployment | TBD |
| Product Owner | Sign-off | TBD |

## Daily Standup Questions

1. Which phase are you working on?
2. What did you complete yesterday?
3. What will you complete today?
4. Any blockers?
5. Do you need help from anyone?

## Definition of Done (per Phase)

- [ ] All tasks in issue template completed
- [ ] All acceptance criteria met
- [ ] All verification steps passed
- [ ] Documentation updated
- [ ] PR reviewed and merged
- [ ] CI/CD pipeline green
- [ ] Issue closed with summary

## Emergency Contacts

### If Production Issues Occur
1. **Stop deployment** immediately
2. Follow rollback procedure in [MIGRATION.md](./MIGRATION.md)
3. Notify team leads
4. Document the issue
5. Create incident post-mortem

### If Phase is Blocked
1. Document blocker in issue
2. Notify phase owner
3. Escalate to tech lead if needed
4. Update tracking document
5. Consider workaround or re-prioritization

## Resources

### Tools
- [depcheck](https://www.npmjs.com/package/depcheck) - Dependency checker
- [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) - Bundle analysis
- [golangci-lint](https://golangci-lint.run/) - Go linter
- [trivy](https://github.com/aquasecurity/trivy) - Security scanner

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Go Docs](https://golang.org/doc/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

### Monitoring
- CI/CD Pipeline: `.github/workflows/`
- Application Logs: Check server logs
- Error Tracking: Review console/logs

---

**Remember**: Quality over speed. It's better to take time and get it right than rush and create issues.

**Questions?** Check the full [tracking document](./PHASE_71_80_TRACKING.md) or ask your team lead.
