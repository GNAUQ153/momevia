# Auth V5.2B — Business acceptance & handoff

This phase freezes the reviewed migration 020 checksum, adds a read-only Auth schema gate, and extends the existing isolated MySQL 8.4 adapter QA. It does not certify a live deployment. Do not enable production strict mode or migrate a live database solely on the basis of a local pass.

## Evidence required before production acceptance

| ID | Scenario | Required evidence |
| --- | --- | --- |
| AUTH-01 | Build and source / technical audit | `npm run build && npm run check && npm test` with exit 0 |
| AUTH-02 | Auth regression / Gateway | `npm run test:auth` and both architecture topologies with exit 0 |
| AUTH-03 | Login/register and consent UX VI/EN, 320px and desktop | `npm run test:browser` with exit 0; manual keyboard and mobile check |
| AUTH-04 | MySQL 020 structure, historical sessions, isolation and concurrent credential writes | Existing isolated `test:canvas:mysql` CI job with migration 020 and both Auth V5.2B cases passing |
| AUTH-05 | Target configuration and schema | `npm run check:production -- --auth-ready`; `npm run db:audit -- --live --require-latest --indexes --auth-schema` on confirmed target; no credentials in logs |
| AUTH-06 | Google/Zalo login and new account registration with consent | Staging provider callbacks through actual Hostinger HTTPS relay; test only approved QA accounts; no raw token/OTP logs |
| AUTH-07 | Email verification/reset | Staging mail delivery, code expiry and single use; old sessions invalidated |
| AUTH-08 | Account management | Separate browser profiles; individual revocation, revoke others, password change, unrelated account unaffected; verify draft/gift data remains intact |
| AUTH-09 | Consent privacy | Current/archived policy text, own evidence only, support withdrawal ticket; approved policy and documented human review process |
| AUTH-10 | Operational safety | Backup/restore rehearsal, rollback plan, HTTPS cookie and relay checks, monitor 429/5xx; confirm Railway usage and data volume |

## New schema gate

`npm run db:audit` stays offline. `npm run db:audit -- --live --auth-schema` is explicit read-only opt-in and requires latest migration history. It checks the recorded 020 marker, two nullable columns with exact MySQL types/defaults and the named visible non-unique BTREE index in exact order. Missing or incompatible metadata exits nonzero; no ALTER, DML, migration, auto-repair or secret output. Existing `--indexes` remains advisory for other query prefixes. Confirm the target connection and use a read-only user where possible. An audit snapshot is not proof of data integrity, backup, concurrency or provider readiness.

The existing MySQL adapter fixture refuses a nonempty schema and uses explicit loopback QA credentials. The adapter fixture now also applies the previously omitted migrations 013–016 before 017, allowing the 020 case to verify the complete migration prefix. The two additional cases run inside its existing job; never point the fixture at a production schema. Actual MySQL CI, full build/browser and staging evidence must be recorded separately, along with commit SHA and environment. Do not include passwords, OTPs, session references, personal data or credentials in evidence.

## Handoff decision

Close the Auth feature expansion scope after this patch, subject to resolving any failing acceptance tests. Production remains unapproved until all required evidence and business review are available. Policy is currently draft; a withdrawal ticket is not execution of withdrawal. No legal approval, deployment, migration execution or live test is implied. Next product work should focus on template discovery, canvas editing, publication and recipient experience; reopen Auth only for defects, security or release blockers.
