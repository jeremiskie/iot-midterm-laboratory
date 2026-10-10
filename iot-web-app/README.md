# IoT Environmental Monitoring Dashboard

React, TypeScript, Vite, and shadcn/ui dashboard for the IoT Environmental
Monitoring API. The dashboard fetches the 100 most recent records from
`GET /api/telemetry`.

## Run the dashboard

Start the FastAPI backend on `127.0.0.1:8000`, then start the Vite development
server:

```bash
npm run dev
```

Vite proxies `/api` requests to the backend, so the browser uses the same origin
for the frontend and API and does not need cross-origin access enabled for local
development. If your backend uses another address or port, update the proxy
target in `vite.config.ts`.

For deployments that call the API directly, set `VITE_API_BASE_URL` to the
backend's base URL and configure FastAPI CORS to allow the deployed frontend
origin.

## UI components

```tsx
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
```
