import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { morax } from "../api/morax";
import type { Instance } from "../api/morax";
import {
  ComplianceStatusBadge,
  DashboardMetricCard,
  DashboardSection,
  EmptyState,
  FilterChip,
  formatDate,
  humanize,
  InlineError,
  LoadingSkeleton,
  WorkspacePageHeader,
} from "./workspace-ui";

const STATUS_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#dc2626",
  "#059669",
  "#7c3aed",
  "#64748b",
  "#0f766e",
];

const recurringFrequencies = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "EVENT_BASED",
];

const statusOptions = [
  "PENDING",
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "CORRECTION_REQUIRED",
  "REJECTED",
  "NOT_APPLICABLE",
  "OVERDUE",
];

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateAfter = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

function isRecurring(instance: Instance) {
  return instance.frequency !== "ONE_TIME";
}

function dueSoon(instance: Instance) {
  const today = toDateInput(new Date());
  return (
    !instance.is_overdue &&
    instance.due_date >= today &&
    instance.due_date <= dateAfter(7) &&
    instance.status !== "APPROVED" &&
    instance.status !== "NOT_APPLICABLE"
  );
}

export function ModernDashboard() {
  const { organizationId } = useParams();
  const base = organizationId ? `/app/organizations/${organizationId}` : "/app";
  const [summary, setSummary] = useState<{
    total: number;
    statuses: Record<string, number>;
    overdue: number;
    completed_late: number;
  }>();
  const [statusData, setStatusData] = useState<Record<string, number>>({});
  const [frequencyData, setFrequencyData] = useState<Record<string, number>>({});
  const [entityData, setEntityData] = useState<
    { entity: string; due: number; overdue: number; done: number; rate: number }[]
  >([]);
  const [upcoming, setUpcoming] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboard, statuses, frequencies, entities, upcomingInstances] =
        await Promise.all([
          morax.dashboard(),
          morax.statusChart(),
          morax.frequencyChart(),
          morax.entityChart(),
          morax.instances({
            date_from: toDateInput(new Date()),
            date_to: dateAfter(14),
            page_size: "20",
          }),
        ]);
      setSummary(dashboard);
      setStatusData(statuses);
      setFrequencyData(frequencies);
      setEntityData(entities);
      setUpcoming(
        upcomingInstances.items.filter(
          (item) =>
            item.status !== "APPROVED" && item.status !== "NOT_APPLICABLE",
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load the dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completed = summary?.statuses.APPROVED ?? 0;
  const pending =
    (summary?.statuses.PENDING ?? 0) +
    (summary?.statuses.IN_PROGRESS ?? 0) +
    (summary?.statuses.CORRECTION_REQUIRED ?? 0);
  const completionRate = summary?.total
    ? Math.round((completed / summary.total) * 100)
    : 0;
  const chartStatuses = Object.entries(statusData)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: humanize(name), value }));
  const chartFrequencies = Object.entries(frequencyData)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: humanize(name), value }));

  return (
    <div className="modern-page dashboard-page">
      <WorkspacePageHeader
        title="Compliance dashboard"
        description="A live view of organization obligations, due dates, and attention items."
        actions={
          <button className="button-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        }
      />
      <InlineError message={error} />

      {loading && !summary ? (
        <DashboardSection title="Loading compliance health">
          <LoadingSkeleton rows={5} />
        </DashboardSection>
      ) : (
        <>
          <section className="dashboard-metric-grid" aria-label="Compliance overview">
            <DashboardMetricCard
              label="Total obligations"
              value={summary?.total ?? 0}
              helper="Across accessible entities"
            />
            <DashboardMetricCard
              label="Completed"
              value={completed}
              helper={summary?.total ? `${completionRate}% completion rate` : "No obligations yet"}
              tone="success"
            />
            <DashboardMetricCard
              label="Pending action"
              value={pending}
              helper="Drafts and corrections"
              tone="warning"
            />
            <DashboardMetricCard
              label="Overdue"
              value={summary?.overdue ?? 0}
              helper="Requires immediate attention"
              tone="critical"
            />
            <DashboardMetricCard
              label="Due in 7 days"
              value={upcoming.filter(dueSoon).length}
              helper="Upcoming open obligations"
              tone="warning"
            />
          </section>

          <section className="dashboard-layout dashboard-two-column">
            <DashboardSection
              title="Compliance status"
              description="Distribution of current workflow states."
              className="status-chart-section"
            >
              {chartStatuses.length ? (
                <div className="donut-chart">
                  <ResponsiveContainer width="100%" height={285}>
                    <PieChart>
                      <Pie
                        data={chartStatuses}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={72}
                        outerRadius={104}
                        paddingAngle={3}
                      >
                        {chartStatuses.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, "Obligations"]} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-chart-total">
                    <strong>{completionRate}%</strong>
                    <span>completed</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No status data yet"
                  description="Create and generate compliance obligations to see their status distribution."
                />
              )}
            </DashboardSection>

            <DashboardSection
              title="Upcoming deadlines"
              description="Open obligations due in the next 14 days."
              action={
                <Link className="text-link" to={`${base}/compliances/recurring`}>
                  View worklist
                </Link>
              }
            >
              {upcoming.length ? (
                <div className="deadline-list">
                  {upcoming.slice(0, 5).map((item) => (
                    <Link
                      className="deadline-item"
                      key={item.id}
                      to={`${base}/compliances/detail/${item.id}`}
                    >
                      <span className={item.is_overdue ? "deadline-icon overdue" : "deadline-icon"}>
                        {item.is_overdue ? (
                          <AlertTriangle size={18} />
                        ) : (
                          <CalendarClock size={18} />
                        )}
                      </span>
                      <span className="deadline-copy">
                        <b>{item.compliance_name}</b>
                        <small>{item.subject_name} · {humanize(item.frequency)}</small>
                      </span>
                      <span className={item.is_overdue ? "deadline-date overdue" : "deadline-date"}>
                        {formatDate(item.due_date)}
                        <small>
                          {item.is_overdue
                            ? `${item.days_overdue}d overdue`
                            : dueSoon(item)
                              ? "Due soon"
                              : "Upcoming"}
                        </small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming deadlines"
                  description="There are no open compliance obligations due in the next 14 days."
                  icon={CheckCircle2}
                />
              )}
            </DashboardSection>
          </section>

          <section className="dashboard-layout dashboard-two-column">
            <DashboardSection
              title="Obligations by frequency"
              description="Recurring and one-time workload currently in scope."
            >
              {chartFrequencies.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartFrequencies} margin={{ top: 8, right: 8, left: -18, bottom: 10 }}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip cursor={{ fill: "#eff6ff" }} />
                      <Bar dataKey="value" name="Obligations" fill="#2563eb" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="No frequency data yet"
                  description="Frequency insights appear after compliance instances are generated."
                />
              )}
            </DashboardSection>

            <DashboardSection
              title="Entity compliance health"
              description="Due, overdue, and completed obligations by accessible entity."
            >
              {entityData.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={entityData.slice(0, 8)} margin={{ top: 8, right: 8, left: -18, bottom: 10 }}>
                      <XAxis dataKey="entity" tickLine={false} axisLine={false} fontSize={11} interval={0} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="done" name="Completed" stackId="a" fill="#059669" />
                      <Bar dataKey="due" name="Open" stackId="a" fill="#4f46e5" />
                      <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="No entity summary yet"
                  description="Entity performance is available after obligations have been generated."
                />
              )}
            </DashboardSection>
          </section>
        </>
      )}
    </div>
  );
}

