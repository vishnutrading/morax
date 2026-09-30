# MORAX Labour Compliance — Complete Product User Guide

## Who this guide is for

This guide is written for operations, compliance, HR, contractor-management, and implementation teams. It explains what to do in MORAX without requiring technical or legal knowledge.

MORAX is a configurable compliance-workflow product. It does **not** decide which labour-law requirements apply. Your approved Compliance Master is the source of truth for rule content, applicability, frequency, due dates, risk, and required evidence.

## The product flow in one page

```text
MORAX Admin creates an Organization
        ↓
Organization Admin configures Units, Contractors, and Sites
        ↓
Organization Admin creates users and assigns roles + scopes
        ↓
Organization Admin configures/imports Compliance Master versions
        ↓
Generate obligations for applicable entities
        ↓
Assign Maker and Checker to each obligation
        ↓
Maker prepares activity and evidence, then submits
        ↓
Checker verifies evidence and approves / corrects / rejects
        ↓
Dashboard, documents, reports, notifications, and audit trail update
```

## Important words used in MORAX

| Term | Meaning |
| --- | --- |
| Organization | A customer/company workspace. Its data is isolated from every other Organization. |
| Unit | A branch, factory, office, establishment, or operational unit. |
| Contractor | An external labour/service provider associated with an Organization and optionally a Unit. |
| Contractor Site | A location operated by a Contractor. |
| Compliance Master | The approved, versioned list of compliance rules. |
| Obligation | One generated piece of work for one entity and period. |
| Maker | The person who prepares activity details and submits evidence. |
| Checker | The independent reviewer who verifies evidence and makes the workflow decision. |
| Scope | The Organization, Unit, Contractor, or Site that a user is allowed to access. |

## Roles and access

MORAX applies permissions on the backend, not only by hiding buttons. Changing a URL or request cannot expand a user's Organization or entity access.

| Role | Typical use |
| --- | --- |
| MORAX_ADMIN | Platform owner. Creates and enters Organizations. |
| ORGANIZATION_ADMIN | Administers one Organization: entities, users, rule setup, and governance. |
| UNIT_ADMIN | Administrative access within assigned Units. |
| UNIT_MAKER / CONTRACTOR_MAKER | Prepares assigned compliance work within scope. |
| UNIT_CHECKER / CONTRACTOR_CHECKER | Reviews assigned work within scope. |
| VIEWER | Read-only access within scope. |
| AUDITOR | Read/audit access within scope. |

Roles and scopes are both required. For normal workflow actions, a Maker or Checker must also be assigned to the individual obligation.

---

# Part 1 — Platform and Organization setup

## 1. Sign in

1. Open the MORAX web address supplied by your implementation team.
2. Enter your email address and password.
3. You are taken to the workspace allowed by your role.

If your first login requires a password change, follow the prompt before continuing.

## 2. Organizations (MORAX Admin only)

Use **Organizations** to create and manage separate customer/company workspaces.

### Create an Organization

1. Select **Organizations** in the left navigation.
2. Select **Create organization**.
3. Enter the Organization name and unique Organization code.
4. Add legal name, registration/CIN, PAN, GSTIN, address, contact, and compliance-start information where available.
5. Choose **Active** or **Inactive** and save.

Do not reuse an Organization code. An inactive Organization is retained for audit/history; it is not permanently deleted.

### Find an Organization

Use the Search and Status fields at the top of Organizations. Results refresh automatically:

- Typing searches name, legal name, or code.
- Changing Status immediately shows Active or Inactive Organizations.
- Clear filters restores the full list.

### Enter an Organization

1. Find the Organization.
2. Select **Manage**.
3. MORAX opens that Organization's workspace. The current Organization is displayed in the application shell.

Everything under that workspace—Units, Contractors, users, rules, obligations, evidence, and reports—is limited to that Organization.

## 3. Organization settings

Organization settings contain the Organization profile and user settings available to your role.

Keep these fields accurate:

- Legal/registered name and company identifiers
- Registered address and primary contact details
- Compliance start date
- Active status

Changes to Organization administration are audit logged.

---

# Part 2 — Entity setup

## 4. Units / Branches

Use **Units** for the employer/establishment level at which compliance may apply.

### Add a Unit

1. Open **Units**.
2. Select **Add unit**.
3. Enter Name and unique Code.
4. Select State and Industry type.
5. If **Other industry** is selected, enter the actual industry name in the field that appears.
6. Enter the compliance-start date, workforce numbers, contact/location information, and identifiers as applicable.
7. Select **Create unit**.

### Manage Units

- Search, Status, sorting, and pagination update automatically.
- Select the edit icon to open the Unit sheet.
- Deactivate rather than delete a Unit that has compliance history. MORAX protects historic records from deletion.

## 5. Contractors

