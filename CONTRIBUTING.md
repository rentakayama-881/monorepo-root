# Contributing to AIValid

Thank you for your interest in contributing to AIValid! This document provides guidelines for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see README.md)
4. Create a feature branch

## Development Workflow

### Branch Naming

```
feature/description   # New features
fix/description       # Bug fixes
refactor/description  # Code refactoring
docs/description      # Documentation updates
test/description      # Test additions/updates
```

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code refactoring (no feature change)
- `docs` — Documentation only
- `test` — Adding or updating tests
- `chore` — Maintenance tasks
- `style` — Code style changes (formatting, etc.)
- `perf` — Performance improvements

**Examples:**
```
feat(auth): add passkey login support
fix(wallet): resolve PIN validation edge case
docs(readme): update deployment instructions
test(security): add 2FA requirement tests
```

## Pull Request Process

### Before Submitting

1. **Run all tests:**
   ```bash
   # Backend
   cd backend && go test ./...
   
   # Feature Service
   cd feature-service && dotnet test
   
   # Frontend
   cd frontend && npm run lint && npm run typecheck
   ```

2. **Format your code:**
   ```bash
   # Go
   gofmt -w .
   
   # Frontend
   npm run format
   ```

3. **Check for security issues:**
   - No secrets in code
   - Input validation on all endpoints
   - Authorization checks in place

### PR Requirements

- [ ] Clear description of changes
- [ ] Tests added/updated
- [ ] Documentation updated (if applicable)
- [ ] No breaking changes (or documented if unavoidable)
- [ ] Passes all CI checks

### Review Process

1. Submit PR to `develop` branch
2. Wait for CI checks to pass
3. Request review from maintainers
4. Address feedback
5. Merge once approved

## Code Style Guidelines

### Go (Backend)

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use `gofmt` for formatting
- Handler → Service → Repository pattern
- Error handling: wrap errors with context

### C# (Feature Service)

- Follow [C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- Use dependency injection
- Async/await for I/O operations
- FluentValidation for request validation

### TypeScript/JavaScript (Frontend)

- Follow ESLint configuration
- Use TypeScript for type safety
- Prefer functional components with hooks
- Use SWR for data fetching

## Testing Guidelines

### Unit Tests
- Test business logic in isolation
- Mock external dependencies
- Aim for >80% coverage on critical paths

### Integration Tests
- Test API endpoints
- Use test database
- Clean up test data

### Security Tests
- Validate authorization checks
- Test input validation
- Verify rate limiting

## Questions?

Open a [Discussion](https://github.com/aivalid/discussions) for questions or suggestions.

---

*Last updated: January 12, 2026*
