import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  MapPin,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { morax } from "../api/morax";
import type { Master, User } from "../api/morax";
import { EmptyState, InlineError, LoadingSkeleton } from "./workspace-ui";

type Row = Record<string, unknown>;
type EntityKind = "units" | "contractors" | "sites";

type EntityForm = {
  name: string;
  code: string;
  unit_type: string;
  contractor_type: string;
  unit_id: string;
  contractor_id: string;
  state_id: string;
  industry_type_id: string;
  other_industry_name: string;
  city: string;
  pincode: string;
  address: string;
  registration_identifiers: string;
  gstin: string;
  pan: string;
  lin: string;
  employer_name: string;
  applicable_regulations: string;
  male_employees: string;
  female_employees: string;
  male_workers: string;
  female_workers: string;
  contact_email: string;
  contact_phone: string;
  effective_date: string;
  compliance_start_date: string;
  status: "ACTIVE" | "INACTIVE";
};

const entityTableFeatures = tableFeatures({ rowSortingFeature });
const EMPTY_ROWS: Row[] = [];

const blankEntity = (): EntityForm => ({
  name: "",
  code: "",
  unit_type: "",
  contractor_type: "",
  unit_id: "",
  contractor_id: "",
  state_id: "",
  industry_type_id: "",
  other_industry_name: "",
  city: "",
  pincode: "",
  address: "",
  registration_identifiers: "",
  gstin: "",
  pan: "",
  lin: "",
  employer_name: "",
  applicable_regulations: "",
  male_employees: "0",
  female_employees: "0",
  male_workers: "0",
  female_workers: "0",
  contact_email: "",
  contact_phone: "",
  effective_date: "",
  compliance_start_date: new Date().toISOString().slice(0, 10),
  status: "ACTIVE",
});

const entitySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z.string().trim().min(1, "Code is required").max(100),
  unit_type: z.string(),
  contractor_type: z.string(),
  unit_id: z.string(),
  contractor_id: z.string(),
  state_id: z.string(),
  industry_type_id: z.string(),
  other_industry_name: z.string(),
  city: z.string(),
  pincode: z.string(),
  address: z.string(),
  registration_identifiers: z.string(),
  gstin: z.string(),
  pan: z.string(),
  lin: z.string(),
  employer_name: z.string(),
  applicable_regulations: z.string(),
  male_employees: z.string().regex(/^\d+$/, "Use a whole number"),
  female_employees: z.string().regex(/^\d+$/, "Use a whole number"),
  male_workers: z.string().regex(/^\d+$/, "Use a whole number"),
  female_workers: z.string().regex(/^\d+$/, "Use a whole number"),
  contact_email: z.string(),
  contact_phone: z.string(),
  effective_date: z.string(),
  compliance_start_date: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const entityMeta: Record<
  EntityKind,
  { title: string; singular: string; icon: typeof Building2 }
> = {
  units: { title: "Units / branches", singular: "unit", icon: Building2 },
  contractors: {
    title: "Contractors",
    singular: "contractor",
    icon: UsersRound,
  },
  sites: {
    title: "Contractor sites",
    singular: "contractor site",
    icon: MapPin,
  },
};

function text(row: Row, key: string) {
  const value = row[key];
  return value == null || value === "" ? "—" : String(value);
}

function asForm(row: Row): EntityForm {
  const defaults = blankEntity();
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      row[key] == null ? fallback : String(row[key]),
    ]),
  ) as EntityForm;
}

function requestBody(values: EntityForm, kind: EntityKind) {
  const numericFields =
    kind === "units"
      ? ["male_employees", "female_employees"]
      : ["male_workers", "female_workers"];
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      numericFields.includes(key) ? Number(value || 0) : value || null,
    ]),
  );
}

function isOrganizationEntityAdmin(user: User) {
  return (
    user.platform_role === "MORAX_ADMIN" ||
    user.roles.includes("ORGANIZATION_ADMIN")
  );
}

export function ModernEntities({ user }: { user: User }) {
  const { kind = "units" } = useParams();
  const validKind: EntityKind =
    kind === "contractors" || kind === "sites" ? kind : "units";
  return <EntityManager key={validKind} user={user} kind={validKind} />;
}

