
## Running the code

cd app

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Refreshing official data

Run `npm run refresh:data` to update `src/data/dashboard-data.json`.

The snapshot database uses:

- NEA/data.gov.sg real-time rainfall, temperature, wind and PSI APIs.
- NEA active dengue-cluster GeoJSON.
- MOH Weekly Infectious Disease Bulletin historical records.
- LTA/data.gov.sg real-time traffic-camera images and timestamps.
- SingStat import-price and retail-sales indices.

The app reads the committed snapshot instead of calling government APIs from the
browser. This avoids CORS and rate-limit failures and keeps the dashboard usable
when an upstream service is unavailable.

Supply indicators are national statistics. Logistics-node markers provide
geographic context only and must not be interpreted as node-level stock data.
