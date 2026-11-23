# URL Shortener - Repository Summary for Dockerfile Creation

This document provides a complete, precise summary of the codebase for writing correct Dockerfiles without needing to see the code.

---

## 1. Project Structure

```
URL-shortern/
├── .github/                    # GitHub workflows (empty/placeholder)
├── nginx/
│   └── default.conf           # NGINX config for reverse proxy
├── public/
│   ├── index.html             # Frontend HTML (served by NGINX)
│   └── script.js              # Frontend JS (calls /api/shorten)
├── src/
│   ├── app.js                 # Express app setup, middleware, routes
│   ├── controllers/
│   │   └── urlController.js   # shortenUrl, redirectUrl handlers
│   ├── middleware/
│   │   └── rateLimiter.js     # express-rate-limit middleware (100 req/min)
│   ├── routes/
│   │   └── urlRoutes.js       # POST /api/shorten, GET /:code
│   └── services/
│       ├── redisService.js    # Redis client + saveUrl/getUrlByCode
│       └── urlServices.js     # generateShortCode, saveUrl, getUrlByCode
├── test/
│   ├── __mock__/              # Empty directory (mocks inline in test file)
│   └── url.test.js            # Jest test for generateShortCode
├── .dockerignore              # Not present
├── .env-example               # Example env vars (see section 5)
├── .gitignore                 # node_modules, .env
├── Dockerfile                 # Current Dockerfile (see section 7)
├── docker-compose.yml         # Compose for app + redis + nginx (see section 7)
├── package.json               # Dependencies and scripts (see section 2)
├── package-lock.json          # npm lockfile
├── README.md                  # Project documentation
└── server.js                  # Entry point (see section 3)
```

**Key file purposes:**
- `server.js` — Entry point, starts Express server on PORT
- `src/app.js` — Express app config, JSON body parser, mounts `/api` routes
- `src/routes/urlRoutes.js` — Defines POST `/api/shorten` and GET `/:code`
- `src/controllers/urlController.js` — Request validation, response formatting
- `src/services/urlServices.js` — Business logic, uses nanoid(6) for codes
- `src/services/redisService.js` — Redis client creation + SET/GET with 1hr TTL
- `src/middleware/rateLimiter.js` — 100 requests/minute per IP
- `nginx/default.conf` — Proxies `/api/*` to `app:3000`, serves static from `/usr/share/nginx/html`
- `public/index.html` + `script.js` — Frontend, calls `/api/shorten` (relative path)

---

## 2. Runtime & Dependencies

### package.json
```json
{
  "name": "url-shortner",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest"
  },
  "jest": {
    "transform": {},
    "testEnvironment": "node"
  },
  "dependencies": {
    "dotenv": "^16.5.0",
    "express": "^5.1.0",
    "express-rate-limit": "^7.5.0",
    "nanoid": "^5.1.5",
    "redis": "^5.0.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.10",
    "supertest": "^7.1.0"
  }
}
```

### Node Version
- **No `.nvmrc` file present**
- **No `engines` field in package.json**
- **Dockerfile uses `node:16-alpine`** (old — Node 16 is EOL)

### Lockfile
- **`package-lock.json` present** (178.8 KB) — npm lockfile

---

## 3. Application Entry Point

| Aspect | Details |
|--------|---------|
| **Entry file** | `server.js` |
| **Start command** | `npm start` → runs `node server.js` |
| **Port** | `process.env.PORT || 3000` (line 4 in server.js) |
| **Bind address** | **Not explicitly set** — Express defaults to `0.0.0.0` (all interfaces) |
| **Server startup code** | `app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });` |

**server.js (full content):**
```javascript
import 'dotenv/config';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 4. Redis Usage

### Client Library
- **`redis` v5.0.1** (official Node Redis client, not ioredis)

### Redis Connection Code (src/services/redisService.js:3-15)
```javascript
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;

export const client = createClient({ url: redisUrl });

client.on('connect', () => {
  console.log('✅ Connected to Redis');
});

client.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

