# Contributing to QuantBlotterSim

Welcome to the team! This guide will walk you through our development workflow from initial setup to getting your code merged into production.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Branch Strategy](#branch-strategy)
- [Development Workflow](#development-workflow)
- [Testing Requirements](#testing-requirements)
- [Code Review Process](#code-review-process)
- [Deployment Pipeline](#deployment-pipeline)

---

## Getting Started

### 1. Accept Repository Invite

You'll receive a GitHub collaboration invite via email. Click the link to accept access to:
```
https://github.com/mdeadwiler/pf-blotter-fix
```

### 2. Clone the Repository

```bash
# Clone via SSH (recommended)
git clone git@github.com:mdeadwiler/pf-blotter-fix.git

# Or clone via HTTPS
git clone https://github.com/mdeadwiler/pf-blotter-fix.git

cd pf-blotter-fix
```

### 3. Configure Git Identity

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

---

## Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Frontend build |
| npm | 9+ | Package management |
| Docker | 24+ | Backend containerization |
| Git | 2.40+ | Version control |

### Frontend Setup

```bash
cd pf-blotter_frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Frontend runs at http://localhost:5173
```

### Backend Setup (Docker)

```bash
cd pf-blotter_backend

# Build the Docker image
docker build -t qf-gateway .

# Run the container
docker run -p 8080:8080 qf-gateway

# Backend runs at http://localhost:8080
```

### Backend Setup (Local - requires QuickFIX)

```bash
cd pf-blotter_backend

# Install QuickFIX (macOS)
brew install quickfix

# Build
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc)

# Run
./qf_gateway
```

### Verify Setup

```bash
# Check backend health
curl http://localhost:8080/health
# Expected: {"status":"ok"}

# Check frontend
open http://localhost:5173
```

---

## Branch Strategy

We use a **three-tier branch model**:

```
main (production)
  │
  └── dev (integration/staging)
        │
        └── feature/* (your work)
        └── bugfix/*
        └── hotfix/*
```

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| New feature | `feature/short-description` | `feature/add-stop-loss-orders` |
| Bug fix | `bugfix/issue-description` | `bugfix/fix-cors-headers` |
| Hot fix | `hotfix/critical-issue` | `hotfix/fix-order-crash` |
| Refactor | `refactor/area-description` | `refactor/optimize-order-store` |

---

## Development Workflow

### Step 1: Sync with Latest Code

```bash
# Switch to dev branch
git checkout dev

# Pull latest changes
git pull origin dev
```

### Step 2: Create Your Feature Branch

```bash
# Create and switch to new branch
git checkout -b feature/your-feature-name

# Example
git checkout -b feature/add-trailing-stop-orders
```

### Step 3: Make Your Changes

Write your code following our conventions:

**Frontend (TypeScript/React)**
- Use functional components with hooks
- Type all props and state
- Use TailwindCSS for styling
- Place new components in `src/components/`

**Backend (C++)**
- Follow C++20 standards
- Use RAII for resource management
- Document public APIs with comments
- Place new source files in `src/`

### Step 4: Commit Your Changes

```bash
# Stage specific files
git add src/components/NewFeature.tsx

# Or stage all changes
git add -A

# Commit with descriptive message
git commit -m "Add trailing stop order type

- Implement TrailingStopOrder component
- Add trailing stop logic to order handler
- Update order types enum
- Add unit tests for edge cases"
```

**Commit Message Format:**
```
<type>: <short summary>

<detailed description>

<optional: references>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

### Step 5: Keep Your Branch Updated

```bash
# Fetch latest dev changes
git fetch origin dev

# Rebase your branch on top of dev
git rebase origin/dev

# Resolve any conflicts if they occur
# Then continue rebase
git rebase --continue
```

### Step 6: Push Your Feature Branch

```bash
# First push (set upstream)
git push -u origin feature/your-feature-name

# Subsequent pushes
git push

# If you rebased, force push (only on YOUR feature branch)
git push --force-with-lease
```

---

## Testing Requirements

### All code must pass these checks before merging:

### Frontend Tests

```bash
cd pf-blotter_frontend

# Type checking
npm run build  # Includes TypeScript compilation

# Lint check
npm run lint

# Run tests (if available)
npm test
```

### Backend Tests

```bash
cd pf-blotter_backend

# Build in debug mode
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc)

# Run tests (if available)
ctest --output-on-failure
```

### Manual Testing Checklist

Before submitting for review, verify:

- [ ] Frontend compiles without errors (`npm run build`)
- [ ] Backend compiles without errors (`make`)
- [ ] No TypeScript/ESLint warnings
- [ ] Feature works in Chrome, Firefox, Safari
- [ ] Mobile responsive (test at 375px width)
- [ ] Dark mode works correctly
- [ ] No console errors in browser DevTools
- [ ] SSE connection stays stable (no disconnects)
- [ ] All existing features still work (regression test)

### Integration Testing

```bash
# Start backend
cd pf-blotter_backend && docker run -p 8080:8080 qf-gateway

# In another terminal, start frontend
cd pf-blotter_frontend && npm run dev

# Test the full flow:
# 1. Sign in
# 2. Submit a test order
# 3. Verify order appears in blotter
# 4. Cancel the order
# 5. Check all tabs work
```

---

## Code Review Process

### Step 1: Create Pull Request to `dev`

```bash
# Using GitHub CLI
gh pr create --base dev --title "Add trailing stop orders" --body "
## Summary
- Added trailing stop order type
- Implemented price tracking logic

## Testing
- [x] Unit tests pass
- [x] Manual testing complete
- [x] No regressions

## Screenshots
(attach if UI changes)
"
```

Or create via GitHub web interface:
1. Go to https://github.com/mdeadwiler/pf-blotter-fix/pulls
2. Click "New Pull Request"
3. Set **base:** `dev` ← **compare:** `feature/your-feature-name`
4. Fill in description
5. Request reviewers

### Step 2: Address Review Feedback

```bash
# Make requested changes
git add -A
git commit -m "Address review feedback: improve error handling"
git push
```

### Step 3: Merge to Dev

Once approved:
1. Reviewer clicks "Squash and Merge" (or "Rebase and Merge")
2. Delete the feature branch after merge

```bash
# Clean up local branch
git checkout dev
git pull origin dev
git branch -d feature/your-feature-name
```

---

## Deployment Pipeline

### Dev → Staging (Automatic)

When code is merged to `dev`:
1. CI runs all tests
2. If tests pass, deploys to staging environment
3. Staging URL: `https://quantblottersim-dev.onrender.com` (if configured)

### Dev → Main (Production Release)

After QA approval on staging:

```bash
# Switch to dev
git checkout dev
git pull origin dev

# Create PR from dev to main
gh pr create --base main --head dev --title "Release: v1.x.x" --body "
## Release Notes
- Feature A
- Bug fix B
- Improvement C

## QA Sign-off
- [x] Staging tested
- [x] No critical bugs
- [x] Performance acceptable
"
```

### Production Deployment

1. PR from `dev` to `main` is reviewed
2. Lead engineer approves and merges
3. Render automatically deploys from `main`
4. Production URL: https://quantblottersim.onrender.com

---

## Quick Reference

### Common Commands

```bash
# View all branches
git branch -a

# Switch branches
git checkout <branch-name>

# See commit history
git log --oneline -20

# See what's changed
git status
git diff

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Stash changes temporarily
git stash
git stash pop

# View remote URLs
git remote -v
```

### Emergency Procedures

**Revert a bad commit on main:**
```bash
git checkout main
git revert <commit-hash>
git push origin main
```

**Hotfix workflow:**
```bash
git checkout main
git checkout -b hotfix/critical-bug
# Fix the bug
git commit -m "hotfix: fix critical order processing bug"
git push -u origin hotfix/critical-bug
# Create PR directly to main (skip dev for emergencies)
```

---

## Questions?

- **Slack:** #quantblotter-dev
- **Email:** mdeadwiler@example.com
- **GitHub Issues:** https://github.com/mdeadwiler/pf-blotter-fix/issues

Welcome aboard! 🚀