Use **Contractors** for external labour or service providers.

1. Open **Contractors** and select **Add contractor**.
2. Enter Name and Code.
3. Link a Parent Unit if applicable.
4. Add contractor type, State, Industry, compliance-start date, worker count, contact, and registration information.
5. Save.

The Contractor list has the same automatic search, status filtering, sorting, pagination, edit sheet, and protected deletion behavior as Units.

## 6. Contractor Sites

Use **Sites** for locations operated by a Contractor.

1. Open **Sites** and select **Add contractor site**.
2. Select the Contractor. Select a linked Unit when applicable.
3. Enter Name, Code, State, Industry, compliance-start date, location, and worker information.
4. Save.

The usual relationship is:

```text
Organization → Unit → Contractor → Contractor Site
```

Some rules apply directly to a Unit or Contractor; not every rule uses every level.

---

# Part 3 — Users and permissions

## 7. Create a user

1. Open **Users & access**.
2. Select **Add user**.
3. Enter name, email, optional mobile number, and a temporary password.
4. Keep **Create as active** selected unless access should start later.
5. Select **Create user**.

Creating a user does not grant operational access yet. Assign a role and scope next.

## 8. Assign roles and scopes

1. In the user table, select **Roles & scopes** for the user.
2. Select **Add role scope**.
3. Choose the Role.
4. Choose Scope type: Organization, Unit, Contractor, or Contractor Site.
5. Choose the matching scope record.
6. Add every role/scope combination required by that user.
7. Select **Save all scopes**.

Important: **Save all scopes replaces the user's complete role-scope list.** Check every row before saving.

### Validate access safely

Organization administrators can select the key icon beside a user to use **Login as user**. This starts a temporary, audited session using that user's role and scope; it does not require knowing their password. Use **Return to administrator** in the banner to end it.

### Recommended Maker/Checker setup

Create separate people for each duty:

| User | Example role | Scope |
| --- | --- | --- |
| Compliance coordinator | ORGANIZATION_ADMIN or UNIT_ADMIN | Organization or Unit |
| Preparer | UNIT_MAKER / CONTRACTOR_MAKER | Relevant Unit, Contractor, or Site |
| Reviewer | UNIT_CHECKER / CONTRACTOR_CHECKER | Same relevant scope |

The same person must not submit and approve the same work.

---

# Part 4 — Compliance Master and generation

## 9. Compliance Master

Compliance Master stores the approved rules that may generate work. It is versioned for auditability.

### Add a new rule version

1. Open **Compliance Master**.
2. Select **Add rule version**.
3. Complete the rule identity, entity type, State/Industry applicability, frequency, schedule, effective dates, risk, and evidence requirements.
4. Add Act, rule, section, form, and descriptive fields when your approved master provides them.
5. Select **Save rule version**.

Use only approved rule content. MORAX does not supply legal requirements or infer them from an industry name.

### Change a rule safely

Do not overwrite a historical rule version.

1. Locate the existing version in the table.
2. Select **Create revision**.
3. MORAX prepares the next version number.
4. Update the approved fields and dates.
5. Save the new version.

Older obligations retain the rule snapshot used when they were generated. To stop future generation from a version, select **Deactivate**. Deactivation is audit logged; history is retained.

### Search and review

The rule table supports automatic search, Frequency and Status filters, sorting, paging, status badges, and a View action. Filters refresh without an Apply button.

### Import from Excel

1. Select **Template** to download the expected workbook layout if needed.
2. Choose an `.xlsx` file.
3. Select **Validate workbook**.
4. Review row counts and errors.
5. Correct errors in the workbook.
6. Select **Confirm** only when the workbook is valid.

### Generate obligations

After entities and applicable rules are ready:

1. In **Generate obligations**, optionally choose a subject type and a specific subject.
2. Set the as-of date.
3. Select **Generate**.

MORAX evaluates the active rule version, its effective dates, entity type, State/Industry criteria, entity compliance-start date, and schedule. Re-running generation does not duplicate the same version/entity/period/occurrence.

Rules with a `MANUAL` schedule are retained for governance but do not create an assumed statutory deadline.

---

# Part 5 — Daily compliance workflow

## 10. Dashboard

Dashboard is the daily operating view. It shows only data allowed by the current Organization and user scope.

Use the filters together:

1. **Organization unit**
2. **Entity**
3. **Contractor**
4. **Period**

Filters update automatically and cascade from Unit to Entity/Contractor. Every KPI, status chart, frequency chart, health ranking, contractor comparison, and upcoming deadline list refreshes from backend data.

### Status colours

MORAX uses consistent meanings:

| Status | Colour family |
| --- | --- |
| Completed / Approved | Green |
| Due | Blue |
| Pending for approval | Purple |
| Overdue / Rejected | Red |
| Under review / Submitted | Teal |

