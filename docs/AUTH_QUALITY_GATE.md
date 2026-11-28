# Auth V5.1B — Quality Gate

Baseline: `Momevia_Current_Full.tar.gz` + V51A.patch. No new migration or dependency.

## Local

`npm run test:auth` runs required identity, consent, privacy, session, recovery, gateway, migration audit and related tests. `npm run test:auth -- --check` only checks required suite filenames; it does not run tests. Both commands fail if a required suite is missing. The existing `npm test` runs every unit suite including the new HTTP tests. No test uses production credentials or sends real provider requests.

## Coverage

- Real legacy Gateway and Identity HTTP server on OS-assigned loopback ports, with temporary JSON storage; cookie serialization under configured HTTPS public URL (not actual TLS transport).
- Seven state-changing endpoints checked against foreign Origin, `null`, and cross-site Fetch Metadata without Origin. Reject before handler, no session/cookie side effect, no cached private response. GET cannot execute these write endpoints. Block encoded internal routes. Reject non-JSON body.
- Register/login/revoke/logout via Gateway; signed OAuth cookies (HttpOnly, Secure, SameSite=Lax, Max-Age, host-only), PKCE challenge and incorrect state; never call real Google/Zalo. Check 502 response is no-store and does not issue cookie.
- The same boundary scenario runs from `tests/integration/architecture.mjs` for both monolith and legacy topology. Existing CI matrix and release smoke jobs check suite presence then run full unit tests; existing architecture and browser jobs exercise the extra public boundary scenario. No additional CI job or dependency.

## Release gate still required

Run `npm ci`, `npm run build`, `npm run check`, `npm test`, `npm run test:architecture`, `npm run test:architecture:legacy`, `npm run test:browser`, and the existing isolated MySQL QA job. Real MySQL concurrent password update/revocation, HTTPS cookie transport, OAuth callbacks with staging provider config, and real email relay still require verification. Rate limits remain process-local; this gate is not a certification of security or legal compliance. No production deploy is performed here.
