# Required Backend API Calls

These are the backend calls currently needed or hinted by the frontend.

## Highest priority

### `POST /api/citizen/reports`

Used by: public report page.

Purpose: citizen submits incident report with optional images and location.

Frontend sends:

- `crisisType`
- `reportType`
- `description`
- `locationText`
- `latitude`
- `longitude`
- `anonymous`
- `images`

Backend returns:

- `id`
- `publicReportId`
- `status`
- `verificationStatus`
- `createdAt`

### `GET /api/citizen/reports/{publicReportId}`

Used by: public report tracking.

Purpose: citizen checks status of a submitted report.

Backend returns:

- `publicReportId`
- `status`
- `verificationStatus`
- `assignedAgency`
- `latestPublicMessage`
- `updatedAt`

### `GET /api/tickets`

Used by: government form handling page.

Purpose: government handlers list citizen reports as tickets.

Query params:

- `agency`
- `status`
- `crisisType`
- `region`

Backend returns:

- ticket list
- total count

### `PATCH /api/tickets/{ticketId}/status`

Used by: government form handling page.

Purpose: update ticket status, verification status, or assigned agency.

Frontend sends:

- `status`
- `verificationStatus`
- `assignedAgencyCode`

Backend returns:

- updated ticket status
- `updatedAt`

### `POST /api/tickets/{ticketId}/comments`

Used by: government form handling page.

Purpose: add internal note or public reply.

Frontend sends:

- `visibility`
- `body`

Backend returns:

- comment id
- comment body
- created timestamp

### `POST /api/tickets/{ticketId}/ping-agencies`

Used by: government form handling page.

Purpose: notify related agencies that a ticket may affect them.

Frontend sends:

- `agencyCodes`
- `message`

Backend returns:

- `ticketId`
- `pingedAgencies`
- `createdAt`

## Broadcast and public alerts

### `POST /api/broadcasts`

Used by: government broadcast centre.

Purpose: create verified citizen/agency alert.

Frontend sends:

- `sourceReportId`
- `title`
- `message`
- `severity`
- `targetType`
- `targetRegions`
- `targetAgencyCodes`
- `platforms`

Backend returns:

- `id`
- `status`
- `createdAt`

### `PATCH /api/broadcasts/{broadcastId}/resolve`

Used by: government broadcast centre.

Purpose: mark an ongoing broadcast as resolved.

Backend returns:

- `id`
- `status`
- `resolvedAt`

### `GET /api/citizen/alerts`

Used by: public home and public alerts pages.

Purpose: show verified public alerts.

Query params:

- `region`
- `severity`
- `status`

Backend returns:

- alert list

## Dashboard data

### `GET /api/crises`

Used by: government overview page.

Purpose: list active or monitored crisis cards.

Query params:

- `status`
- `crisisType`

Backend returns:

- crisis list

### `GET /api/alerts`

Used by: government overview page.

Purpose: list active internal alerts.

Query params:

- `status`
- `type`
- `region`

Backend returns:

- alert list

### `GET /api/heatmap`

Used by: public and government map components.

Purpose: return map markers or region risk layer.

Query params:

- `layer`
- `crisisId`
- `public`

Backend returns:

- `layer`
- `markers`
- `generatedAt`

## Lower priority / later modules

### `GET /api/volunteers/opportunities`

Used by: government volunteers page.

Purpose: list volunteer opportunities.

### `PATCH /api/volunteers/opportunities/{id}/capacity`

Used by: government volunteers page.

Purpose: adjust volunteer opportunity capacity.

### `GET /api/sentiment`

Used by: government public sentiment page.

Purpose: get sentiment/misinformation dashboard data.

Query params:

- `topic`
- `crisisType`

### `GET /api/recommendations`

Used by: government data projections page.

Purpose: get advisory AI/data projection recommendations.

Query params:

- `crisisType`

## Auth placeholders

### `GET /api/auth/singpass/login`

Purpose: start Singpass/OIDC login.

### `GET /api/auth/singpass/callback`

Purpose: finish Singpass/OIDC login.

### `POST /api/auth/logout`

Purpose: revoke session.

### `GET /api/auth/me`

Purpose: return current user profile.

