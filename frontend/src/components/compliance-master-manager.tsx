import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, FileSpreadsheet, Plus, Search, X } from "lucide-react";
import { morax } from "../api/morax";
import { EmptyState, InlineError, LoadingSkeleton } from "./workspace-ui";

type Row = Record<string, unknown>;
const text = (row: Row, key: string) =>
  row[key] == null ? "" : String(row[key]);
const today = () => new Date().toISOString().slice(0, 10);
const frequencies = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "ONE_TIME",
  "EVENT_BASED",
];
const dueRules = [
  "FIXED_DAY_OF_MONTH",
  "DAYS_AFTER_PERIOD_END",
  "FIXED_ANNUAL_DATE",
  "ONE_TIME_CONFIGURED_DATE",
  "MANUAL",
];

const ruleSchema = z.object({
  compliance_id: z.string().trim().min(1, "Compliance ID is required"),
  name: z.string().trim().min(1, "Rule name is required"),
  version: z.coerce.number().int().min(1),
  entity_type: z.enum(["UNIT", "CONTRACTOR", "CONTRACTOR_SITE"]),
  state_id: z.string(),
  industry_type_id: z.string(),
  frequency: z.string().min(1),
  due_date_rule: z.string().min(1),
  due_date_offset: z.coerce.number().int().nullable(),
  due_date_anchor: z.string(),
  grace_days: z.coerce.number().int().min(0),
  required_document: z.string(),
  risk_level: z.string(),
  effective_from: z.string().min(1, "Effective date is required"),
  effective_to: z.string(),
  active: z.boolean(),
  description: z.string(),
  act: z.string(),
  rule_reference: z.string(),
  section: z.string(),
  compliance_type: z.string(),
  document_type: z.string(),
  form_number: z.string(),
  legal_description: z.string(),
  consequence_or_penalty: z.string(),
});
type RuleForm = z.input<typeof ruleSchema>;
const blankRule = (): RuleForm => ({
  compliance_id: "",
  name: "",
  version: 1,
  entity_type: "UNIT",
  state_id: "",
  industry_type_id: "",
  frequency: "MONTHLY",
  due_date_rule: "FIXED_DAY_OF_MONTH",
  due_date_offset: 15,
  due_date_anchor: "",
  grace_days: 0,
  required_document: "",
  risk_level: "MEDIUM",
  effective_from: today(),
  effective_to: "",
  active: true,
  description: "",
  act: "",
  rule_reference: "",
  section: "",
  compliance_type: "",
  document_type: "",
  form_number: "",
  legal_description: "",
  consequence_or_penalty: "",
});

