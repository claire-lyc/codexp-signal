# Frontend API Hints Found

These endpoint comments already exist in the frontend code.

```text
app/src/app/components/public/PublicSOS.tsx
POST /api/citizen/reports

app/src/app/components/public/PublicHome.tsx
GET /api/citizen/alerts
GET /api/heatmap?layer=crises&public=true

app/src/app/components/public/PublicAlerts.tsx
GET /api/citizen/alerts

app/src/app/components/government/GovOverview.tsx
GET /api/crises?status=active
GET /api/alerts?status=active&type=&region=
GET /api/heatmap?crisisId=&layer=

app/src/app/components/government/GovFormHandling.tsx
GET /api/tickets?agency=&status=
POST /api/tickets/{ticketId}/ping-agencies

app/src/app/components/government/GovBroadcast.tsx
POST /api/broadcasts
PATCH /api/broadcasts/{broadcastId}/resolve

app/src/app/components/government/GovVolunteers.tsx
GET /api/volunteers/opportunities
PATCH /api/volunteers/opportunities/{id}/capacity

app/src/app/components/government/GovPublicSentiment.tsx
GET /api/sentiment?topic=&crisisType=
GET /api/tickets?agency=&status=

app/src/app/components/government/GovAIRecommendations.tsx
GET /api/recommendations?crisisType=
```

