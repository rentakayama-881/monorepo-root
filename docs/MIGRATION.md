# Migration Guide: Phase 71-80

This guide provides step-by-step migration instructions for the changes introduced in Phases 71-80. It covers major upgrades including migration to TypeScript, introduction of Jest and Playwright for testing, enhancements to CI workflows, and dependency cleanup. Each section includes upgrade paths and rollback instructions.

---

## Overview

- **Phase 71-75**: Migration to TypeScript, basic Jest integration, dependency upgrades, initial CI adjustments.
- **Phase 76-78**: Playwright introduction, advanced CI enhancements, further dependency tightenings.
- **Phase 79-80**: Cleanup, code linting improvements, risk auditing, finalizing upgrade and rollback strategies.

---

## 1. Migrating to TypeScript

### Steps
1. **Install TypeScript and Types**
    ```bash
    npm install --save-dev typescript @types/node @types/react
    ```
2. **Add tsconfig.json**
    - Use `npx tsc --init` or add a base config:
      ```json
      {
        "compilerOptions": {
          "target": "ESNext",
          "module": "ESNext",
          "strict": true,
          "esModuleInterop": true,
          "skipLibCheck": true,
          "forceConsistentCasingInFileNames": true
        },
        "include": ["src"]
      }
      ```
3. **Rename Files**
    - Rename `.js`/`.jsx` files to `.ts`/`.tsx` as appropriate.
4. **Fix Type Errors**
    - Refactor code to address TypeScript errors. Add types where needed.

### Upgrade Path
- Migrate incrementally (directory-by-directory or feature-by-feature).
- Commit after each file/directory is migrated and passes type checks.

### Rollback Instructions
- Revert to previous Git commit before TypeScript introduction.
- Reinstall JavaScript dev dependencies if necessary (remove TypeScript tooling).

---

## 2. Testing with Jest & Playwright

### Jest (Unit & Integration Tests)
- **Installation**:
    ```bash
    npm install --save-dev jest @types/jest ts-jest
    npx ts-jest config:init
    ```
- **Configuration**: Ensure `jest.config.js` targets TypeScript files.
- **Writing Tests**: Place test files alongside code or in a `__tests__` directory (e.g., `example.test.ts`).
- **Running Tests**:
    ```bash
    npx jest
    ```

### Playwright (E2E Testing)
- **Installation**:
    ```bash
    npm install --save-dev playwright
    npx playwright install
    ```
- **Basic Setup**: Add `playwright.config.ts` for environment configuration.
- **Writing Tests**: Place E2E specs in `tests/` (e.g., `login.spec.ts`).
- **Running Tests**:
    ```bash
    npx playwright test
    ```

### Rollback Instructions
- Remove related dev dependencies by running `npm uninstall jest @types/jest ts-jest playwright`.
- Restore previous config files (`jest.config.js`, `playwright.config.ts` if necessary).

---

## 3. CI Enhancements

### Common Improvements
- Use [GitHub Actions](https://docs.github.com/en/actions) or similar for CI.
- Add workflow configuration files (e.g., `.github/workflows/ci.yml`).
    ```yaml
    name: CI
    on: [push, pull_request]
    jobs:
      build:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: '20'
          - run: npm ci
          - run: npm run build --if-present
          - run: npm test
    ```
- Integrate Playwright test steps.
- Cache dependencies for faster builds.

### Rollback Instructions
- Restore previous workflow YAML files/backups.
- Disable or remove workflows in `.github/workflows/`.

---

## 4. Dependency Cleanup & Upgrade Paths

### Steps
- Remove unused or deprecated packages:
    ```bash
    npm prune && npm uninstall <package-name>
    ```
- Upgrade key packages (example):
    ```bash
    npm update
    npm install react@latest react-dom@latest
    npm audit fix
    ```
- Audit and consolidate duplicate dependencies.

### Rollback Instructions
- Restore `package.json` and `package-lock.json` from backup or previous commits.
- Reinstall from a previous lockfile:
    ```bash
    git checkout <prior_commit> package.json package-lock.json
    npm ci
    ```

---

## 5. General Rollback Plan
1. Use `git log` and `git checkout` to revert to a stable pre-migration commit.
2. For npm dependencies/configs, maintain copies of prior `package.json`, `package-lock.json`, and CI configs for restoration.
3. Document encountered issues immediately for future reference.

---

## 6. Recommendations
- Migrate incrementally to minimize disruption.
- Ensure all existing functionality is covered by new TypeScript, Jest, and Playwright tests.
- Take frequent backups/snapshots before major upgrades.
- Review CI logs to catch any integration issues early.

---

For questions or help with a specific migration step, contact the core engineering team or file an issue in the repo.
