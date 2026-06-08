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

## Citizen Tickets

### `POST /api/citizen/reports`

Creates a private ticket/chat thread for the government form handling team.

Auth is optional:

- with `Authorization: Bearer <accessToken>`, `reporter_user_id` is stored
- without auth, the ticket is anonymous

Accepted content types:

- `application/json`
- `multipart/form-data` with up to 5 `images`

JSON request:

```json
{
  "crisisType": "weather",
  "reportType": "flood",
  "description": "Flooding at Orchard underpass.",
  "locationText": "Orchard Road, Central",
  "latitude": 1.3048,
  "longitude": 103.8318,
  "images": [
    {
      "originalFilename": "flood.jpg",
      "mimeType": "image/jpeg",
      "byteSize": 12345,
      "storageKey": "uploads/flood.jpg"
    }
  ]
}
```

Response:

```json
{
  "publicReportId": "TKT-0042",
  "status": "open",
  "assignedAgency": "PUB",
  "item": {}
}
```

### `GET /api/citizen/reports/:publicReportId`

Returns public tracking state plus the ticket item.

### `GET /api/tickets`

Government form handling list. Requires Bearer token.

### `POST /api/tickets/:id/comments`

Adds a public reply or internal note. This is the current ticket chat mechanism. Requires Bearer token.

### `PATCH /api/tickets/:id/status`

Updates status. Requires Bearer token.

### `POST /api/tickets/:id/ping-agencies`

Adds agency pings and an internal note. Requires Bearer token.

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
