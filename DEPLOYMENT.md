# Deployment Guide

This guide explains how to use the pre-built Docker image from GitHub Container Registry.

## Prerequisites

1. Docker and Docker Compose installed
2. GitHub account with access to the repository
3. GitHub Personal Access Token (PAT) with `read:packages` permission

## Building Image

The image is automatically built and pushed to GitHub Container Registry when you:
- Push to `main` or `master` branch
- Create a tag (e.g., `v1.0.0`)
- Manually trigger the workflow

The workflow builds a single combined image containing both frontend and backend:
- `ghcr.io/<username>/<repo>:latest`

## Using Pre-built Images

### 1. Login to GitHub Container Registry

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

Or interactively:
```bash
docker login ghcr.io -u YOUR_USERNAME
```

### 2. Set Environment Variables

Copy the example environment file and update it:
```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` and set:
- `GITHUB_USERNAME`: Your GitHub username
- `GITHUB_REPO`: Your repository name (e.g., `username/shoplist`)
- `IMAGE_TAG`: Tag to use (default: `latest`, or use `main-<sha>`, `v1.0.0`, etc.)
- Database credentials and other settings

### 3. Deploy with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Or export variables and run:
```bash
export GITHUB_USERNAME=your-username
export GITHUB_REPO=your-username/shoplist
export IMAGE_TAG=latest
docker-compose -f docker-compose.prod.yml up -d
```

### 4. View Logs

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### 5. Stop Services

```bash
docker-compose -f docker-compose.prod.yml down
```

## Image Architecture

The single image contains:
- **Frontend**: Built React app served by nginx on port 80
- **Backend**: Node.js API server running on port 5001 (internal)
- **Process Manager**: Supervisor manages both nginx and Node.js processes
- **API Proxy**: nginx proxies `/api/*` requests to the backend

## Image Tags

The workflow creates multiple tags:
- `latest`: Latest build from default branch
- `main`: Latest build from main branch
- `main-<sha>`: Specific commit from main branch
- `v1.0.0`: Semantic version tags
- `1.0`: Major.minor version tags

## Troubleshooting

### Authentication Issues

If you get authentication errors:
1. Make sure your GitHub PAT has `read:packages` permission
2. Verify you're logged in: `docker login ghcr.io`
3. Check image name matches your repository

### Image Not Found

- Verify the workflow has run successfully
- Check the image name in GitHub Packages
- Ensure `GITHUB_USERNAME` and `GITHUB_REPO` are correct
- Try pulling manually: `docker pull ghcr.io/username/repo:latest`

### Port Conflicts

If ports are already in use, update the port mappings in `docker-compose.prod.yml` or set environment variables:
```bash
export FRONTEND_PORT=3001
export POSTGRES_PORT=5433
```

Note: The backend runs internally on port 5001 and is accessed through nginx on port 80, so you only need to expose the frontend port.