await client.connect();
```

### Environment Variables for Redis (in order of precedence)
1. `REDIS_URL` — Full Redis URL (e.g., `redis://host:6379`)
2. `REDIS_HOST` — Hostname (default: `localhost`)
3. `REDIS_PORT` — Port (default: `6379`)

**No password/auth support in current code** — would need `redis://:password@host:port` format in REDIS_URL.

### Redis Usage Patterns
| Operation | Code | TTL | Key Pattern |
|-----------|------|-----|-------------|
| Save URL | `client.set(code, JSON.stringify({originalUrl: url}), {EX: 3600})` | 3600s (1 hour) | `{code}` (6-char nanoid) |
| Get URL | `client.get(code)` → `JSON.parse(data).originalUrl` | N/A | `{code}` |
| Data structure | String (JSON serialized) | | |
| Commands used | `SET` with EX, `GET` | | |

### Redis Config Files
- **No `redis.conf` in repo**

---

## 5. Environment Variables

### All `process.env.*` References in Code

| Variable | File | Line | Default | Purpose |
|----------|------|------|---------|---------|
| `PORT` | server.js | 4 | `3000` | HTTP server port |
| `REDIS_URL` | src/services/redisService.js | 3 | (constructed) | Full Redis connection URL |
| `REDIS_HOST` | src/services/redisService.js | 3 | `localhost` | Redis hostname |
| `REDIS_PORT` | src/services/redisService.js | 3 | `6379` | Redis port |
| `NODE_ENV` | docker-compose.yml | 9 | `production` | App environment |
| `BASE_URL` | .env-example | 4 | `http://localhost:3000` | Base URL for short links (used in frontend only) |

### .env-example Contents
```env
PORT=3000
REDIS_URL =redis://localhost:6379
REDIS_PORT=6379
BASE_URL=http://localhost:3000
```

**Note:** `BASE_URL` is defined in .env-example but **not read anywhere in the backend code**. The frontend `script.js` uses relative path `/api/shorten`, and the controller hardcodes `http://localhost:3000` in the response (see section 6).

---

## 6. API & Frontend

### API Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| POST | `/api/shorten` | `shortenUrl` | Create short URL from `originalUrl` in body |
| GET | `/:code` | `redirectUrl` | Redirect to original URL (302) |

**Note:** Routes are mounted at `/api` in `app.js`, so full paths are `/api/shorten` and `/:code` (the redirect is NOT under `/api`).

### Request/Response Examples

**POST /api/shorten**
```json
// Request
{ "originalUrl": "https://example.com/very/long/url" }

// Success Response (200)
{ "shortUrl": "http://localhost:3000/abc123" }

// Error Responses
400: { "error": "Invalid input: originalUrl must be a string" }
400: { "error": "Invalid URL" }
500: { "error": "Internal Server Error" }
```

**GET /:code**
- 302 Redirect to original URL
- 404: `{ "error": "Short URL not found" }`
- 500: `{ "error": "Internal Server Error" }`

### Frontend Serving
- **Development:** Not served by Express (commented out in `app.js:11`)
- **Production (Docker):** Served by **NGINX** from `/usr/share/nginx/html`
- **NGINX config** proxies `/api/*` to `app:3000` and serves static files for everything else

### Hardcoded URLs That Break in Docker

| Location | Hardcoded Value | Issue |
|----------|-----------------|-------|
| `src/controllers/urlController.js:33` | `http://localhost:3000/${code}` | Returns localhost in shortUrl response — breaks when accessed via NGINX on port 80 |
| `public/script.js:5` | `/api/shorten` | Relative path — works via NGINX proxy but would break if frontend served separately |
| `.env-example` | `BASE_URL=http://localhost:3000` | Not used in code but indicates expected base URL |

**Critical issue:** The backend returns `http://localhost:3000/abc123` as the short URL. In Docker with NGINX on port 80, this URL is wrong — it should be `http://<host>/abc123` or use the `BASE_URL` env var.

---

## 7. Existing Docker/Deployment Files

