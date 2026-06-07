# API Endpoint Draft

This document lists the endpoints currently hinted by frontend comments and a proposed contract for the first backend pass.

Base path: `/api`

## Current frontend API hints

The frontend currently has API comments but no real network calls yet.

- `POST /api/citizen/reports`
- `GET /api/citizen/alerts`
- `GET /api/heatmap?layer=crises&public=true`
- `GET /api/crises?status=active`
- `GET /api/alerts?status=active&type=&region=`
- `GET /api/heatmap?crisisId=&layer=`
- `GET /api/tickets?agency=&status=`
- `POST /api/tickets/{ticketId}/ping-agencies`
- `POST /api/broadcasts`
- `PATCH /api/broadcasts/{broadcastId}/resolve`
- `GET /api/volunteers/opportunities`
- `PATCH /api/volunteers/opportunities/{id}/capacity`
- `GET /api/sentiment?topic=&crisisType=`
- `GET /api/recommendations?crisisType=`

## Priority endpoints

### Create citizen report

`POST /api/citizen/reports`

Purpose: public users submit incident information to government.

Request content type: `multipart/form-data`

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `crisisType` | string | yes | `health`, `weather`, `supply_chain`, `infrastructure`, `cybersecurity`, `general` |
| `reportType` | string | yes | UI-specific subtype, e.g. `flood`, `transport`, `supply` |
| `description` | string | yes | Citizen report text |
| `locationText` | string | no | Address, landmark, postal code |
| `latitude` | number | no | Required if auto-detect succeeds |
| `longitude` | number | no | Required if auto-detect succeeds |
| `anonymous` | boolean | no | Default `true` until Singpass is wired |
| `images` | file[] | no | Uploaded photos |

Response `201`:

```json
{
  "id": "3d15b58b-36e0-4fd8-81d8-8a8a719e95db",
  "publicReportId": "RPT-10482",
  "status": "submitted",
  "verificationStatus": "unverified",
  "createdAt": "2026-06-07T12:00:00.000Z"
}
```

### Track citizen report

`GET /api/citizen/reports/{publicReportId}`

Purpose: public users check report status.

Response `200`:

```json
{
  "publicReportId": "RPT-10482",
  "status": "triage",
  "verificationStatus": "needs_review",
  "assignedAgency": "PUB",
  "latestPublicMessage": "Your report is being reviewed by a government handler.",
  "updatedAt": "2026-06-07T12:15:00.000Z"
}
```

### List government tickets

`GET /api/tickets?agency=&status=&crisisType=&region=`

Purpose: government handlers view citizen reports as triage tickets.

Response `200`:

```json
{
  "items": [
    {
      "id": "3d15b58b-36e0-4fd8-81d8-8a8a719e95db",
      "publicReportId": "RPT-10482",
      "reporter": "Citizen (Anonymous)",
      "message": "Flooding at Orchard underpass...",
      "location": "Orchard Road, Central",
      "crisisType": "weather",
      "status": "submitted",
      "assignedAgency": "PUB",
      "urgency": "critical",
      "hasImage": true,
      "relatedReportIds": []
    }
  ],
  "total": 1
}
```

### Update ticket status

`PATCH /api/tickets/{ticketId}/status`

Request:

```json
{
  "status": "in_progress",
  "verificationStatus": "partially_verified",
  "assignedAgencyCode": "PUB"
}
```

Response `200`:

```json
{
  "id": "3d15b58b-36e0-4fd8-81d8-8a8a719e95db",
  "status": "in_progress",
  "verificationStatus": "partially_verified",
  "updatedAt": "2026-06-07T12:20:00.000Z"
}
```

### Add ticket comment

`POST /api/tickets/{ticketId}/comments`

Request:

```json
{
  "visibility": "internal",
  "body": "Grouped with two similar flood reports near Orchard."
}
```

Response `201`:

```json
{
  "id": "b06d1890-2203-45f7-aa69-bfe9bb9f28dd",
  "visibility": "internal",
  "body": "Grouped with two similar flood reports near Orchard.",
  "createdAt": "2026-06-07T12:21:00.000Z"
}
```

### Ping agencies

`POST /api/tickets/{ticketId}/ping-agencies`

Request:

```json
{
  "agencyCodes": ["PUB", "LTA"],
  "message": "Flooding report may affect traffic routing."
}
```

Response `200`:

```json
{
  "ticketId": "3d15b58b-36e0-4fd8-81d8-8a8a719e95db",
  "pingedAgencies": ["PUB", "LTA"],
  "createdAt": "2026-06-07T12:25:00.000Z"
}
```

### List public alerts

`GET /api/citizen/alerts?region=`

Purpose: public-facing verified alerts from the government broadcast centre.

Response `200`:

```json
{
  "items": [
    {
      "id": "a6255e3d-1a1c-4f30-bd21-b842aa8de85a",
      "title": "Flash Flood Warning - Orchard",
      "message": "Avoid Orchard Road underpass. Follow official routes.",
      "severity": "critical",
      "regions": ["Central"],
      "platforms": ["web", "sms"],
      "status": "ongoing",
      "createdAt": "2026-06-07T12:30:00.000Z"
    }
  ]
}
```

### Create broadcast

`POST /api/broadcasts`

Request:

```json
{
  "sourceReportId": "3d15b58b-36e0-4fd8-81d8-8a8a719e95db",
  "title": "Flash Flood Warning - Orchard",
  "message": "Avoid Orchard Road underpass. Follow official routes.",
  "severity": "critical",
  "targetType": "regions",
  "targetRegions": ["Central"],
  "platforms": ["web", "sms"]
}
```

Response `201`:

```json
{
  "id": "a6255e3d-1a1c-4f30-bd21-b842aa8de85a",
  "status": "ongoing",
  "createdAt": "2026-06-07T12:30:00.000Z"
}
```

### Resolve broadcast

`PATCH /api/broadcasts/{broadcastId}/resolve`

Response `200`:

```json
{
  "id": "a6255e3d-1a1c-4f30-bd21-b842aa8de85a",
  "status": "resolved",
  "resolvedAt": "2026-06-07T13:00:00.000Z"
}
```

### Dashboard crises

`GET /api/crises?status=active`

Response `200`:

```json
{
  "items": [
    {
      "id": "d95e7bc5-e7fb-47b1-a394-673db905e5ab",
      "name": "Flash Flood Risk",
      "crisisType": "weather",
      "status": "active",
      "severity": "high",
      "summary": "Heavy rain reports clustered around Central region."
    }
  ]
}
```

### Heatmap layer

`GET /api/heatmap?layer=crises&public=true`

Purpose: map data for `SingaporeRegionMap`.

Response `200`:

```json
{
  "layer": "crises",
  "markers": [
    {
      "id": "marker-1",
      "name": "Orchard Road",
      "latitude": 1.3048,
      "longitude": 103.8318,
      "value": "3 reports",
      "detail": "Flooding reports in the last 30 minutes",
      "severity": "critical"
    }
  ],
  "generatedAt": "2026-06-07T12:35:00.000Z"
}
```

## Auth endpoints for later

These are placeholders until Singpass/OIDC details are confirmed.

- `GET /api/auth/singpass/login`
- `GET /api/auth/singpass/callback`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Notes

- For now, anonymous citizen reports should be allowed.
- Singpass can be introduced later for volunteer signup, report tracking, and verified citizen identity.
- All government-changing actions should write to `audit.events`.
- Image upload should store metadata in PostgreSQL, not the image binary itself. Actual file storage can be local during development, then object storage later.

