import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  UsersRound,
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
import {
  DashboardMetricCard,
  DashboardSection,
  EmptyState,
  formatDate,
  humanize,
  InlineError,
  LoadingSkeleton,
  WorkspacePageHeader,
} from "./workspace-ui";

type DashboardFilters = {
  unit_id: string;
  entity_id: string;
  contractor_id: string;
  period_key: string;
};

const fallbackStatusColors = [
  "#059669",
  "#7c3aed",
  "#dc2626",
  "#0f766e",
  "#2563eb",
  "#64748b",
];

function statusColor(status: string, index: number) {
  const value = status.toUpperCase();
  if (value.includes("COMPLETED") || value.includes("APPROVED"))
    return "#059669";
  if (value.includes("OVERDUE") || value.includes("REJECTED")) return "#dc2626";
  if (value === "DUE") return "#2563eb";
  if (value.includes("PENDING")) return "#7c3aed";
  if (value.includes("REVIEW") || value.includes("SUBMITTED")) return "#0f766e";
  if (value.includes("CORRECTION")) return "#2563eb";
  return fallbackStatusColors[index % fallbackStatusColors.length];
}

function healthTone(rate: number, overdue: number) {
  if (overdue > 0) return "critical";
  if (rate >= 80) return "healthy";
  if (rate >= 50) return "watch";
  return "attention";
}