### Dockerfile (Full Content)
```dockerfile
# Use official Node.js image as a base image
FROM node:16-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install all dependencies, including devDependencies (needed for nodemon)
RUN npm install --production

# Copy the rest of the application code
COPY . .


# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

### docker-compose.yml (Full Content)
```yaml
services:
  # Node app container
  app:
    build: .
    ports:
      - "3000:3000"  # Map host port 3000 to container port 3000
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis  # Wait for Redis to be ready before starting the app
    volumes:
      - .:/app

  # Redis container
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"  # Expose Redis port to the host machine
    environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
  
  # Nginx Container
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf
      - ./public:/usr/share/nginx/html
    depends_on:
      - app
```

### nginx/default.conf (Full Content)
```nginx
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://app:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Service Connection Logic
- **app → redis**: Uses `REDIS_HOST=redis` (Docker service name), port 6379
- **nginx → app**: Proxies `/api/` to `http://app:3000/api/` (Docker service name)
- **nginx → frontend**: Serves `./public` from `/usr/share/nginx/html`
- **Host access**: 
  - `localhost:3000` → app directly (bypasses nginx)
  - `localhost:80` → nginx (serves frontend + proxies API)
  - `localhost:6379` → redis directly

---

## 8. Issues for Containerization

### Critical Issues (Will Break in Docker)

1. **Hardcoded localhost in short URL response** — `src/controllers/urlController.js:33` returns `http://localhost:3000/${code}`. In Docker with NGINX on port 80, this URL is invalid for external access. Must use `BASE_URL` env var or construct from request headers.

2. **Node 16 is EOL** — Dockerfile uses `node:16-alpine`. Should use `node:20-alpine` or `node:22-alpine` (LTS).

3. **Missing `.dockerignore`** — Copies `node_modules`, `.git`, tests, `.env` into image. Should exclude:
   ```
   node_modules
   .git
   .env
   test
   *.md
   Dockerfile
   docker-compose.yml
   nginx
   ```

4. **No health checks** — Neither Dockerfile nor compose has health checks for app or redis.

5. **`depends_on` without health check** — Compose waits for container start, not service readiness. Redis may not accept connections when app starts.

6. **Volume mount in production compose** — `volumes: - .:/app` overrides built code with host source. Remove for production.

7. **Redis connection has no retry/backoff** — `await client.connect()` throws on failure, crashes app. Needs retry logic.

8. **No production build step** — `npm install --production` is fine but no build/compile step needed (pure JS).

9. **Frontend not served by Express** — Commented out in `app.js:11`. In non-NGINX deployments (e.g., Render), frontend won't be served.

### Recommended Changes Before Containerizing

- [ ] Fix `shortUrl` response to use `process.env.BASE_URL` or `req.get('host')`
- [ ] Update Dockerfile to `node:20-alpine` (or current LTS)
- [ ] Add `.dockerignore`
- [ ] Add health check endpoint (e.g., `GET /health`) and configure in Dockerfile/compose
- [ ] Add Redis connection retry with exponential backoff
- [ ] Remove `volumes: - .:/app` from production compose or create separate `docker-compose.prod.yml`
- [ ] Uncomment `express.static` in `app.js` for standalone deployments
- [ ] Consider multi-stage Dockerfile for smaller image
- [ ] Add non-root user in Dockerfile
- [ ] Use `REDIS_URL` with password support for production Redis (e.g., Render Redis)

---

## 9. Git Info

```
Current branch: main
Remote: origin → https://github.com/05sanjaykumar/URL-shortern.git (fetch/push)
Remote branches: render-deploy (remote-only)
```

---

## Summary for Dockerfile Author

**Minimum viable Dockerfile changes:**
1. Change `FROM node:16-alpine` → `FROM node:20-alpine`
2. Add `.dockerignore`
3. Fix the hardcoded `http://localhost:3000` in `urlController.js` to use `process.env.BASE_URL || \`http://${req.get('host')}\``
4. Add `HEALTHCHECK` instruction
5. Run as non-root user

**For production with NGINX:** Use the existing `docker-compose.yml` but remove the volume mount and add health checks.

**For standalone (no NGINX):** Uncomment `app.use(express.static(path.resolve('public')))` in `app.js` and ensure `BASE_URL` is set correctly.