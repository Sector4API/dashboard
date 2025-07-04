# Development Workflow Guide

This document explains how to use the development build and deployment setup for testing changes before merging to the main branch.

## Branch Structure

- `main` / `master` - Production branch (auto-deploys to production)
- `dev` / `development` - Development branch (auto-deploys to staging)
- `feature/*` - Feature branches (runs CI checks only)

## GitHub Actions Workflows

### 1. CI - Build & Test (`ci.yml`)
- **Triggers**: All pushes and pull requests
- **Purpose**: Runs linting, type checking, and builds the app
- **Node versions tested**: 18.x and 20.x
- **No deployment** - just validates code quality

### 2. Development Build (`development.yml`)
- **Triggers**: Pushes to `dev`, `development`, `staging` branches and PRs to `main`
- **Purpose**: Full testing and preview deployment
- **Features**:
  - Runs linting and builds
  - Creates Vercel preview deployments for PRs
  - Tests with real environment variables

### 3. Production Deploy (`production.yml`)
- **Triggers**: Pushes to `main` or `master` branch
- **Purpose**: Deploys to production
- **Features**:
  - Full CI pipeline
  - Deploys to Vercel production

## Setup Instructions

### 1. GitHub Secrets Setup

Add these secrets to your GitHub repository settings:

**Supabase Secrets:**
- `NEXT_PUBLIC_DASHBOARD_SUPABASE_URL`
- `NEXT_PUBLIC_DASHBOARD_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DASHBOARD_SUPABASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_PRODUCT_SUPABASE_URL`
- `NEXT_PUBLIC_PRODUCT_SUPABASE_ANON_KEY`
- `PRODUCT_SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_PRODUCT_SUPABASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_PRODUCT_SUPABASE_TRASH_BUCKET`
- `DASHBOARD_SUPABASE_SERVICE_KEY`

**Vercel Secrets (if using Vercel deployment):**
- `VERCEL_TOKEN` - Your Vercel API token
- `ORG_ID` - Your Vercel organization ID
- `PROJECT_ID` - Your Vercel project ID
- `VERCEL_ORG_ID` - Your Vercel organization ID (same as ORG_ID)

### 2. Development Workflow

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and push:**
   ```bash
   git add .
   git commit -m "Add your feature"
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request:**
   - Target the `dev` or `development` branch
   - GitHub Actions will automatically run CI checks
   - If using Vercel, a preview deployment will be created

4. **Test your changes:**
   - Check the CI results in the GitHub Actions tab
   - Test the preview deployment if available
   - Request code review

5. **Merge to development:**
   - Once approved, merge to `dev` branch
   - This will trigger a development deployment

6. **Promote to production:**
   - When ready, create a PR from `dev` to `main`
   - After approval and merge, it will auto-deploy to production

### 3. Local Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run linting
pnpm lint

# Build for production
pnpm build

# Start production server
pnpm start
```

## Environment Variables

The project requires several environment variables. Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env .env.local
```

## Troubleshooting

### Build Failures
- Check the GitHub Actions logs for detailed error messages
- Ensure all environment variables are properly set
- Verify that your code passes linting with `pnpm lint`

### Deployment Issues
- Verify Vercel secrets are correctly configured
- Check that the Vercel project is properly linked
- Ensure environment variables are set in both GitHub and Vercel

### Environment Variable Issues
- Double-check that all required secrets are added to GitHub
- Verify the secret names match exactly (case-sensitive)
- For local development, ensure `.env.local` is properly configured
