# Backend API Calls

This folder documents HTTP calls between the frontend and the local backend.

The root `API/` folder is for external/public data-source fetching. This `backend/api/` folder is for SiGnal's own backend endpoints.

## Current frontend status

The frontend does not yet call the backend with `fetch` or `axios`.

Several components currently contain endpoint comments showing intended backend calls. These are listed in `required-backend-calls.md`.

## API meaning

In this project, an API call means a frontend or service request to a backend endpoint.

Examples:

```http
GET /api/tickets?status=open
POST /api/citizen/reports
PATCH /api/broadcasts/{broadcastId}/resolve
```

