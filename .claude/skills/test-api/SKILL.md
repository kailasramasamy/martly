---
name: test-api
description: Test a Martly API endpoint using curl with proper JWT authentication
argument-hint: <METHOD /endpoint or description>
---

Test a Martly API endpoint with curl.

**Endpoint/description:** $ARGUMENTS

## Steps

1. **Determine the endpoint** from the argument. If a description is given instead of a path, find the right route by reading `apps/api/src/app.ts` and the relevant route file in `apps/api/src/routes/`.

2. **Get an auth token** by logging in first:
   ```bash
   # Login as admin (SUPER_ADMIN)
   curl -s http://localhost:7001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@martly.dev", "password": "admin123"}' | jq .
   ```

   Available test users:
   - `admin@martly.dev` / `admin123` — SUPER_ADMIN
   - `owner@innovative.dev` / `owner123` — ORG_ADMIN (Innovative Foods)
   - `manager@bigmart.dev` / `manager123` — STORE_MANAGER (Bigmart)
   - `customer@martly.dev` / `customer123` — CUSTOMER

3. **Extract the token** from the login response and use it in the API call:
   ```bash
   # Store token
   TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@martly.dev", "password": "admin123"}' | jq -r '.accessToken')

   # Make the API call
   curl -s http://localhost:7001/api/v1/<endpoint> \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" | jq .
   ```

4. **For POST/PUT/PATCH requests**, include a `-d` body with the required fields based on the Zod schema validation.

5. **Show the response** to the user with `jq` for readability.

## Notes
- API runs on port **7001** by default
- All data routes are prefixed with `/api/v1/`
- Org-scoped routes automatically filter by the logged-in user's organization
- Use the appropriate user role for the endpoint being tested (e.g., STORE_MANAGER for store operations)