The dashboard has no orange status colour.

### Upcoming deadlines

The Upcoming Deadlines panel is not manually maintained. It is calculated from active compliance instances and their due dates. Select an item to open its workflow.

## 11. Recurring and One-time worklists

Use **Recurring** for scheduled obligations and **One-time** for one-time requirements.

1. Search or use automatic filters to find work.
2. Select the action/view control to open the compliance action dialog.
3. Review name, entity, period, due date, assignee, current status, evidence, and available next action.
4. Use **View full details** when the full workflow page is required.

## 12. Assign Maker and Checker

From the full compliance detail page, an authorized manager/admin assigns the specific users who will act on that obligation.

1. Choose an eligible Maker and save the Maker assignment.
2. Choose a different eligible Checker and save the Checker assignment.

The selected people need both the correct role/scope and the individual assignment.

## 13. Maker steps

1. Sign in as the assigned Maker.
2. Open the assigned obligation.
3. Enter the filing/reference, completion date, amount (when used), and remarks.
4. Save draft activity.
5. Upload the required supporting evidence.
6. Select **Submit for review**.

Submission may be blocked until required evidence and required activity data are present. This is a control, not an error.

## 14. Checker steps

1. Sign in as the assigned Checker.
2. Open the submitted obligation from the worklist or Notifications.
3. Download and inspect evidence.
4. Verify acceptable evidence, or reject it with a reason.
5. Begin review and enter the decision comment.
6. Approve, request correction, or reject.

Approval is blocked when required evidence has not been verified. MORAX also prevents the submitter from approving/rejecting their own submission.

## 15. Corrections and resubmission

If the Checker requests correction or rejects work:

1. The Maker opens the notification or obligation.
2. The Maker updates activity/evidence.
3. The Maker submits again.
4. The Checker performs a new review.

Evidence versions and workflow history remain visible; MORAX does not silently replace the prior record.

---

# Part 6 — Evidence, reporting, and audit

## 16. Document Library

Document Library is an evidence repository, not a separate file store. Each document remains linked to an existing compliance obligation.

### Upload a document

1. Open **Document library**.
2. Select **Upload document**.
3. Select the compliance obligation.
4. Enter the category and choose the file.
5. Select **Upload document**.

The same evidence workflow and permission checks apply as on the compliance detail page.

### Find and use documents

- Search by file name.
- Filter automatically by Entity and Verification state.
- Open the eye icon to review metadata.
- Download the file.
- Select **Open workflow** to return to the related compliance item.
- Authorized managers can delete a document. Deletion is audit logged.

## 17. Notifications

Notifications alert the signed-in user about workflow events such as a Checker decision or a pending review. Open the referenced item from the notification and complete the next available action.

## 18. Reports

Use **Reports** for organization/scope-limited summaries and CSV exports, including compliance status, overdue work, completed work, and entity summaries. Reports reflect the same permission boundary as the rest of MORAX.

## 19. Audit trail

Use **Audit trail** to investigate material actions. It records who performed an action, what was changed, the affected record, and time. Examples include:

- Organization/entity/user creation or update
- Role and scope changes
- Rule-version creation and activation/deactivation
- Obligation generation
- Assignment, evidence upload/verification/deletion
- Submission, approval, rejection, and correction

Audit history is for traceability. It does not replace your organization's formal records-retention or e-signature policy.

---

# Part 7 — Common questions and troubleshooting

## Why cannot I see an item?

Check, in order:

1. You are in the correct Organization.
2. Your role and entity scope cover the Unit, Contractor, or Site.
3. The list/dashboard filters are not limiting the result.
4. The compliance instance was generated for the selected period.

## Why cannot I submit or approve?

| Situation | What to check |
| --- | --- |
| Maker cannot submit | Maker role/scope, active Maker assignment, filing/reference, and required evidence. |
| Checker cannot approve | Active Checker assignment, separate Maker/Checker identity, verified required evidence, and valid workflow state. |
| Rule does not generate work | Active/effective version, entity type, State/Industry criteria, compliance start date, as-of date, and non-MANUAL schedule. |
| Cannot delete Unit/Contractor/Site | Historical compliance work exists. Set it to Inactive instead. |
| Cannot edit a rule version | This is deliberate. Create a new revision to retain historical auditability. |

## Daily operating checklist

1. Review Dashboard for overdue and due work.
2. Makers complete and submit assigned obligations.
3. Checkers review submissions and notifications.
4. Managers resolve overdue/correction items.
5. Review Document Library and Audit Trail when evidence or a decision needs investigation.

## Product boundary

MORAX supports configured compliance operations and auditability. It is not legal advice. Configure only rules, timing, applicability, and evidence requirements approved by the responsible compliance/legal team.
