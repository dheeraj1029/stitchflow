# StitchFlow issue classification API

This local Express service calls the OpenAI API for production-issue
classification. The React app sends issue text to this server through Vite's
`/api` development proxy. The OpenAI key is only read by Node and is never
returned to the browser.

## Setup

From the repository root in PowerShell:

```powershell
npm install --prefix backend
Copy-Item backend\.env.example backend\.env
```

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `backend\.env`. Do not commit this
file. `.env.example` contains placeholders only. `PORT` defaults to `3001`.
Start the API and frontend in separate terminals:

```powershell
npm run api:dev
npm run dev
```

The local Vite proxy forwards `/api` requests to `127.0.0.1:3001`. A missing
key/model leaves the API running but classification returns a safe `503`;
supervisor notes remain saved in localStorage and can be retried after setup.

## Endpoint

`POST /api/issues/classify`

Request:

```json
{
  "originalNote": "இன்று தையல் மெஷின் பழுதாக உள்ளது.",
  "orderId": "B-PO-88213",
  "stage": "Stitching",
  "languageHint": "ta"
}
```

Success response:

```json
{
  "detectedLanguage": "Tamil",
  "translatedNote": "The sewing machine is not working today.",
  "category": "MACHINE_BREAKDOWN",
  "severity": "HIGH",
  "explanation": "The note describes a sewing machine breakdown.",
  "confidence": 0.92,
  "needsReview": true
}
```

Classification results are suggestions only. Every successful result enters
`PENDING_REVIEW`; only merchandiser confirmation makes it eligible for a future
buyer warning. Sending warnings is not implemented.

The API limits JSON request bodies to 16 KB, original notes to 4,000
characters, and classification requests to 10 per minute per IP. Provider
timeouts are limited to 15 seconds. Safe errors do not include provider
details or request text. Uploaded photos are never sent to this API.

## Local data limitations

Issue records, original notes, AI suggestions, corrections, and audit history
are stored in the browser's localStorage for this phase. This is demo
persistence only: it is not encrypted, shared between users, backed up, or
production-grade storage. Do not enter sensitive personal or confidential
information.

Run backend tests with `npm test --prefix backend`. The tests mock the OpenAI
client and make no paid API requests.
