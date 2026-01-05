# GitHub Issue Templates - Phase 71-80

This directory contains issue templates for the production readiness initiative (Phase 71-80).

## Overview

These templates guide the execution of 10 critical phases to ensure the codebase is production-ready:

| Phase | Focus Area | Priority |
|-------|------------|----------|
| **Phase 71** | Dependency & Code Cleanup | High |
| **Phase 72** | Bundle Optimization | Medium |
| **Phase 73** | Dependency Stability | High |
| **Phase 74** | Quality Gates | Critical |
| **Phase 75** | Version Documentation | High |
| **Phase 76** | Migration Docs | ✅ Complete |
| **Phase 77** | PR Checklist | ✅ Complete |
| **Phase 78** | Tech Debt Planning | Medium |
| **Phase 79** | Comprehensive Testing | Critical |
| **Phase 80** | Final Verification | Critical |

## How to Use

### Creating Issues from Templates

1. Go to the [New Issue](../../issues/new/choose) page
2. Select the appropriate phase template
3. Fill in the template with specific details
4. Assign to appropriate team member
5. Add to Phase 71-80 milestone/project board

### Template Structure

Each template includes:
- **Objective**: Clear goal for the phase
- **Tasks**: Comprehensive checklist of actions
- **Acceptance Criteria**: Definition of done
- **Verification Steps**: How to validate completion
- **Success Metrics**: Measurable outcomes
- **Related Documentation**: Links to relevant docs

### Execution Order

**Recommended sequence:**

1. **Phase 74** - Establish baseline quality metrics
2. **Phase 71** - Clean up dependencies and code
3. **Phase 73** - Ensure lockfile stability
4. **Phase 72** - Optimize bundle size
5. **Phase 78** - Review and plan tech debt
6. **Phase 75** - Document versions and changes
7. **Phase 79** - Comprehensive smoke testing
8. **Phase 80** - Final verification gate

**Note**: Phases 76 and 77 are already complete (documentation created).

### Parallel Execution

These phases can be worked on in parallel:
- Phases 71, 72, 73 (different focus areas)
- Phase 78 (planning can run alongside others)

## Templates

### Available Templates

- `phase-71-audit-unused-dependencies.md` - Dependency and code cleanup
- `phase-72-tree-shaking-exports.md` - Bundle optimization
- `phase-73-lockfile-stability.md` - Dependency stability
- `phase-74-quality-gates.md` - Quality metrics baseline
- `phase-75-version-matrix.md` - Version documentation
- `phase-76-migration-documentation.md` - Migration docs (✅ done)
- `phase-77-pr-checklist.md` - PR checklist (✅ done)
- `phase-78-tech-debt-review.md` - Tech debt planning
- `phase-79-smoke-test-console.md` - Comprehensive testing
- `phase-80-final-verification.md` - Final production gate

### Configuration

- `config.yml` - Issue template configuration

## Tracking Progress

Track overall progress in:
- **Master Document**: [`docs/PHASE_71_80_TRACKING.md`](../../docs/PHASE_71_80_TRACKING.md)
- **GitHub Project Board**: (Create one for Phase 71-80)
- **GitHub Milestone**: (Create milestone "Phase 71-80 Production Readiness")

## Success Criteria

All phases must meet these criteria:
- ✅ All tasks completed
- ✅ All acceptance criteria met
- ✅ All verification steps passed
- ✅ Documentation updated
- ✅ CI/CD pipeline green

## Support

For questions or issues:
1. Check the [main tracking document](../../docs/PHASE_71_80_TRACKING.md)
2. Review [MIGRATION.md](../../docs/MIGRATION.md)
3. Consult [PR_CHECKLIST.md](../../PR_CHECKLIST.md)
4. Ask in team discussions

## Contributing

When updating templates:
1. Keep structure consistent
2. Update related documentation
3. Test template usability
4. Get team review
5. Update this README if needed

---

**Last Updated**: 2026-01-05  
**Status**: Templates ready for use  
**Next Action**: Create GitHub issues from templates
