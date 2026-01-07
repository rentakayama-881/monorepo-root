# 🤝 Contributing Guide

> Panduan untuk berkontribusi ke Alephdraad.

---

## 🎯 Ways to Contribute

1. **Report Bugs** - Laporkan masalah yang ditemukan
2. **Suggest Features** - Usulkan fitur baru
3. **Write Documentation** - Bantu dokumentasi
4. **Submit Code** - Kirim pull request
5. **Review PRs** - Review pull request orang lain

---

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork di GitHub, lalu:
git clone https://github.com/YOUR_USERNAME/alephdraad.git
cd alephdraad
```

### 2. Setup Development Environment

```bash
# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev

# Backend Gin
cd ../backend
go mod download
cp .env.example .env
go run main.go

# Feature Service
cd ../feature-service
dotnet restore
dotnet run --project src/FeatureService.Api
```

### 3. Create Branch

```bash
git checkout -b feature/your-feature-name
# atau
git checkout -b fix/bug-description
```

---

## 📝 Commit Guidelines

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
# Feature
git commit -m "feat(auth): add passkey login support"

# Bug fix
git commit -m "fix(api): resolve token refresh race condition"

# Documentation
git commit -m "docs(readme): update installation instructions"
```

---

## 🔀 Pull Request Process

### Before Submitting

```
[ ] Code compiles without errors
[ ] All tests pass
[ ] No linting errors
[ ] Documentation updated (if needed)
[ ] Changelog updated (for features)
```

### PR Title Format

```
type(scope): description

Examples:
feat(frontend): add dark mode toggle
fix(backend): handle null user in session
docs(api): add authentication examples
```

### PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe testing done.

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
```

---

## 🧪 Testing Requirements

### Backend Gin (Go)

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./services/...
```

### Feature Service (.NET)

```bash
# Run all tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
```

### Frontend (Next.js)

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

---

## 📏 Code Style

### Go (Backend)

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use `gofmt` for formatting
- Lint with `golangci-lint`

```bash
# Format
gofmt -w .

# Lint
golangci-lint run
```

### C# (Feature Service)

- Follow [C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- Use `dotnet format`

```bash
dotnet format
```

### JavaScript/TypeScript (Frontend)

- Follow ESLint configuration
- Use Prettier for formatting

```bash
npm run lint
npm run format
```

---

## 🏗️ Architecture Guidelines

### Adding New API Endpoint

1. **Define DTO** (if new data structure)
2. **Add Service method** (business logic)
3. **Create Handler** (HTTP handling)
4. **Register Route** (in main.go or Program.cs)
5. **Add Tests**
6. **Update Documentation**

### Adding New Frontend Page

1. **Create page** in `app/` directory
2. **Add components** if needed
3. **Create hooks** for data fetching
4. **Add to navigation** if needed
5. **Add tests**
6. **Update documentation**

---

## 🔐 Security Guidelines

### DO

- Use parameterized queries
- Validate all user input
- Use proper authentication checks
- Log security events
- Follow principle of least privilege

### DON'T

- Hardcode secrets
- Log sensitive data
- Trust client-side validation alone
- Expose stack traces to users
- Use deprecated crypto

---

## 📞 Getting Help

### Communication Channels

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - Questions, ideas
- **Discord** - Real-time chat (coming soon)

### Response Times

| Type | Expected Response |
|------|-------------------|
| Security issues | < 24 hours |
| Bug reports | < 72 hours |
| Feature requests | < 1 week |
| PRs | < 1 week |

---

## 🏆 Recognition

Contributors are recognized in:
- README.md Contributors section
- Release notes
- Special contributor badge (coming soon)

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Terima kasih sudah berkontribusi ke Alephdraad! 🙏
