# IoT Environmental Monitoring API

A small FastAPI service for receiving and reading environmental telemetry stored
in the Supabase `public.telemetry` table.

## Requirements

- Python 3.10 or newer
- A Supabase project with a `public.telemetry` table

The table should have at least `device_id` (text), `temperature` (numeric),
`humidity` (numeric), and `motion` (boolean) columns. A `created_at` column is
recommended for sorting recent records.

## Setup

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and provide:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
DEVICE_API_KEY=your-long-random-device-key
```

Use a Supabase key whose permissions are appropriate for your deployment. Keep
`.env` private and do not commit real credentials.

Start the API from the project directory:

```bash
uvicorn main:app --reload
```

The local API base URL is `http://127.0.0.1:8000`. Interactive API
documentation is available at `http://127.0.0.1:8000/docs`.

## Testing

Run the test suite with:

```bash
pytest
```

The tests mock Supabase operations and do not require a live Supabase project.

## Postman guide

Create requests using `http://127.0.0.1:8000` as the base URL.

### Health check

- Method: `GET`
- URL: `/health`
- Expected response: `200 OK`

```json
{"status": "ok"}
```

### Submit telemetry

- Method: `POST`
- URL: `/api/telemetry`
- Header: `X-API-Key: <the DEVICE_API_KEY from .env>`
- Header: `Content-Type: application/json`
- Body: select **raw** and **JSON**

```json
{
  "deviceId": "sensor-001",
  "temperature": 22.4,
  "humidity": 51.2,
  "motion": false
}
```

A successful request returns `201 Created` and the inserted database record. An
omitted or invalid API key returns `401 Unauthorized`.

### Read recent telemetry

- Method: `GET`
- URL: `/api/telemetry`

The endpoint returns up to the 100 most recent rows, ordered by `created_at`
descending. It does not require the device API key.