function EntityManager({ user, kind }: { user: User; kind: EntityKind }) {
  const queryClient = useQueryClient();
  const canManage = isOrganizationEntityAdmin(user);
  const meta = entityMeta[kind];
  const Icon = meta.icon;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");

  const sort = sorting[0];
  const listFilters = useMemo(
    () => ({
      page: String(page),
      page_size: "10",
      q: deferredSearch.trim() || undefined,
      status: status || undefined,
      sort_by: sort?.id || "name",
      sort_dir: sort?.desc ? "desc" : "asc",
    }),
    [deferredSearch, page, sort?.desc, sort?.id, status],
  );

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, status, sort?.desc, sort?.id]);

  const listQuery = useQuery({
    queryKey: ["entity-list", kind, listFilters],
    queryFn: () =>
      kind === "units"
        ? morax.unitsPage(listFilters)
        : kind === "contractors"
          ? morax.contractorsPage(listFilters)
          : morax.sitesPage(listFilters),
    staleTime: 30_000,
  });

  const optionsQuery = useQuery({
    queryKey: ["entity-form-options"],
    queryFn: async () => {
      const [states, industries, units, contractors] = await Promise.all([
        morax.states(),
        morax.industries(),
        morax.unitsPage({ page: "1", page_size: "100" }),
        morax.contractors(),
      ]);
      return { states, industries, units: units.items, contractors };
    },
    staleTime: 5 * 60_000,
  });

  const form = useForm<EntityForm>({
    resolver: zodResolver(entitySchema),
    defaultValues: blankEntity(),
  });
  const selectedIndustryId = form.watch("industry_type_id");
  const otherIndustryId = optionsQuery.data?.industries.find(
    (industry) => industry.code.toUpperCase() === "OTHER",
  )?.id;
  const isOtherIndustry = selectedIndustryId === otherIndustryId;

  const invalidateEntities = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entity-list", kind] }),
      queryClient.invalidateQueries({ queryKey: ["entity-form-options"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: EntityForm) => {
      if ((kind === "units" || kind === "sites") && !values.state_id) {
        throw new Error("Select a State before saving");
      }
      if ((kind === "units" || kind === "sites") && !values.industry_type_id) {
        throw new Error("Select an industry type before saving");
      }
      if (kind === "sites" && !values.contractor_id) {
        throw new Error("Select a contractor before saving");
      }
      const body = requestBody(values, kind);
      const id = editing ? String(editing.id) : "";
      if (kind === "units") {
        return id ? morax.updateUnit(id, body) : morax.createUnit(body);
      }
      if (kind === "contractors") {
        return id
          ? morax.updateContractor(id, body)
          : morax.createContractor(body);
      }
      return id ? morax.updateSite(id, body) : morax.createSite(body);
    },
    onSuccess: async () => {
      setNotice(
        `${editing ? "Updated" : "Created"} ${meta.singular} successfully.`,
      );
      closeForm();
      await invalidateEntities();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not save the record.",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Row) => {
      const id = String(row.id);
      if (kind === "units") return morax.deleteUnit(id);
      if (kind === "contractors") return morax.deleteContractor(id);
      return morax.deleteSite(id);
    },
    onSuccess: async () => {
      setNotice(
        `${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} deleted.`,
      );
      await invalidateEntities();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not delete the record.",
      ),
  });

  const openCreate = () => {
    setNotice("");
    setEditing(null);
    form.reset(blankEntity());
    setFormOpen(true);
  };
  const openEdit = useCallback(
    (row: Row) => {
      setNotice("");
      setEditing(row);
      form.reset(asForm(row));
      setFormOpen(true);
    },
    [form],
  );
  const closeForm = () => {
    setEditing(null);
    form.reset(blankEntity());
    setFormOpen(false);
  };

  const columns = useMemo<
    ColumnDef<typeof entityTableFeatures, Row, unknown>[]
  >(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="entity-name-cell">
            <b>{text(row.original, "name")}</b>
            <span>{text(row.original, "code")}</span>
          </div>
        ),
      },
      {
        accessorKey: "state_name",
        header: "State",
        cell: ({ row }) => text(row.original, "state_name"),
      },
      {
        accessorKey: "industry_name",
        header: "Industry",
        cell: ({ row }) => text(row.original, "industry_name"),
      },
      {
        id: "workforce",
        header: kind === "units" ? "Employees" : "Workers",
        enableSorting: false,
        cell: ({ row }) =>
          text(
            row.original,
            kind === "units" ? "total_employees" : "total_workers",
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`badge ${text(row.original, "status").toLowerCase()}`}
          >
            {text(row.original, "status")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          canManage ? (
            <div className="entity-table-actions">
              <button
                type="button"
                className="icon-action"
                title={`Edit ${meta.singular}`}
                aria-label={`Edit ${meta.singular}`}
                onClick={() => openEdit(row.original)}
              >
                <Edit3 size={16} />
              </button>
              <button
                type="button"
                className="icon-action danger"
                title={`Delete ${meta.singular}`}
                aria-label={`Delete ${meta.singular}`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${text(row.original, "name")}? Records with compliance history cannot be deleted.`,
                    )
                  ) {
                    deleteMutation.mutate(row.original);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : null,
      },
    ],
    [canManage, deleteMutation, kind, meta.singular, openEdit],
  );

  const table = useTable({
    features: entityTableFeatures,
    data: listQuery.data?.items ?? EMPTY_ROWS,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
  });
  const total = listQuery.data?.total ?? 0;
  const pageSize = listQuery.data?.page_size ?? 10;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="crud-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ENTITY MANAGEMENT</p>
          <h1>{meta.title}</h1>
          <p className="muted">
            Manage the organization records used throughout compliance
            operations.
          </p>
        </div>
        {canManage && (
          <button type="button" className="primary-action" onClick={openCreate}>
            <Plus size={17} /> Add {meta.singular}
          </button>
        )}
      </header>

      {notice && <InlineError message={notice} />}
      {!canManage && (
        <InlineError message="Organization administrator permission is required to manage these entities." />
      )}

      <section className="panel entity-list-panel">
        <div className="crud-toolbar">
          <label className="table-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label={`Search ${meta.title}`}
              value={search}
              placeholder={`Search ${meta.title.toLowerCase()}…`}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="compact-filter">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          {(search || status) && (
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setSearch("");
                setStatus("");
              }}
            >
              <X size={15} /> Clear filters
            </button>
          )}
        </div>

        {listQuery.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : listQuery.isError ? (
          <InlineError message="Unable to load organization records." />
        ) : table.getRowModel().rows.length === 0 ? (
          <EmptyState
            title={`No ${meta.title.toLowerCase()} found`}
            description="Change the filters or add the first record for this organization."
          />
        ) : (
          <div className="table-wrap modern-data-table">
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="table-sort"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            <span aria-hidden="true">
                              {header.column.getIsSorted() === "asc"
                                ? "↑"
                                : header.column.getIsSorted() === "desc"
                                  ? "↓"
                                  : "↕"}
                            </span>
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="table-pagination">
          <span>
            {total === 0
              ? "No records"
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <div>
            <button
              type="button"
              className="icon-action"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {page} of {lastPage}
            </span>
            <button
              type="button"
              className="icon-action"
              disabled={page >= lastPage}
              onClick={() => setPage((current) => current + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </section>

      {canManage && formOpen && (
        <div
          className="crud-drawer-backdrop"
          role="presentation"
          onMouseDown={closeForm}
        >
          <section
            className="crud-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entity-form-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <div>
                <span className="drawer-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <h2 id="entity-form-title">
                    {editing ? `Edit ${meta.singular}` : `Add ${meta.singular}`}
                  </h2>
                  <p>Required fields are marked by the validation feedback.</p>
                </div>
              </div>
              <button
                type="button"
                className="icon-action"
                onClick={closeForm}
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>
            <form
              className="entity-form"
              onSubmit={form.handleSubmit((values) =>
                saveMutation.mutate(values),
              )}
            >
              <div className="form-section">
                <h3>Identity</h3>
                <div className="form-grid">
                  <Field
                    label="Name"
                    error={form.formState.errors.name?.message}
                  >
                    <input {...form.register("name")} autoFocus />
                  </Field>
                  <Field
                    label="Code"
                    error={form.formState.errors.code?.message}
                  >
                    <input {...form.register("code")} />
                  </Field>
                  {kind === "units" ? (
                    <Field label="Unit type">
                      <input
                        {...form.register("unit_type")}
                        placeholder="Factory, branch, office…"
                      />
                    </Field>
                  ) : (
                    <Field label="Parent unit">
                      <select {...form.register("unit_id")}>
                        <option value="">Not linked</option>
                        {optionsQuery.data?.units.map((unit) => (
                          <option key={String(unit.id)} value={String(unit.id)}>
                            {text(unit, "name")}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {kind === "contractors" && (
                    <Field label="Contractor type">
                      <input {...form.register("contractor_type")} />
                    </Field>
                  )}
                  {kind === "sites" && (
                    <Field
                      label="Contractor"
                      error={form.formState.errors.contractor_id?.message}
                    >
                      <select {...form.register("contractor_id")}>
                        <option value="">Select contractor</option>
                        {optionsQuery.data?.contractors.map((contractor) => (
                          <option
                            key={String(contractor.id)}
                            value={String(contractor.id)}
                          >
                            {text(contractor, "name")}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h3>Compliance profile</h3>
                <div className="form-grid">
                  <Field
                    label="State"
                    error={form.formState.errors.state_id?.message}
                  >
                    <select {...form.register("state_id")}>
                      <option value="">
                        {kind === "contractors"
                          ? "Not configured"
                          : "Select state"}
                      </option>
                      {optionsQuery.data?.states.map((state: Master) => (
                        <option key={state.id} value={state.id}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Industry type"
                    error={form.formState.errors.industry_type_id?.message}
                  >
                    <select {...form.register("industry_type_id")}>
                      <option value="">
                        {kind === "contractors"
                          ? "Not configured"
                          : "Select industry"}
                      </option>
                      {optionsQuery.data?.industries.map((industry: Master) => (
                        <option key={industry.id} value={industry.id}>
                          {industry.code.toUpperCase() === "OTHER"
                            ? "Other industry"
                            : industry.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {isOtherIndustry && (
                    <Field label="Other industry name">
                      <input
                        {...form.register("other_industry_name")}
                        placeholder="Enter industry name"
                      />
                    </Field>
                  )}
                  <Field label="Compliance start">
                    <input
                      type="date"
                      {...form.register("compliance_start_date")}
                    />
                  </Field>
                  <Field label="Status">
                    <select {...form.register("status")}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                  <Field
                    label={kind === "units" ? "Male employees" : "Male workers"}
                    error={
                      kind === "units"
                        ? form.formState.errors.male_employees?.message
                        : form.formState.errors.male_workers?.message
                    }
                  >
                    <input
                      type="number"
                      min="0"
                      {...form.register(
                        kind === "units" ? "male_employees" : "male_workers",
                      )}
                    />
                  </Field>
                  <Field
                    label={
                      kind === "units" ? "Female employees" : "Female workers"
                    }
                    error={
                      kind === "units"
                        ? form.formState.errors.female_employees?.message
                        : form.formState.errors.female_workers?.message
                    }
                  >
                    <input
                      type="number"
                      min="0"
                      {...form.register(
                        kind === "units"
                          ? "female_employees"
                          : "female_workers",
                      )}
                    />
                  </Field>
                </div>
              </div>

              <div className="form-section">
                <h3>Contact and registration</h3>
                <div className="form-grid">
                  <Field label="City">
                    <input {...form.register("city")} />
                  </Field>
                  <Field label="Pincode">
                    <input {...form.register("pincode")} />
                  </Field>
                  <Field label="Contact email">
                    <input type="email" {...form.register("contact_email")} />
                  </Field>
                  <Field label="Contact phone">
                    <input {...form.register("contact_phone")} />
                  </Field>
                  <Field label="GSTIN">
                    <input {...form.register("gstin")} />
                  </Field>
                  <Field label="PAN">
                    <input {...form.register("pan")} />
                  </Field>
                  <Field label="LIN">
                    <input {...form.register("lin")} />
                  </Field>
                  <Field label="Employer name">
                    <input {...form.register("employer_name")} />
                  </Field>
                  <Field label="Effective date">
                    <input type="date" {...form.register("effective_date")} />
                  </Field>
                  <Field label="Address" wide>
                    <textarea rows={3} {...form.register("address")} />
                  </Field>
                  <Field label="Registration identifiers" wide>
                    <textarea
                      rows={2}
                      {...form.register("registration_identifiers")}
                    />
                  </Field>
                  <Field label="Applicable regulations" wide>
                    <textarea
                      rows={2}
                      {...form.register("applicable_regulations")}
                    />
                  </Field>
                </div>
              </div>
              <footer className="drawer-footer">
                <button type="button" className="secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : `Create ${meta.singular}`}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? "wide" : undefined}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
