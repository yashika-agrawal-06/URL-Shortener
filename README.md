# 🔗 URL Shortener

A full-stack, production-grade URL shortening service built with **Node.js**, **Express**, **Redis**, and **Docker** — complete with rate limiting, RESTful API, unit tests, and deployment on Render.

---

## 🌍 Live Demo

> 🟢 Deployed on  
> Frontend: Static `HTML + JS`  
> Backend: Node.js + Redis  
> Dockerized with `Dockerfile` and `nginx` (for local use)

---

## 🧰 Tech Stack

- **Frontend**: HTML, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: Redis (for storing shortened URLs)
- **Testing**: Jest
- **Rate Limiting**: Custom Express middleware
- **DevOps**:
  - Docker & docker-compose (for local setup)
  - Render (for cloud deployment)
  - NGINX (proxy for containerized routing)

---

## 📁 Project Structure

```

├── public/             # Static frontend
├── src/
│   ├── controllers/    # Shorten & redirect logic
│   ├── routes/         # API endpoints
│   ├── services/       # Redis + URL generation
│   └── middleware/     # Rate limiter
├── test/               # Unit tests (with mocks)
├── Dockerfile          # Container setup
├── docker-compose.yml  # Dev orchestration
├── server.js           # Entry point
├── README.md           # Project info

````

---

## ✅ Features

- 🔗 Shortens long URLs to 6-character codes
- 🚀 Redirects to original URL from code
- 🧠 Stores data in **Redis**
- 🛡️ Built-in **rate limiter** middleware (basic DDoS protection)
- 🧪 Unit tested with mocks for Redis
- 🐳 Local Docker support
- 🌐 Deployed on **Render**

---

## 🚀 Running Locally

### Option 1: Docker (Recommended for full stack)

```bash
docker-compose up
````

### Option 2: Manual

```bash
npm install
redis-server
npm start
```

Then visit: [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Base URL for generated short links (e.g., `https://myapp.com`) | Auto-detected from request host |
| `PORT` | Server port | `3000` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |

---

## 🧪 Run Tests

```bash
npm test
```

> **Note**: Tests require a running Redis instance (or mocked Redis). The test suite uses `NODE_OPTIONS=--experimental-vm-modules jest` for ES module support. On Windows, use `cross-env` or set the env var manually:
>
> ```bash
> $env:NODE_OPTIONS="--experimental-vm-modules"; npm test
> ```

---

## 🌐 Deployment (Render)

The backend and frontend are deployed using **Render.com**:

* **Backend**: Connected to Redis instance
* **Frontend**: Served via static files or nginx
* **Base URL** is set dynamically in production via `BASE_URL` environment variable

---

## 📌 Learnings

* 📦 **Modular Express structure** with `controllers`, `routes`, and `services`
* 🧪 Wrote **unit tests** with Redis mocks
* 🐳 Learned how to containerize full-stack apps with Docker
* 🚀 Deployed using **Render** and explored cloud hosting
* 🛡️ Implemented basic **rate limiting**
* 🌱 Explored logging, monitoring, and optional CI/CD pipelines

---


