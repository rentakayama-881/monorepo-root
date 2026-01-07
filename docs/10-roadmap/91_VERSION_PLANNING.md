# 📅 Version Planning

> Perencanaan versi dan milestone Alephdraad.

---

## 📊 Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | Oct 2025 | Initial MVP |
| 0.2.0 | Nov 2025 | Added 2FA, Passkey |
| 0.3.0 | Dec 2025 | Feature Service (ASP.NET) |
| 0.4.0 | Dec 2025 | AI Chat (Aleph Assistant) |
| 0.5.0 | Jan 2026 | Token system, Reactions |
| **Current** | **Jan 2026** | **v0.5.x** |

---

## 🎯 Upcoming Releases

### v0.6.0 - "Foundation" (Target: Feb 2026)

**Theme**: Stability & Performance

```
Features:
✓ Complete Ent ORM migration
✓ Redis caching layer
✓ Improved error handling
✓ API response optimization

Breaking Changes:
- None planned

Migration:
- Automatic via Ent migrations
```

### v0.7.0 - "Social" (Target: Mar 2026)

**Theme**: Social Features

```
Features:
✓ Real-time notifications
✓ Follow system
✓ Improved search
✓ Thread bookmarks

Breaking Changes:
- None planned
```

### v0.8.0 - "AI+" (Target: Apr 2026)

**Theme**: Enhanced AI

```
Features:
✓ AI thread summarization
✓ Smart recommendations
✓ Code explanation
✓ Duplicate detection

Breaking Changes:
- AI API response format changes
```

### v1.0.0 - "Stable" (Target: Jun 2026)

**Theme**: Production Ready

```
Features:
✓ All major features complete
✓ 80%+ test coverage
✓ Complete documentation
✓ Performance optimized
✓ Security audited

Requirements for v1.0:
[ ] No critical bugs for 30 days
[ ] All P1 features complete
[ ] Load tested for 10k concurrent users
[ ] Security audit passed
```

---

## 📋 Semantic Versioning

Alephdraad follows [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes
MINOR: New features (backward compatible)
PATCH: Bug fixes (backward compatible)
```

### Pre-1.0 Rules
```
0.x.y - Development phase
- Minor version = may include breaking changes
- Patch version = backward compatible
```

### Post-1.0 Rules
```
1.x.y - Stable phase
- Major version = breaking changes
- Minor version = new features
- Patch version = bug fixes
```

---

## 🔄 Release Process

### 1. Development

```bash
# Feature branch
git checkout -b feature/new-feature
# ... development ...
git push origin feature/new-feature
# Create PR
```

### 2. Review & Testing

```
[ ] Code review approved
[ ] All tests passing
[ ] No security issues
[ ] Documentation updated
```

### 3. Staging Deploy

```bash
# Merge to staging
git checkout staging
git merge feature/new-feature

# Auto-deploy to staging environment
# Test in staging for 24-48 hours
```

### 4. Production Release

```bash
# Merge to main
git checkout main
git merge staging

# Create version tag
git tag -a v0.6.0 -m "Release v0.6.0"
git push origin v0.6.0

# Auto-deploy to production
```

### 5. Post-release

```
[ ] Monitor logs for errors
[ ] Check performance metrics
[ ] Update changelog
[ ] Announce release
```

---

## 📝 Changelog Format

```markdown
# Changelog

## [0.6.0] - 2026-02-15

### Added
- Redis caching for improved performance
- Health check endpoint with dependencies

### Changed
- Migrated all services to Ent ORM
- Improved error messages

### Deprecated
- GORM models (will be removed in v0.8.0)

### Removed
- Legacy API endpoints

### Fixed
- Token refresh race condition
- Session timeout issues

### Security
- Updated dependencies
- Added rate limiting per user
```

---

## 🏷️ Branch Strategy

```
main (production)
  │
  ├── staging (pre-production)
  │     │
  │     ├── feature/xyz
  │     ├── feature/abc
  │     └── bugfix/123
  │
  └── hotfix/urgent-fix (emergency)
```

### Branch Rules

| Branch | Deploys To | Protection |
|--------|------------|------------|
| main | Production | Require PR, 2 reviews |
| staging | Staging | Require PR, 1 review |
| feature/* | Preview | None |
| hotfix/* | Production | Require 1 review |

---

## 📊 Milestone Tracking

### Q1 2026 Milestones

| Milestone | Status | Target Date |
|-----------|--------|-------------|
| Ent Migration | 🔄 In Progress | Jan 31 |
| Redis Setup | ⏳ Planned | Feb 15 |
| v0.6.0 Release | ⏳ Planned | Feb 28 |

### Q2 2026 Milestones

| Milestone | Status | Target Date |
|-----------|--------|-------------|
| Real-time MVP | ⏳ Planned | Mar 31 |
| Follow System | ⏳ Planned | Apr 15 |
| v0.7.0 Release | ⏳ Planned | Apr 30 |
| v0.8.0 Release | ⏳ Planned | May 31 |

### Q3 2026 Milestones

| Milestone | Status | Target Date |
|-----------|--------|-------------|
| AI Enhancements | ⏳ Planned | Jul 31 |
| v1.0.0 Beta | ⏳ Planned | Aug 31 |
| v1.0.0 Release | ⏳ Planned | Sep 30 |

---

## ▶️ Selanjutnya

- [92_CONTRIBUTING.md](./92_CONTRIBUTING.md) - How to contribute
