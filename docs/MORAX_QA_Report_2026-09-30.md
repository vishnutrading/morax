# MORAX QA Report — 30 September 2026

## Result

**PASS with documented limitations.** 180 live API and build assertions passed after five defects were corrected and retested. The fictional QA dataset is retained in the database for manual exploration.

## Retained QA dataset

The `MORAX-DEMO` organization now contains fictional data only:

| Data | Count |
| --- | ---: |
| Organization Units | 9 |
| Contractors | 13 |
| Contractor Sites | 36 |
| Users | 8 |
| Compliance Masters | 17 |
| Compliance Instances | 67 |
| Documents / evidence | 8 |

The data covers IT Services, Manufacturing, Healthcare, Construction, and Automobile scenarios; active/inactive records; monthly, quarterly, half-yearly, annual, and one-time rules; completed, pending, due, overdue, submitted, under-review, correction-required, rejected, and not-applicable work.

The unrelated `Metro-train` workspace was preserved. Explicit previous test tenants (`TENANT-*`) were removed. `PRAGMA foreign_key_check` returned no integrity errors.

Useful fictional test accounts (all password `Demo@123`) are:

- `meera.admin@morax.example.com` — Organization Admin
- `ravi.maker@morax.example.com` — Unit Maker
- `kavya.checker@morax.example.com` — Unit Checker
- `sameer.contractor.maker@morax.example.com` — Contractor Maker
- `anika.contractor.checker@morax.example.com` — Contractor Checker
- `vikram.viewer@morax.example.com` — Viewer
- `asha.auditor@morax.example.com` — Auditor

The platform administrator remains `admin@morax.example.com` / `Admin@123`. As a platform user with multiple organizations, use **Organizations → Manage** to enter `MORAX-DEMO` before reviewing its data.

## Live coverage completed

- Authentication: invalid credentials, active/inactive users, session identity, password change and restoration, impersonation and return.
- Organization management: list/search, create/view/edit/deactivate, duplicate code handling, settings read/save, platform-vs-organization authorization.
- Units, Contractors, and Contractor Sites: create, view, edit, automatic search/filter/sort/page, duplicate validation, invalid dates, and safe delete.
- User & Access: create/view/edit/deactivate, search/filter/sort/page, role scopes, duplicate scopes, cross-organization scope rejection, Viewer access.
- Compliance Master: template download, create/view/version revision, activation/deactivation, search/filter/sort/page, duplicate versions, valid/invalid Excel import, preview, confirm, and re-confirm conflict.
- Compliance operations: generation request, maker activity, evidence upload, evidence verification, submit, begin review, approve, correction, resubmit, reject, mark not applicable, comments, history and audit.
- Document Library: upload, list/search/filter/sort/page, download, delete, and deleted-document access rejection.
- Dashboard: total/completed/pending/overdue/due-soon KPI arithmetic independently compared with the worklist API; status/frequency/entity-health totals; unit/entity/contractor/period cascading filters; upcoming-deadline range; rapid combined filter requests.
- Notifications, all CSV reports, audit logs, direct foreign-tenant URLs, and database foreign-key integrity.
- Frontend production build, lint completion, Vite route serving, and static scan confirming no orange dashboard colour tokens.

## Defects fixed and retested

1. Duplicate Unit/Contractor/Site submissions returned HTTP 500. They now return a clear HTTP 409 conflict before or during a unique-key race.
2. Contractor create crashed because the API accepted `city` but the database model had no column. A `contractors.city` column and Alembic migration `0007_contractor_city` now persist it.
3. Compliance Master accepted `effective_to` earlier than `effective_from`. Pydantic contract validation now returns HTTP 422.
4. Organization-scoped Viewer assignments did not grant tenant read access. Tenant-scoped access is now recognized server-side.
5. User role scopes could reference a foreign or non-existent entity. Scope ownership and duplicate role-scope validation are now enforced.

## Performance observations

All local API checks completed without failures. The slowest observed calls were CSV report generation at approximately 82–86 ms; authentication/password operations were approximately 40–68 ms; dashboard filtering and workflow actions were below those observations. The retained dataset exercises multiple pages in every operational list.

## Not tested / product limitations

- Interactive pixel-level desktop/tablet/mobile browser testing was not possible because no controllable browser engine was available in the execution environment. The frontend compiled successfully and its route returned HTTP 200, but manual visual validation remains recommended.
- The MVP has no independent Contract entity or contract start/end/expiry fields. Therefore “active/expiring/expired contract” lifecycle testing is not available; Contractor and Contractor Site active/inactive status is what the implemented model supports.
- The application has no permanent delete operation for Organizations, Users, or versioned Compliance Master rules by design. Deactivation and new rule versions are the auditable alternatives.
- No high-volume load test was run beyond the retained multi-page dataset. SQLite is appropriate for the MVP but is not a substitute for production-scale concurrency testing.

## Final verification

- Alembic database revision: `0007_contractor_city (head)`.
- Backend tests: `2 passed`.
- Frontend build: passed.
- Frontend lint: no errors; existing warning-only React/compiler and legacy-component advisories remain.