type WorklistFilters = {
  q: string;
  status: string;
  risk_level: string;
  entity_type: string;
  frequency: string;
  due_window: string;
};

const documentTypeLabels: Record<string, string> = {
  PROCEDURAL: "Procedural",
  REGISTER: "Register",
  REMITTANCE: "Remittance",
  RETURN: "Return",
  RECORDS: "Records",
  INTIMATION_FILING: "Intimation/Filing",
  DISPLAY: "Display",
  NOTICE: "Notice",
};

const documentTypeOrder = [
  "REMITTANCE", "RETURN", "REGISTER", "RECORDS", "INTIMATION_FILING", "DISPLAY", "NOTICE", "PROCEDURAL",
];

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

function ComplianceActionDialog({
  item,
  onClose,
  detailPath,
}: {
  item: Instance | undefined;
  onClose: () => void;
  detailPath: string;
}) {
  useEffect(() => {
    if (!item) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [item, onClose]);

  if (!item) return null;
  const nextAction =
    item.status === "APPROVED" || item.status === "NOT_APPLICABLE"
      ? "No workflow action is currently required."
      : "Open full details to record activity, manage evidence, or take the workflow action permitted for your role.";

  return (
    <div className="dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="compliance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compliance-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">COMPLIANCE ACTION</p>
            <h2 id="compliance-dialog-title">{item.compliance_name}</h2>
            <p>{item.compliance_id}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-status-row">
          <ComplianceStatusBadge status={item.display_status ?? item.status} />
          <span className={item.is_overdue ? "dialog-due overdue" : "dialog-due"}>
            <CalendarClock size={16} />
            Due {formatDate(item.due_date)}
          </span>
        </div>
        <dl className="dialog-detail-grid">
          <div><dt>Entity</dt><dd>{item.subject_name}</dd></div>
          <div><dt>Entity type</dt><dd>{humanize(item.subject_type)}</dd></div>
          <div><dt>Frequency</dt><dd>{humanize(item.frequency)}</dd></div>
          <div><dt>Risk</dt><dd>{humanize(item.risk_level)}</dd></div>
          <div className="wide"><dt>Required evidence</dt><dd>{item.required_document || "No required evidence configured"}</dd></div>
          <div className="wide"><dt>Next action</dt><dd>{nextAction}</dd></div>
        </dl>
        <div className="dialog-footer">
          <button className="button-secondary" type="button" onClick={onClose}>Close</button>
          <Link className="button-primary" to={detailPath} onClick={onClose}>
            View full details
            <ExternalLink size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function GroupedRecurringWorklist() {
  const { organizationId } = useParams();
  const base = organizationId ? `/app/organizations/${organizationId}` : "/app";
  const [selected, setSelected] = useState<Instance>();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<WorklistFilters & { document_type: string }>({
    q: "", status: "", risk_level: "", entity_type: "", frequency: "", due_window: "", document_type: "",
  });
  const debouncedSearch = useDebouncedValue(filters.q.trim());
  const queryFilters = useMemo(() => {
    const values: Record<string, string> = { page: String(page), page_size: "20" };
    if (debouncedSearch) values.q = debouncedSearch;
    if (filters.status) values.status = filters.status;
    if (filters.risk_level) values.risk_level = filters.risk_level;
    if (filters.entity_type) values.entity_type = filters.entity_type;
    if (filters.frequency) values.frequency = filters.frequency;
    if (filters.document_type) values.document_type = filters.document_type;
    if (filters.due_window === "NEXT_7" || filters.due_window === "NEXT_30") {
      values.date_from = toDateInput(new Date());
      values.date_to = filters.due_window === "NEXT_7" ? dateAfter(7) : dateAfter(30);
    }
    return values;
  }, [debouncedSearch, filters, page]);
  const grouped = useQuery({
    queryKey: ["grouped-recurring-compliances", queryFilters],
    queryFn: () => morax.groupedInstances(queryFilters),
    staleTime: 20_000,
  });
  const data = grouped.data;
  const totalPages = Math.max(1, Math.ceil((data?.total_rules ?? 0) / (data?.page_size ?? 20)));
  const activeFilters = [
    filters.status && ["Status", humanize(filters.status)],
    filters.risk_level && ["Risk", humanize(filters.risk_level)],
    filters.entity_type && ["Entity type", humanize(filters.entity_type)],
    filters.frequency && ["Frequency", humanize(filters.frequency)],
    filters.due_window && ["Due date", filters.due_window === "NEXT_7" ? "Next 7 days" : "Next 30 days"],
    filters.document_type && ["Document type", documentTypeLabels[filters.document_type]],
    filters.q && ["Search", filters.q],
  ].filter(Boolean) as [string, string][];
  const updateFilter = <K extends keyof typeof filters>(field: K, value: (typeof filters)[K]) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  };
  const clearFilters = () => {
    setPage(1);
    setFilters({ q: "", status: "", risk_level: "", entity_type: "", frequency: "", due_window: "", document_type: "" });
  };
  const removeFilter = (label: string) => {
    const fields: Record<string, keyof typeof filters> = {
      Status: "status", Risk: "risk_level", "Entity type": "entity_type", Frequency: "frequency",
      "Due date": "due_window", "Document type": "document_type", Search: "q",
    };
    updateFilter(fields[label], "");
  };
  const toggleGroup = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const expandAll = () => setExpanded(new Set(data?.groups.map((group) => group.id) ?? []));

  return (
    <div className="modern-page grouped-compliance-page">
      <WorkspacePageHeader
        title="Compliances — Grouped by Rule"
        description="Recurring obligations grouped by their configured Act, regulation, or rule."
        actions={<button className="button-secondary" type="button" onClick={() => grouped.refetch()} disabled={grouped.isFetching}><RefreshCw size={16} className={grouped.isFetching ? "spin" : ""} />Refresh</button>}
      />
      <InlineError message={grouped.error instanceof Error ? grouped.error.message : ""} />

      <DashboardSection title="Filters" description="Results update automatically as filters change." className="filter-section" action={activeFilters.length ? <button className="text-button" type="button" onClick={clearFilters}><X size={15} />Clear all</button> : undefined}>
        <div className="filter-grid grouped-filter-grid">
          <label className="search-control"><span>Search</span><Search size={16} aria-hidden="true" /><input value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Search rule, compliance, or entity" /></label>
          <label>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{statusOptions.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></label>
          <label>Risk level<select value={filters.risk_level} onChange={(event) => updateFilter("risk_level", event.target.value)}><option value="">All risk levels</option>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></label>
          <label>Entity type<select value={filters.entity_type} onChange={(event) => updateFilter("entity_type", event.target.value)}><option value="">All entities</option>{["UNIT", "CONTRACTOR", "CONTRACTOR_SITE"].map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></label>
          <label>Frequency<select value={filters.frequency} onChange={(event) => updateFilter("frequency", event.target.value)}><option value="">All recurring frequencies</option>{recurringFrequencies.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></label>
          <label>Due date<select value={filters.due_window} onChange={(event) => updateFilter("due_window", event.target.value)}><option value="">All due dates</option><option value="NEXT_7">Next 7 days</option><option value="NEXT_30">Next 30 days</option></select></label>
        </div>
        {activeFilters.length > 0 && <div className="active-filters" aria-label="Active filters">{activeFilters.map(([label, value]) => <FilterChip key={label} label={`${label}: ${value}`} onRemove={() => removeFilter(label)} />)}</div>}
      </DashboardSection>

      <DashboardSection title="Compliances — Grouped by Rule" description={data ? `${data.total_compliances} compliance${data.total_compliances === 1 ? "" : "s"} across ${data.total_rules} applicable rule${data.total_rules === 1 ? "" : "s"}` : "Loading applicable rules"} className="grouped-compliance-section" action={<div className="group-actions"><button className="button-secondary compact-action" type="button" onClick={expandAll} disabled={!data?.groups.length}><ChevronDown size={15} />Expand all</button><button className="button-secondary compact-action" type="button" onClick={() => setExpanded(new Set())} disabled={!expanded.size}><ChevronDown size={15} className="collapse-icon" />Collapse all</button></div>}>
        <div className="document-type-tabs" aria-label="Filter by document type">
          <button className={`document-type-tab ${!filters.document_type ? "active" : ""}`} type="button" onClick={() => updateFilter("document_type", "")}>All <span>{data?.document_type_counts.reduce((total, item) => total + item.count, 0) ?? 0}</span></button>
          {documentTypeOrder.map((type) => {
            const count = data?.document_type_counts.find((item) => item.document_type === type)?.count ?? 0;
            return <button className={`document-type-tab ${filters.document_type === type ? "active" : ""}`} type="button" onClick={() => updateFilter("document_type", type)} key={type}>{documentTypeLabels[type]} <span>{count}</span></button>;
          })}
        </div>
        {grouped.isLoading ? <LoadingSkeleton rows={7} /> : data?.groups.length ? <div className="rule-group-list">{data.groups.map((group) => {
          const isExpanded = expanded.has(group.id);
          return <article className={`rule-group ${isExpanded ? "expanded" : ""}`} key={group.id}>
            <button className="rule-group-header" type="button" onClick={() => toggleGroup(group.id)} aria-expanded={isExpanded}>
              <span className="rule-group-title"><span className="rule-group-icon"><Layers3 size={18} /></span><span>{group.name}</span><span className="rule-count">{group.compliance_count} compliance{group.compliance_count === 1 ? "" : "s"}</span></span>
              <span className="rule-group-meta"><span className={group.due_count ? "rule-due-count" : "rule-due-count clear"}>{group.due_count} due</span><ChevronDown size={19} className={isExpanded ? "chevron-up" : ""} /></span>
            </button>
            {isExpanded && <div className="modern-table-wrap rule-records-table"><table className="modern-table"><thead><tr><th>Entity</th><th>Compliance type</th><th>Document type</th><th>Form no.</th><th>Frequency / period</th><th>Due date</th><th>Risk</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{group.records.map((item) => <tr key={item.id}><td><b>{item.subject_name}</b><small>{humanize(item.subject_type)}</small></td><td><b>{item.compliance_name}</b><small>{item.compliance_id}</small></td><td>{documentTypeLabels[item.document_type ?? ""] ?? humanize(item.document_type ?? "PROCEDURAL")}</td><td>{item.form_number || "—"}</td><td>{humanize(item.frequency)}<small>{item.period_key}</small></td><td><span className={item.is_overdue ? "table-due overdue" : "table-due"}>{formatDate(item.due_date)}<small>{item.is_overdue ? `${item.days_overdue}d overdue` : dueSoon(item) ? "Due soon" : ""}</small></span></td><td><span className={`risk-label ${item.risk_level.toLowerCase()}`}>{humanize(item.risk_level)}</span></td><td><ComplianceStatusBadge status={item.display_status ?? item.status} /></td><td><button className="icon-action" type="button" onClick={() => setSelected(item)} aria-label={`Open ${item.compliance_name}`}><Eye size={16} /></button></td></tr>)}</tbody></table></div>}
          </article>;
        })}{totalPages > 1 && <div className="pagination-row"><span>Showing rule groups {(page - 1) * (data.page_size ?? 20) + 1}–{Math.min(page * (data.page_size ?? 20), data.total_rules)} of {data.total_rules}</span><div><button className="icon-button" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous rule groups"><ChevronLeft size={17} /></button><span>Page {page} of {totalPages}</span><button className="icon-button" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} aria-label="Next rule groups"><ChevronRight size={17} /></button></div></div>}</div> : <EmptyState title="No recurring compliance records match" description="Try removing a filter or generate applicable obligations from the Compliance Master." icon={FileText} />}
      </DashboardSection>
      <ComplianceActionDialog item={selected} onClose={() => setSelected(undefined)} detailPath={selected ? `${base}/compliances/detail/${selected.id}` : ""} />
    </div>
  );
}

export function ModernWorklist() {
  const { kind } = useParams();
  return kind === "recurring" ? <GroupedRecurringWorklist /> : <OneTimeWorklist />;
}

function OneTimeWorklist() {
  const { kind, organizationId } = useParams();
  const base = organizationId ? `/app/organizations/${organizationId}` : "/app";
  const isOneTime = kind === "one-time";
  const [items, setItems] = useState<Instance[]>([]);
  const [selected, setSelected] = useState<Instance>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<WorklistFilters>({
    q: "",
    status: "",
    risk_level: "",
    entity_type: "",
    frequency: "",
    due_window: "",
  });
  const [sort, setSort] = useState<"due_date" | "status" | "risk_level">("due_date");
  const [sortAscending, setSortAscending] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    setLoading(true);
    setError("");
    const dateFrom =
      filters.due_window === "NEXT_7" || filters.due_window === "NEXT_30"
        ? toDateInput(new Date())
        : "";
    const dateTo =
      filters.due_window === "NEXT_7"
        ? dateAfter(7)
        : filters.due_window === "NEXT_30"
          ? dateAfter(30)
          : "";
    try {
      const result = await morax.instances({
        q: filters.q,
        status: filters.status,
        risk_level: filters.risk_level,
        entity_type: filters.entity_type,
        date_from: dateFrom,
        date_to: dateTo,
        page_size: "100",
      });
      setItems(result.items);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load compliance obligations.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = filters.q ? 350 : 0;
    const timer = window.setTimeout(load, delay);
    return () => window.clearTimeout(timer);
  }, [
    kind,
    filters.q,
    filters.status,
    filters.risk_level,
    filters.entity_type,
    filters.frequency,
    filters.due_window,
  ]);

  const visibleItems = useMemo(() => {
    const scoped = items
      .filter((item) => (isOneTime ? !isRecurring(item) : isRecurring(item)))
      .filter(
        (item) => !filters.frequency || item.frequency === filters.frequency,
      );
    return [...scoped].sort((left, right) => {
      const a =
        sort === "status"
          ? left.display_status ?? left.status
          : sort === "risk_level"
            ? left.risk_level
            : left.due_date;
      const b =
        sort === "status"
          ? right.display_status ?? right.status
          : sort === "risk_level"
            ? right.risk_level
            : right.due_date;
      return String(a).localeCompare(String(b)) * (sortAscending ? 1 : -1);
    });
  }, [items, isOneTime, filters.frequency, sort, sortAscending]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = visibleItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const completed = visibleItems.filter((item) => item.status === "APPROVED").length;
  const overdue = visibleItems.filter((item) => item.is_overdue).length;
  const dueSoonCount = visibleItems.filter(dueSoon).length;
  const open = visibleItems.filter(
    (item) => item.status !== "APPROVED" && item.status !== "NOT_APPLICABLE",
  ).length;
  const activeFilters = [
    filters.status && ["Status", humanize(filters.status)],
    filters.risk_level && ["Risk", humanize(filters.risk_level)],
    filters.entity_type && ["Entity type", humanize(filters.entity_type)],
    filters.frequency && ["Frequency", humanize(filters.frequency)],
    filters.due_window && [
      "Due date",
      filters.due_window === "NEXT_7" ? "Next 7 days" : "Next 30 days",
    ],
    filters.q && ["Search", filters.q],
  ].filter(Boolean) as [string, string][];
  const frequencies = isOneTime ? ["ONE_TIME"] : recurringFrequencies;

  const updateFilter = <K extends keyof WorklistFilters>(
    field: K,
    value: WorklistFilters[K],
  ) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  };
  const clearFilters = () => {
    setPage(1);
    setFilters({
      q: "",
      status: "",
      risk_level: "",
      entity_type: "",
      frequency: "",
      due_window: "",
    });
  };
  const toggleSort = (field: "due_date" | "status" | "risk_level") => {
    setPage(1);
    if (field === sort) setSortAscending((current) => !current);
    else {
      setSort(field);
      setSortAscending(true);
    }
  };

  return (
    <div className="modern-page worklist-page">
      <WorkspacePageHeader
        title={isOneTime ? "One-time compliance" : "Recurring compliance"}
        description={
          isOneTime
            ? "Track one-time statutory obligations and their workflow status."
            : "Prioritize recurring compliance actions, deadlines, and evidence."
        }
        actions={
          <button className="button-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        }
      />
      <InlineError message={error} />

      <section className="worklist-summary" aria-label="Worklist overview">
        <DashboardMetricCard label="Total" value={visibleItems.length} helper="Matching obligations" />
        <DashboardMetricCard label="Completed" value={completed} helper="Approved obligations" tone="success" />
        <DashboardMetricCard label="Open" value={open} helper="Requires workflow action" tone="warning" />
        <DashboardMetricCard label="Overdue" value={overdue} helper="Past due date" tone="critical" />
        <DashboardMetricCard label="Due soon" value={dueSoonCount} helper="Due in 7 days" tone="warning" />
      </section>

      <DashboardSection
        title="Filters"
        description="Results update automatically as you change a filter."
        className="filter-section"
        action={
          activeFilters.length ? (
            <button className="text-button" type="button" onClick={clearFilters}>
              <X size={15} />
              Clear all
            </button>
          ) : undefined
        }
      >
        <div className="filter-grid">
          <label className="search-control">
            <span>Search</span>
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="Compliance or entity"
            />
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {statusOptions.map((value) => (
                <option value={value} key={value}>{humanize(value)}</option>
              ))}
            </select>
          </label>
          <label>
            Risk level
            <select
              value={filters.risk_level}
              onChange={(event) => updateFilter("risk_level", event.target.value)}
            >
              <option value="">All risk levels</option>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                <option value={value} key={value}>{humanize(value)}</option>
              ))}
            </select>
          </label>
          <label>
            Entity type
            <select
              value={filters.entity_type}
              onChange={(event) => updateFilter("entity_type", event.target.value)}
            >
              <option value="">All entities</option>
              {["UNIT", "CONTRACTOR", "CONTRACTOR_SITE"].map((value) => (
                <option value={value} key={value}>{humanize(value)}</option>
              ))}
            </select>
          </label>
          {!isOneTime && (
            <label>
              Frequency
              <select
                value={filters.frequency}
                onChange={(event) => updateFilter("frequency", event.target.value)}
              >
                <option value="">All recurring frequencies</option>
                {frequencies.map((value) => (
                  <option value={value} key={value}>{humanize(value)}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Due date
            <select
              value={filters.due_window}
              onChange={(event) => updateFilter("due_window", event.target.value)}
            >
              <option value="">All due dates</option>
              <option value="NEXT_7">Next 7 days</option>
              <option value="NEXT_30">Next 30 days</option>
            </select>
          </label>
        </div>
        {activeFilters.length > 0 && (
          <div className="active-filters" aria-label="Active filters">
            {activeFilters.map(([label, value]) => (
              <FilterChip
                key={label}
                label={`${label}: ${value}`}
                onRemove={() =>
                  updateFilter(
                    label === "Status"
                      ? "status"
                      : label === "Risk"
                        ? "risk_level"
                        : label === "Entity type"
                          ? "entity_type"
                          : label === "Frequency"
                            ? "frequency"
                            : label === "Due date"
                              ? "due_window"
                              : "q",
                    "",
                  )
                }
              />
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title={isOneTime ? "One-time obligations" : "Recurring action items"}
        description={`${visibleItems.length} matching obligation${visibleItems.length === 1 ? "" : "s"}`}
        className="worklist-table-section"
        action={
          <span className="table-heading-icon">
            <Filter size={16} />
            Live results
          </span>
        }
      >
        {loading ? (
          <LoadingSkeleton rows={8} />
        ) : pagedItems.length ? (
          <>
            <div className="modern-table-wrap">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Compliance</th>
                    <th>Entity</th>
                    <th>Frequency</th>
                    <th>
                      <button className="table-sort" onClick={() => toggleSort("due_date")}>
                        Due date <ArrowUpDown size={14} />
                      </button>
                    </th>
                    <th>
                      <button className="table-sort" onClick={() => toggleSort("risk_level")}>
                        Risk <ArrowUpDown size={14} />
                      </button>
                    </th>
                    <th>
                      <button className="table-sort" onClick={() => toggleSort("status")}>
                        Status <ArrowUpDown size={14} />
                      </button>
                    </th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="compliance-name">
                          <span className="table-icon"><ClipboardCheck size={17} /></span>
                          <div>
                            <b>{item.compliance_name}</b>
                            <small>{item.compliance_id}</small>
                            {item.required_document && <small>Evidence: {item.required_document}</small>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <b>{item.subject_name}</b>
                        <small>{humanize(item.subject_type)}</small>
                      </td>
                      <td>{humanize(item.frequency)}</td>
                      <td>
                        <span className={item.is_overdue ? "table-due overdue" : "table-due"}>
                          {formatDate(item.due_date)}
                          <small>{item.is_overdue ? `${item.days_overdue}d overdue` : dueSoon(item) ? "Due soon" : ""}</small>
                        </span>
                      </td>
                      <td><span className={`risk-label ${item.risk_level.toLowerCase()}`}>{humanize(item.risk_level)}</span></td>
                      <td><ComplianceStatusBadge status={item.display_status ?? item.status} /></td>
                      <td>
                        <button className="table-action" type="button" onClick={() => setSelected(item)}>
                          <Eye size={16} />
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-row">
              <span>
                Showing {Math.min((currentPage - 1) * pageSize + 1, visibleItems.length)}–{Math.min(currentPage * pageSize, visibleItems.length)} of {visibleItems.length}
              </span>
              <div>
                <button className="icon-button" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous page">
                  <ChevronLeft size={17} />
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button className="icon-button" type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} aria-label="Next page">
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No matching compliance actions"
            description="Try removing a filter or generate obligations from the Compliance Master."
            icon={FileText}
          />
        )}
      </DashboardSection>

      <ComplianceActionDialog
        item={selected}
        onClose={() => setSelected(undefined)}
        detailPath={selected ? `${base}/compliances/detail/${selected.id}` : ""}
      />
    </div>
  );
}
