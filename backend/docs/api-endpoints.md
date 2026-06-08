# Backend API Endpoints

Base URL:

```text
http://localhost:4000
```

## Auth

### `POST /api/auth/login`

Request:

```json
{
  "email": "admin@signal.local",
  "password": "YOUR_PASSWORD"
}
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "actorType": "government_user",
    "email": "admin@signal.local",
    "role": "admin"
  },
  "tokens": {
    "accessToken": "jwt",
    "refreshToken": "opaque-refresh-token",
    "tokenType": "Bearer",
    "expiresIn": "15m"
  }
}
```

### `POST /api/auth/refresh`

Send `refreshToken`. Backend rotates it and returns a new token pair.

### `POST /api/auth/logout`

Send `refreshToken`. Backend revokes that refresh session.

### `GET /api/auth/me`

Requires:

```http
Authorization: Bearer <accessToken>
```

Returns the current user profile.

## Protected Endpoints

Government and dashboard endpoints require:

```http
Authorization: Bearer <accessToken>
```

Protected groups:

- `/api/gov/*`
- `/api/dashboard/cached-external`
- `/api/tickets*`
- `/api/crises`
- `/api/alerts`
- `/api/recommendations`
- `/api/sentiment`
- `/api/historical`
- `/api/heatmap`

Public/citizen endpoints remain open for now:

- `/api/citizen/home`
- `/api/citizen/incidents`
- `/api/citizen/alerts`
- `/api/citizen/reports`
- `/api/forum/*`

## Test Commands

Login:

```bash
curl -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@signal.local\",\"password\":\"YOUR_PASSWORD\"}"
```

Call a protected endpoint:

```bash
curl http://localhost:4000/api/gov/overview ^
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"
```
