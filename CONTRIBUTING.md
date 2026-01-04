# Contributing to Alephdraad

Thank you for your interest in contributing to Alephdraad! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

Please be respectful and constructive in all interactions. We're building this together.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a feature branch from `develop`
5. Make your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- **Go** 1.24 or higher
- **Node.js** 20 or higher
- **PostgreSQL** 15 or higher
- **Git**

### Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
go mod download
go run main.go
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your configuration
npm install
npm run dev
```

## Project Structure

```
monorepo-root/
├── backend/          # Go/Gin API server
│   ├── cmd/          # CLI commands
│   ├── config/       # Configuration
│   ├── database/     # Database connection
│   ├── dto/          # Data Transfer Objects
│   ├── errors/       # Custom error types
│   ├── handlers/     # HTTP handlers
│   ├── middleware/   # Gin middleware
│   ├── models/       # Database models
│   ├── services/     # Business logic
│   ├── utils/        # Utility functions
│   ├── validators/   # Input validators
│   └── worker/       # Background workers
├── frontend/         # Next.js application
│   ├── app/          # App router pages
│   ├── components/   # React components
│   ├── lib/          # Utility libraries
│   └── public/       # Static assets
└── docs/             # Documentation
```

## Coding Standards

### Go (Backend)

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use `gofmt` for formatting
- Use `golangci-lint` for linting
- Write tests for new functionality
- Handle errors explicitly

```go
// Good
if err != nil {
    return fmt.Errorf("failed to process: %w", err)
}

// Avoid
if err != nil {
    return err
}
```

### JavaScript/React (Frontend)

- Use functional components with hooks
- Follow ESLint rules defined in the project
- Use Prettier for formatting
- Prefer named exports over default exports for utilities
- Use descriptive variable and function names

```javascript
// Good
const handleUserSubmit = async (formData) => {
  // ...
};

// Avoid
const submit = async (d) => {
  // ...
};
```

### TypeScript Migration

The frontend is gradually migrating to TypeScript for better type safety and developer experience.

#### Current Status
- TypeScript infrastructure is configured with strict mode enabled
- JavaScript files are still supported and type-checked using JSDoc comments
- New files should be written in TypeScript when possible
- Existing files can remain as JavaScript until actively modified

#### Guidelines
- **New features**: Write in TypeScript (`.ts`, `.tsx` extensions)
- **Bug fixes**: You may keep existing JavaScript files, but consider converting critical files
- **Refactoring**: Good opportunity to migrate to TypeScript
- Use JSDoc comments in JavaScript files for type hints:

```javascript
/**
 * @param {string} userId - The user ID
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeMetadata - Include metadata
 * @returns {Promise<User>}
 */
async function fetchUser(userId, options) {
  // ...
}
```

#### Type Checking
Run type checking locally before committing:
```bash
npm run typecheck
```

#### Priority Files for Migration
Consider migrating these file types first:
1. Utility functions and helpers (`lib/`)
2. API client code
3. Complex components with business logic
4. Shared components (`components/ui/`)

### CSS/Styling

- Use Tailwind CSS utility classes
- Use CSS variables from `globals.css` for theming
- Follow mobile-first responsive design

```jsx
// Good - uses theme variables
<div className="bg-[rgb(var(--surface))] text-[rgb(var(--fg))]">

// Avoid - hardcoded colors
<div className="bg-gray-800 text-white">
```

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(wallet): add withdrawal functionality
fix(auth): resolve token expiration issue
docs(readme): update installation instructions
refactor(handlers): extract common validation logic
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests if applicable
   - Update documentation if needed

3. **Test your changes**
   ```bash
   # Backend
   cd backend && go test ./...
   
   # Frontend
   cd frontend && npm run lint && npm run typecheck && npm run build
   ```

4. **Commit your changes**
   ```bash
   git commit -m "feat(scope): description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   ```

6. **PR Requirements**
   - Clear description of changes
   - Link to related issue (if any)
   - All CI checks passing
   - Code review approval

## Questions?

If you have questions, please open an issue or reach out to the maintainers.

---

Thank you for contributing! 🎉
