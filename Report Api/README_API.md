# Report API

This small Flask API serves the already-generated Excel reports from this folder.
It does not connect to SQL Server and does not regenerate data.

## Start

```powershell
pip install -r requirements.txt
python report_api.py
```

The API runs on:

```text
http://localhost:5000
```

## Endpoints

List available reports:

```text
GET http://localhost:5000/api/reports
```

Download report by client:

```text
GET http://localhost:5000/api/reports/client/download
```

Download report by camion:

```text
GET http://localhost:5000/api/reports/camion/download
```

Health check:

```text
GET http://localhost:5000/api/health
```

## Spring backend option

Your Spring backend can call this Flask API and stream the Excel file to Angular,
or Angular can call Flask directly if CORS/proxy configuration allows it.

Recommended flow:

```text
Angular -> Spring backend -> Flask report API -> existing Excel file
```

This keeps Angular talking to one backend and avoids exposing the report folder directly.