export function ComplianceMasterManager() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [frequency, setFrequency] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: "compliance_id", dir: "asc" });
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
  } | null>(null);
  const filters = useMemo(
    () => ({
      page: String(page),
      page_size: "10",
      q: deferredSearch.trim() || undefined,
      frequency: frequency || undefined,
      active: active || undefined,
      sort_by: sort.by,
      sort_dir: sort.dir,
    }),
    [active, deferredSearch, frequency, page, sort],
  );
  const rules = useQuery({
    queryKey: ["rules-page", filters],
    queryFn: () => morax.rulesPage(filters),
    staleTime: 30_000,
  });
  const options = useQuery({
    queryKey: ["rule-options"],
    queryFn: async () => {
      const [states, industries, units, contractors, sites] = await Promise.all(
        [
          morax.states(),
          morax.industries(),
          morax.unitsPage({ page: "1", page_size: "100" }),
          morax.contractors(),
          morax.sites(),
        ],
      );
      return { states, industries, units: units.items, contractors, sites };
    },
    staleTime: 5 * 60_000,
  });
  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: blankRule(),
  });
  const generation = useForm<{
    subject_type: string;
    subject_id: string;
    as_of_date: string;
  }>({
    defaultValues: { subject_type: "", subject_id: "", as_of_date: today() },
  });
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["rules-page"] }),
      client.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    ]);
  const save = useMutation({
    mutationFn: (values: RuleForm) =>
      morax.createRule({
        ...values,
        state_id: values.state_id || null,
        industry_type_id: values.industry_type_id || null,
        due_date_offset: values.due_date_offset || null,
        due_date_anchor: values.due_date_anchor || null,
        effective_to: values.effective_to || null,
        required_document: values.required_document || null,
        description: values.description || null,
        act: values.act || null,
        rule_reference: values.rule_reference || null,
        section: values.section || null,
        compliance_type: values.compliance_type || null,
        document_type: values.document_type || null,
        form_number: values.form_number || null,
        legal_description: values.legal_description || null,
        consequence_or_penalty: values.consequence_or_penalty || null,
      }),
    onSuccess: async () => {
      setNotice("Rule version saved successfully.");
      setFormOpen(false);
      form.reset(blankRule());
      await invalidate();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not save rule version.",
      ),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      morax.setRuleStatus(id, active),
    onSuccess: async () => {
      setNotice("Rule version status updated.");
      await invalidate();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not update rule status.",
      ),
  });
  const runGeneration = useMutation({
    mutationFn: (values: {
      subject_type: string;
      subject_id: string;
      as_of_date: string;
    }) =>
      morax.generate({
        subject_type: values.subject_type || undefined,
        subject_id: values.subject_id || undefined,
        as_of_date: values.as_of_date || undefined,
      }),
    onSuccess: (result) =>
      setNotice(
        `Generation completed: ${result.created} obligation(s) created.`,
      ),
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Generation failed."),
  });
  const choices =
    generation.watch("subject_type") === "UNIT"
      ? options.data?.units
      : generation.watch("subject_type") === "CONTRACTOR"
        ? options.data?.contractors
        : options.data?.sites;
  const openNew = () => {
    form.reset(blankRule());
    setNotice("");
    setFormOpen(true);
  };
  const revise = (row: Row) => {
    form.reset({
      ...blankRule(),
      ...Object.fromEntries(
        Object.entries(blankRule()).map(([key, value]) => [
          key,
          row[key] == null ? value : row[key],
        ]),
      ),
      version: Number(row.version || 0) + 1,
      active: true,
    } as RuleForm);
    setNotice("");
    setFormOpen(true);
  };
  const resetFilters = () => {
    setSearch("");
    setFrequency("");
    setActive("");
    setPage(1);
  };
  const setSorting = (by: string) =>
    setSort((current) =>
      current.by === by
        ? { by, dir: current.dir === "asc" ? "desc" : "asc" }
        : { by, dir: "asc" },
    );
  const total = rules.data?.total ?? 0;
  const size = rules.data?.page_size ?? 10;
  const last = Math.max(1, Math.ceil(total / size));
  return (
    <section className="crud-page compliance-master-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">RULE CONFIGURATION</p>
          <h1>Compliance Master</h1>
          <p className="muted">
            Rule versions are immutable once created. Use a revision for a
            change; deactivate a version instead of deleting its history.
          </p>
        </div>
        <div className="action-row">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              morax
                .downloadRuleTemplate()
                .catch((error) =>
                  setNotice(
                    error instanceof Error ? error.message : "Download failed.",
                  ),
                )
            }
          >
            <FileSpreadsheet size={16} /> Template
          </button>
          <button type="button" className="primary-action" onClick={openNew}>
            <Plus size={17} /> Add rule version
          </button>
        </div>
      </header>
      {notice && (
        <p
          className={`alert ${notice.includes("success") || notice.includes("completed") || notice.includes("updated") ? "success" : "error"}`}
        >
          {notice}
        </p>
      )}
      <section className="panel master-utility-grid">
        <form
          onSubmit={generation.handleSubmit((values) =>
            runGeneration.mutate(values),
          )}
        >
          <h2>Generate obligations</h2>
          <div className="form-grid compact">
            <label>
              Subject type
              <select
                {...generation.register("subject_type")}
                onChange={(event) => {
                  generation.setValue("subject_type", event.target.value);
                  generation.setValue("subject_id", "");
                }}
              >
                <option value="">All accessible subjects</option>
                <option value="UNIT">Unit</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="CONTRACTOR_SITE">Contractor site</option>
              </select>
            </label>
            <label>
              Subject
              <select
                {...generation.register("subject_id")}
                disabled={!generation.watch("subject_type")}
              >
                <option value="">All selected subjects</option>
                {choices?.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {String(item.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              As of date
              <input type="date" {...generation.register("as_of_date")} />
            </label>
            <button
              className="primary-action"
              disabled={runGeneration.isPending}
            >
              {runGeneration.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </form>
        <div className="master-import">
          <h2>Import workbook</h2>
          <p className="muted">
            Validate the Compliance Master workbook before explicitly confirming
            import.
          </p>
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              setImportFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          <div className="action-row">
            <button
              type="button"
              className="secondary"
              disabled={!importFile}
              onClick={async () => {
                try {
                  const result = await morax.validateImport(importFile!);
                  setPreview(result);
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : "Workbook validation failed.",
                  );
                }
              }}
            >
              Validate workbook
            </button>
            {preview && (
              <button
                type="button"
                className="primary-action"
                disabled={preview.error_rows > 0}
                onClick={async () => {
                  try {
                    await morax.confirmImport(preview.id);
                    setPreview(null);
                    setNotice("Workbook imported successfully.");
                    await invalidate();
                  } catch (error) {
                    setNotice(
                      error instanceof Error ? error.message : "Import failed.",
                    );
                  }
                }}
              >
                Confirm {preview.valid_rows}/{preview.total_rows}
              </button>
            )}
          </div>
          {preview?.error_rows ? (
            <small className="field-error">
              {preview.error_rows} row(s) must be corrected before import.
            </small>
          ) : null}
        </div>
      </section>
      <section className="panel entity-list-panel">
        <div className="crud-toolbar">
          <label className="table-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search rule, compliance ID, or Act…"
            />
          </label>
          <label className="compact-filter">
            <span>Frequency</span>
            <select
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All frequencies</option>
              {frequencies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="compact-filter">
            <span>Status</span>
            <select
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          {(search || frequency || active) && (
            <button
              type="button"
              className="text-action"
              onClick={resetFilters}
            >
              <X size={15} /> Clear filters
            </button>
          )}
        </div>
        {rules.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : rules.isError ? (
          <InlineError message="Unable to load Compliance Master." />
        ) : rules.data?.items.length ? (
          <div className="table-wrap modern-data-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      className="table-sort"
                      onClick={() => setSorting("compliance_id")}
                    >
                      Compliance ID
                    </button>
                  </th>
                  <th>
                    <button
                      className="table-sort"
                      onClick={() => setSorting("name")}
                    >
                      Rule
                    </button>
                  </th>
                  <th>Entity</th>
                  <th>
                    <button
                      className="table-sort"
                      onClick={() => setSorting("frequency")}
                    >
                      Frequency
                    </button>
                  </th>
                  <th>Risk</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.data.items.map((row) => (
                  <tr key={text(row, "id")}>
                    <td>{text(row, "compliance_id")}</td>
                    <td>
                      <b>{text(row, "name")}</b>
                      <br />
                      <small>{text(row, "act") || "No Act reference"}</small>
                    </td>
                    <td>{text(row, "entity_type")}</td>
                    <td>{text(row, "frequency")}</td>
                    <td>
                      <span
                        className={`risk-label ${text(row, "risk_level").toLowerCase()}`}
                      >
                        {text(row, "risk_level")}
                      </span>
                    </td>
                    <td>v{text(row, "version")}</td>
                    <td>
                      <span
                        className={`badge ${row.active ? "active" : "inactive"}`}
                      >
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="entity-table-actions">
                        <button
                          type="button"
                          className="icon-action"
                          title="View rule version"
                          onClick={() => setDetail(row)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="secondary compact-action"
                          onClick={() => revise(row)}
                        >
                          Create revision
                        </button>
                        <button
                          type="button"
                          className="secondary compact-action"
                          disabled={changeStatus.isPending}
                          onClick={() =>
                            changeStatus.mutate({
                              id: text(row, "id"),
                              active: !row.active,
                            })
                          }
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No rule versions found"
            description="Change the filters or add the first configured rule version."
          />
        )}
        <footer className="table-pagination">
          <span>
            {total
              ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`
              : "No records"}
          </span>
          <div>
            <button
              className="icon-action"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              ‹
            </button>
            <span>
              Page {page} of {last}
            </span>
            <button
              className="icon-action"
              disabled={page >= last}
              onClick={() => setPage((value) => value + 1)}
            >
              ›
            </button>
          </div>
        </footer>
      </section>
      {formOpen && (
        <MasterSheet
          title={
            form.getValues("version") === 1
              ? "Add rule version"
              : "Create revised rule version"
          }
          onClose={() => setFormOpen(false)}
        >
          <form
            className="entity-form"
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
          >
            <div className="form-section">
              <h3>Rule identity and applicability</h3>
              <div className="form-grid">
                <RuleField
                  label="Compliance ID"
                  error={form.formState.errors.compliance_id?.message}
                >
                  <input {...form.register("compliance_id")} />
                </RuleField>
                <RuleField
                  label="Rule name"
                  error={form.formState.errors.name?.message}
                >
                  <input {...form.register("name")} />
                </RuleField>
                <RuleField label="Version">
                  <input type="number" min="1" {...form.register("version")} />
                </RuleField>
                <RuleField label="Entity type">
                  <select {...form.register("entity_type")}>
                    <option value="UNIT">Unit</option>
                    <option value="CONTRACTOR">Contractor</option>
                    <option value="CONTRACTOR_SITE">Contractor site</option>
                  </select>
                </RuleField>
                <RuleField label="State">
                  <select {...form.register("state_id")}>
                    <option value="">All states</option>
                    {options.data?.states.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </RuleField>
                <RuleField label="Industry">
                  <select {...form.register("industry_type_id")}>
                    <option value="">All industries</option>
                    {options.data?.industries.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </RuleField>
              </div>
            </div>
            <div className="form-section">
              <h3>Schedule and evidence</h3>
              <div className="form-grid">
                <RuleField label="Frequency">
                  <select {...form.register("frequency")}>
                    {frequencies.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </RuleField>
                <RuleField label="Due date method">
                  <select {...form.register("due_date_rule")}>
                    {dueRules.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </RuleField>
                <RuleField label="Due day / offset">
                  <input type="number" {...form.register("due_date_offset")} />
                </RuleField>
                <RuleField label="Due date anchor">
                  <input {...form.register("due_date_anchor")} />
                </RuleField>
                <RuleField label="Grace days">
                  <input
                    type="number"
                    min="0"
                    {...form.register("grace_days")}
                  />
                </RuleField>
                <RuleField label="Risk">
                  <select {...form.register("risk_level")}>
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                    <option>CRITICAL</option>
                  </select>
                </RuleField>
                <RuleField label="Effective from">
                  <input type="date" {...form.register("effective_from")} />
                </RuleField>
                <RuleField label="Effective to">
                  <input type="date" {...form.register("effective_to")} />
                </RuleField>
                <RuleField label="Required evidence">
                  <input {...form.register("required_document")} />
                </RuleField>
                <label className="inline">
                  <input type="checkbox" {...form.register("active")} /> Active
                  version
                </label>
              </div>
            </div>
            <div className="form-section">
              <h3>Legal references</h3>
              <div className="form-grid">
                <RuleField label="Act">
                  <input {...form.register("act")} />
                </RuleField>
                <RuleField label="Rule reference">
                  <input {...form.register("rule_reference")} />
                </RuleField>
                <RuleField label="Section">
                  <input {...form.register("section")} />
                </RuleField>
                <RuleField label="Compliance type">
                  <input {...form.register("compliance_type")} />
                </RuleField>
                <RuleField label="Document type">
                  <input {...form.register("document_type")} />
                </RuleField>
                <RuleField label="Form number">
                  <input {...form.register("form_number")} />
                </RuleField>
                <RuleField label="Description" wide>
                  <textarea {...form.register("description")} />
                </RuleField>
                <RuleField label="Legal description" wide>
                  <textarea {...form.register("legal_description")} />
                </RuleField>
                <RuleField label="Consequence / penalty" wide>
                  <textarea {...form.register("consequence_or_penalty")} />
                </RuleField>
              </div>
            </div>
            <footer className="drawer-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-action" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save rule version"}
              </button>
            </footer>
          </form>
        </MasterSheet>
      )}
      {detail && (
        <MasterSheet
          title={`${text(detail, "compliance_id")} — v${text(detail, "version")}`}
          onClose={() => setDetail(null)}
        >
          <div className="entity-form">
            <dl className="dialog-detail-grid">
              <div>
                <dt>Name</dt>
                <dd>{text(detail, "name")}</dd>
              </div>
              <div>
                <dt>Frequency</dt>
                <dd>{text(detail, "frequency")}</dd>
              </div>
              <div>
                <dt>Effective from</dt>
                <dd>{text(detail, "effective_from")}</dd>
              </div>
              <div>
                <dt>Due date rule</dt>
                <dd>{text(detail, "due_date_rule")}</dd>
                <div className="wide">
                  <dt>Description</dt>
                  <dd>{text(detail, "description") || "Not provided"}</dd>
                </div>
              </div>
            </dl>
          </div>
        </MasterSheet>
      )}
    </section>
  );
}

function MasterSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="crud-drawer-backdrop" onMouseDown={onClose}>
      <section
        className="crud-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-heading">
          <div>
            <div>
              <h2>{title}</h2>
              <p>
                Historical versions remain auditable and cannot be overwritten.
              </p>
            </div>
          </div>
          <button type="button" className="icon-action" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function RuleField({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "wide" : undefined}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