function HealthRankings({
  rows,
  kind,
}: {
  rows: {
    id: string;
    name: string;
    entity_type?: string;
    total: number;
    completed: number;
    overdue: number;
    rate: number;
  }[];
  kind: "entity" | "contractor";
}) {
  if (!rows.length) {
    return (
      <EmptyState
        title={"No " + kind + " health data"}
        description="Generate compliance obligations to compare health across the selected scope."
      />
    );
  }
  return (
    <div className="health-ranking">
      {rows.slice(0, 8).map((row, index) => {
        const tone = healthTone(row.rate, row.overdue);
        return (
          <div className="health-row" key={row.id}>
            <span className="health-rank">{index + 1}</span>
            <div className="health-name">
              <b>{row.name}</b>
              <small>
                {row.entity_type ? humanize(row.entity_type) : "Contractor"} ·{" "}
                {row.completed}/{row.total} completed
              </small>
            </div>
            <div
              className="health-progress"
              aria-label={row.rate + "% compliant"}
            >
              <span
                className={"health-progress-fill " + tone}
                style={{ width: row.rate + "%" }}
              />
            </div>
            <b className={"health-rate " + tone}>{row.rate}%</b>
            <span
              className={
                row.overdue ? "health-overdue has-overdue" : "health-overdue"
              }
            >
              {row.overdue} overdue
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MainDashboard() {
  const { organizationId } = useParams();
  const base = organizationId ? "/app/organizations/" + organizationId : "/app";
  const [filters, setFilters] = useState<DashboardFilters>({
    unit_id: "",
    entity_id: "",
    contractor_id: "",
    period_key: "",
  });
  const overview = useQuery({
    queryKey: ["dashboard-overview", filters],
    queryFn: () => morax.dashboardOverview(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const data = overview.data;
  const summary = data?.summary;

  const changeUnit = (unit_id: string) =>
    setFilters({ unit_id, entity_id: "", contractor_id: "", period_key: "" });
  const changeEntity = (entity_id: string) =>
    setFilters((current) => ({
      ...current,
      entity_id,
      contractor_id: "",
      period_key: "",
    }));
  const changeContractor = (contractor_id: string) =>
    setFilters((current) => ({ ...current, contractor_id, period_key: "" }));
  const changePeriod = (period_key: string) =>
    setFilters((current) => ({ ...current, period_key }));

  return (
    <div className="modern-page dashboard-page">
      <WorkspacePageHeader
        title="Compliance dashboard"
        description="A live, filter-aware view of obligations, compliance health, and deadlines."
        actions={
          <button
            className="button-secondary"
            onClick={() => overview.refetch()}
            disabled={overview.isFetching}
          >
            <RefreshCw
              size={16}
              className={overview.isFetching ? "spin" : ""}
            />
            Refresh
          </button>
        }
      />
      <InlineError
        message={overview.error instanceof Error ? overview.error.message : ""}
      />

      <DashboardSection
        title="Dashboard filters"
        description="Selections update every dashboard metric and insight automatically."
        className="dashboard-filter-section"
      >
        <div className="dashboard-filter-grid">
          <label>
            Organization unit
            <select
              value={filters.unit_id}
              onChange={(event) => changeUnit(event.target.value)}
            >
              <option value="">All organization units</option>
              {data?.filters.units.map((unit) => (
                <option value={unit.id} key={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entity
            <select
              value={filters.entity_id}
              onChange={(event) => changeEntity(event.target.value)}
            >
              <option value="">All accessible entities</option>
              {data?.filters.entities.map((entity) => (
                <option value={entity.id} key={entity.id}>
                  {entity.name} · {humanize(entity.entity_type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contractor
            <select
              value={filters.contractor_id}
              onChange={(event) => changeContractor(event.target.value)}
            >
              <option value="">All contractors</option>
              {data?.filters.contractors.map((contractor) => (
                <option value={contractor.id} key={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select
              value={filters.period_key}
              onChange={(event) => changePeriod(event.target.value)}
            >
              <option value="">All periods</option>
              {data?.filters.periods.map((period) => (
                <option value={period} key={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>
        </div>
      </DashboardSection>

      {overview.isLoading && !data ? (
        <DashboardSection title="Loading compliance health">
          <LoadingSkeleton rows={6} />
        </DashboardSection>
      ) : (
        <>
          <section
            className="dashboard-metric-grid"
            aria-label="Compliance overview"
          >
            <DashboardMetricCard
              label="Total obligations"
              value={summary?.total ?? 0}
              helper="Selected scope"
            />
            <DashboardMetricCard
              label="Completed"
              value={summary?.completed ?? 0}
              helper={(summary?.completion_rate ?? 0) + "% compliance"}
              tone="success"
            />
            <DashboardMetricCard
              label="Pending action"
              value={summary?.pending ?? 0}
              helper="Drafts and corrections"
              tone="warning"
            />
            <DashboardMetricCard
              label="Overdue"
              value={summary?.overdue ?? 0}
              helper="Needs immediate attention"
              tone="critical"
            />
            <DashboardMetricCard
              label="Due in 7 days"
              value={summary?.due_soon ?? 0}
              helper="Upcoming open obligations"
              tone="attention"
            />
          </section>

          <section className="dashboard-layout dashboard-two-column">
            <DashboardSection
              title="Compliance status"
              description="Current workflow state across the selected scope."
            >
              {data?.status_distribution.length ? (
                <div className="donut-chart">
                  <ResponsiveContainer width="100%" height={290}>
                    <PieChart>
                      <Pie
                        data={data.status_distribution}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={74}
                        outerRadius={106}
                        paddingAngle={3}
                      >
                        {data.status_distribution.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={statusColor(entry.name, index)}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, "Obligations"]} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-chart-total">
                    <strong>{summary?.completion_rate ?? 0}%</strong>
                    <span>completed</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No compliance data"
                  description="No obligations match the current dashboard filters."
                />
              )}
            </DashboardSection>

            <DashboardSection
              title="Upcoming deadlines"
              description="Open obligations due over the next 14 days."
              action={
                <Link
                  className="text-link"
                  to={base + "/compliances/recurring"}
                >
                  View worklist
                </Link>
              }
            >
              {data?.upcoming.length ? (
                <div className="deadline-list">
                  {data.upcoming.slice(0, 8).map((item) => (
                    <Link
                      className="deadline-item"
                      key={item.id}
                      to={base + "/compliances/detail/" + item.id}
                    >
                      <span className="deadline-icon">
                        <CalendarClock size={18} />
                      </span>
                      <span className="deadline-copy">
                        <b>{item.compliance_name}</b>
                        <small>
                          {item.subject_name} · {humanize(item.frequency)}
                        </small>
                      </span>
                      <span className="deadline-date">
                        {formatDate(item.due_date)}
                        <small>
                          {item.display_status === "OVERDUE"
                            ? item.days_overdue + "d overdue"
                            : "Upcoming"}
                        </small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming deadlines"
                  description="No open obligations are due in the next 14 days for this scope."
                  icon={CheckCircle2}
                />
              )}
            </DashboardSection>
          </section>

          <section className="dashboard-layout dashboard-two-column">
            <DashboardSection
              title="Obligations by frequency"
              description="Workload distribution across compliance schedules."
            >
              {data?.frequency_distribution.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.frequency_distribution}
                      margin={{ top: 8, right: 8, left: -18, bottom: 10 }}
                    >
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <Tooltip cursor={{ fill: "#eff6ff" }} />
                      <Bar
                        dataKey="value"
                        name="Obligations"
                        fill="#4f46e5"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="No frequency insight"
                  description="No compliance schedules match the current filters."
                />
              )}
            </DashboardSection>
            <DashboardSection
              title="Contractor compliance"
              description="Compare contractor performance in the selected scope."
            >
              <HealthRankings
                rows={data?.contractor_health ?? []}
                kind="contractor"
              />
            </DashboardSection>
          </section>

          <DashboardSection
            title="Entity compliance health"
            description="Ranked by completion percentage, with completed totals and overdue obligations visible at a glance."
            className="entity-health-section"
            action={
              <span className="table-heading-icon">
                <UsersRound size={16} />
                Selected entities
              </span>
            }
          >
            <HealthRankings rows={data?.entity_health ?? []} kind="entity" />
          </DashboardSection>
        </>
      )}
    </div>
  );
}
