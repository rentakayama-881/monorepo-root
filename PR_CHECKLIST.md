# Pull Request Final Checklist

Use this checklist to ensure your pull request meets all deliverable, quality, and safety requirements before merging.

---

## 1. Code Quality Gates
- [ ] All code follows the project's style and linting rules
- [ ] No critical linter or static analysis warnings/errors
- [ ] Code is modular, DRY (Don't Repeat Yourself), and well-organized
- [ ] No commented-out or dead code remains
- [ ] Code review feedback (if any) is addressed

## 2. Documentation Requirements
- [ ] All new/changed APIs, modules, or components are documented
- [ ] README and other relevant documentation are updated (if applicable)
- [ ] Code is commented where necessary for clarity

## 3. Security Checks
- [ ] No hard-coded secrets, credentials, or sensitive data in code or configuration
- [ ] Input validation and output encoding are in place to prevent common vulnerabilities (e.g., XSS, SQL Injection)
- [ ] Dependencies are up-to-date and free from known vulnerabilities

## 4. Testing Requirements
- [ ] All new features or changes have corresponding unit and/or integration tests
- [ ] Existing tests pass (run locally or via CI)
- [ ] No decrease in test coverage; code meets or exceeds coverage thresholds
- [ ] Manual and/or exploratory testing completed as needed

## 5. Deployment Readiness
- [ ] All environment/configuration changes are documented
- [ ] Migrations (if any) are backward compatible and tested
- [ ] Feature flags or canary releases configured as appropriate

## 6. Post-Merge Verification Steps
- [ ] Monitor deployment/automation pipelines for errors
- [ ] Confirm successful deployment (staging/production as applicable)
- [ ] Smoke-test application after deployment
- [ ] Monitor logs and alerts for anomalies

---

If all boxes are checked, your PR is ready for final review and merge!
