# Contributing to mydoc.ai

## Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Frontend Web
cd frontend-web
npm install

# Mobile
cd frontend-mobile
flutter pub get
```

## Code Standards

### Backend (Python)
- Follow PEP 8
- Use type hints
- Format with Black
- Lint with flake8

```bash
black app/
flake8 app/
mypy app/
```

### Frontend (TypeScript/JavaScript)
- ESLint configuration enforced
- Prettier for formatting
- Type safety required

```bash
npm run lint
npm run format
```

### Mobile (Dart)
- Follow Dart style guide
- Format with `dart format`

```bash
dart format lib/
dart analyze lib/
```

## Testing

### Backend
```bash
pytest tests/ -v --cov=app
```

### Frontend Web
```bash
npm test
```

### Mobile
```bash
flutter test
```

## Git Workflow

1. **Branch naming**
   - `feature/` - New features
   - `fix/` - Bug fixes
   - `docs/` - Documentation
   - `refactor/` - Code refactoring
   - `chore/` - Maintenance

2. **Commit messages**
   - Use present tense ("Add feature" not "Added feature")
   - Reference issues: "Fix #123"
   - Keep messages clear and concise

3. **PR Guidelines**
   - Describe what and why
   - Link related issues
   - Include screenshots for UI changes
   - Ensure CI passes

## Architecture Guidelines

### Backend
- Keep routers thin (routing logic only)
- Put business logic in services/
- Use dependency injection
- Write service layer tests first

### Frontend
- Components should be small and reusable
- Use custom hooks for logic
- Keep components presentational
- State management via Zustand/Riverpod

## Database Changes

1. Create migration in `database/migrations/`
2. Test against staging database
3. Document in [docs/DATABASE.md](./docs/DATABASE.md)
4. Include rollback plan

## Security

- Never commit `.env` files or secrets
- Use environment variables for configuration
- Request sensitive data via HTTPS only
- Validate all user inputs
- Use parameterized queries (ORM handles this)
- Report security issues privately to security@mydoc.ai

## Performance

- Keep API responses <500ms (p95)
- Paginate large result sets
- Use indexes for common queries
- Cache expensive computations
- Monitor metrics in production

## Documentation

- Update README.md for new features
- Add comments for complex logic
- Keep API docs current
- Document architecture decisions in ADRs

## Review Process

1. Peer review (1+ approval)
2. CI/CD tests pass
3. No merge conflicts
4. Maintainer approval for main branch

## Release Process

1. Update version in `app/__init__.py`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will build and deploy

## Questions?

- GitHub Issues for bugs and features
- GitHub Discussions for questions
- Email: dev@mydoc.ai for security issues
