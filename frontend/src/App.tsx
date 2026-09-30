import { useDeferredValue, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  ClipboardList,
  FileArchive,
  FileText,
  Landmark,
  LayoutDashboard,
  MapPinned,
  Settings as SettingsIcon,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { setToken } from "./api/client";
import { morax } from "./api/morax";
import type { Evidence, Instance, Master, RoleScope, User } from "./api/morax";
import { ModernWorklist } from "./components/modern-compliance-pages";
import { MainDashboard } from "./components/filtered-dashboard";
import { ModernEntities } from "./components/entity-manager";
import { UserAccessManager } from "./components/user-access-manager";
import { ComplianceMasterManager } from "./components/compliance-master-manager";
import { DocumentLibrary } from "./components/document-library";
import "./App.css";

type Row = Record<string, unknown>;
const today = () => new Date().toISOString().slice(0, 10);
const message = (error: unknown, fallback = "Request failed") =>
  error instanceof Error ? error.message : fallback;
const ErrorBox = ({ text }: { text: string }) =>
  text ? (
    <p className={`alert ${text.startsWith("Success:") ? "success" : "error"}`}>
      {text}
    </p>
  ) : null;
const Badge = ({ text }: { text: string }) => (
  <span className={`badge ${text.toLowerCase()}`}>
    {text.replaceAll("_", " ")}
  </span>
);
const Header = ({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) => (
  <header className="page-header">
    <div>
      <p className="eyebrow">MORAX WORKSPACE</p>
      <h1>{title}</h1>
    </div>
    {children}
  </header>
);
const Panel = ({ children }: { children: ReactNode }) => (
  <section className="panel">{children}</section>
);
const canManage = (user: User) =>
  user.platform_role === "MORAX_ADMIN" ||
  user.roles.some((role) =>
    ["ORGANIZATION_ADMIN", "UNIT_ADMIN", "CONTRACTOR_ADMIN"].includes(role),
  );
const canManageEntity = (user: User) =>
  user.platform_role === "MORAX_ADMIN" ||
  user.roles.includes("ORGANIZATION_ADMIN");
const canCheck = (user: User) =>
  user.platform_role === "MORAX_ADMIN" ||
  user.roles.some((role) =>
    [
      "ORGANIZATION_ADMIN",
      "UNIT_ADMIN",
      "CONTRACTOR_ADMIN",
      "UNIT_CHECKER",
      "CONTRACTOR_CHECKER",
    ].includes(role),
  );
const subjectLabel = (type: string) =>
  type === "CONTRACTOR_SITE"
    ? "Contractor site"
    : type[0] + type.slice(1).toLowerCase();
const objectToForm = (row: Row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value == null ? "" : String(value),
    ]),
  ) as Record<string, string>;
const payload = (form: Record<string, string>, numbers: string[] = []) =>
  Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      numbers.includes(key) ? Number(value || 0) : value === "" ? null : value,
    ]),
  );

function Login({ done }: { done: (user: User) => void }) {
  const [email, setEmail] = useState("admin@morax.example.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await morax.login(email, password);
      setToken(response.access_token);
      done(response.user);
    } catch (err) {
      setError(message(err, "Login failed"));
    }
  }
  return (
    <main className="login-shell">
      <div className="login-intro">
        <p className="eyebrow">MORAX · LABOUR COMPLIANCE</p>
        <h1>Every obligation. One auditable flow.</h1>
        <p>
          Configure entities, govern the Compliance Master, prepare evidence,
          assign accountability, and complete review with confidence.
        </p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorBox text={error} />
        <button>Sign in</button>
        <small>Demo: admin@morax.example.com / Admin@123</small>
      </form>
    </main>
  );
}

const links = [
  ["Dashboard", "dashboard"],
  ["Recurring", "compliances/recurring"],
  ["One-time", "compliances/one-time"],
  ["Units", "entities/units"],
  ["Contractors", "entities/contractors"],
  ["Sites", "entities/sites"],
  ["Users & access", "users"],
  ["Compliance Master", "compliance-master"],
  ["Document library", "documents"],
  ["Notifications", "notifications"],
  ["Reports", "reports"],
  ["Audit trail", "audit"],
  ["Organization settings", "settings"],
];

const navIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  Recurring: CalendarClock,
  "One-time": ClipboardList,
  Units: Building2,
  Contractors: Landmark,
  Sites: MapPinned,
  "Users & access": UsersIcon,
  "Compliance Master": BookOpenCheck,
  "Document library": FileArchive,
  Notifications: Bell,
  Reports: ChartNoAxesCombined,
  "Audit trail": ShieldCheck,
  "Organization settings": SettingsIcon,
  Organizations: Building2,
};

function WorkspaceNavLink({ label, to }: { label: string; to: string }) {
  const Icon = navIcons[label] ?? FileText;
  return (
    <NavLink
      to={to}
      className={({ isActive }) => (isActive ? "active" : undefined)}
    >
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}

function workspaceLinks(user: User) {
  if (
    user.platform_role === "MORAX_ADMIN" ||
    user.roles.includes("ORGANIZATION_ADMIN")
  )
    return links;
  const common = [
    "Dashboard",
    "Recurring",
    "One-time",
    "Document library",
    "Notifications",
    "Reports",
    "Organization settings",
  ];
  const organizationAuditor = user.scopes.some(
    (scope) =>
      scope.role === "AUDITOR" &&
      scope.scope_type === "ORGANIZATION" &&
      scope.scope_id === user.organization_id,
  );
  if (organizationAuditor)
    return links.filter(([label]) =>
      [...common, "Audit trail"].includes(label),
    );
  return links.filter(([label]) => common.includes(label));
}

function ImpersonationBanner({
  user,
  endImpersonation,
}: {
  user: User;
  endImpersonation: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  if (!user.impersonation?.active) return null;
  return (
    <div
      className="impersonation-banner"
      role="status"
      style={{
        background: "#fff3cd",
        border: "1px solid #e6b800",
        borderRadius: "0.5rem",
        color: "#5f4300",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        marginBottom: "1.25rem",
        padding: "0.75rem 1rem",
      }}
    >
      <div>
        <b>Viewing as: {user.name}</b>
        <span>
          {" "}
          You are using this user’s role and organization scope. Actions are
          audited.
        </span>
      </div>
      <div className="action-row">
        <button
          className="secondary"
          onClick={async () => {
            try {
              await endImpersonation();
            } catch (err) {
              setError(message(err, "Could not return to administrator"));
            }
          }}
        >
          Return to administrator
        </button>
        {error && <small>{error}</small>}
      </div>
    </div>
  );
}

function Layout({
  user,
  logout,
  onImpersonate,
  endImpersonation,
}: {
  user: User;
  logout: () => void;
  onImpersonate: (userId: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
}) {
  const { organizationId } = useParams();
  const [organizationName, setOrganizationName] = useState("");
  const prefix = organizationId
    ? "/app/organizations/" + organizationId
    : "/app";
  useEffect(() => {
    if (organizationId)
      morax
        .organization()
        .then((row) =>
          setOrganizationName(String(row.name ?? "Selected organization")),
        )
        .catch(() => setOrganizationName("Organization context"));
  }, [organizationId]);
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <img
            src="https://www.morainsights.com/images/logo.png"
            alt="MORAX"
            style={{
              background: "#fff",
              borderRadius: "0.35rem",
              display: "block",
              maxWidth: "160px",
              padding: "0.35rem",
            }}
          />
        </div>
        <p className="tenant">
          {user.name}
          <br />
          <small>
            {user.platform_role || user.roles.join(", ") || "No role"}
          </small>
          {organizationId && (
            <>
              <br />
              <small>Organization: {organizationName || "Loading..."}</small>
            </>
          )}
        </p>
        <nav aria-label="Workspace navigation">
          {user.platform_role === "MORAX_ADMIN" && (
            <WorkspaceNavLink label="Organizations" to="/app/organizations" />
          )}
          {workspaceLinks(user).map(([label, path]) => (
            <WorkspaceNavLink
              key={path}
              label={label}
              to={prefix + "/" + path}
            />
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="content">
        <header className="app-topbar">
          <div>
            <span className="topbar-context">
              {organizationId
                ? organizationName || "Organization workspace"
                : "MORAX Workspace"}
            </span>
          </div>
          <div className="topbar-actions">
            <Link
              className="topbar-icon-link"
              to={prefix + "/notifications"}
              aria-label="Notifications"
            >
              <Bell size={18} />
            </Link>
            <Link className="topbar-user" to={prefix + "/settings"}>
              <span className="avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <b>{user.name}</b>
                <small>
                  {user.platform_role || user.roles[0] || "Workspace user"}
                </small>
              </span>
            </Link>
          </div>
        </header>
        <ImpersonationBanner user={user} endImpersonation={endImpersonation} />
        <Routes>
          <Route path="dashboard" element={<MainDashboard />} />
          <Route path="compliances/:kind" element={<ModernWorklist />} />
          <Route
            path="compliances/detail/:id"
            element={<Detail user={user} />}
          />
          <Route
            path="entities/:kind"
            element={<ModernEntities user={user} />}
          />
          <Route
            path="users"
            element={
              <UserAccessManager user={user} onImpersonate={onImpersonate} />
            }
          />
          <Route path="compliance-master" element={<ComplianceMasterManager />} />
          <Route path="documents" element={<DocumentLibrary user={user} />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<Audit />} />
          <Route path="settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Organizations({ user }: { user: User }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "" });
  const deferredSearch = useDeferredValue(filters.q);
  const blank = {
    organization_name: "",
    organization_code: "",
    legal_name: "",
    registration_number: "",
    pan: "",
    gstin: "",
    registered_address: "",
    city: "",
    pincode: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
    compliance_start_date: today(),
    status: "ACTIVE",
  };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState("");
  const load = () =>
    morax
      .platformOrganizations(filters)
      .then(setRows)
      .catch((err) => setError(message(err)));
  useEffect(() => {
    if (user.platform_role !== "MORAX_ADMIN") return;
    morax
      .platformOrganizations({
        q: deferredSearch.trim(),
        status: filters.status,
      })
      .then(setRows)
      .catch((err) => setError(message(err)));
  }, [deferredSearch, filters.status, user.platform_role]);
  if (user.platform_role !== "MORAX_ADMIN")
    return <Panel>Platform administrator permission is required.</Panel>;
  const edit = (row: Row) => {
    setEditing(String(row.id));
    setForm({ ...blank, ...objectToForm(row) });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (editing)
        await morax.updatePlatformOrganization(editing, payload(form));
      else await morax.createPlatformOrganization(payload(form));
      setError("Success: Organization saved");
      setEditing("");
      setForm(blank);
      load();
    } catch (err) {
      setError(message(err));
    }
  };
  return (
    <>
      <Header title="Organizations">
        <button
          className="secondary"
          onClick={() => {
            setEditing("");
            setForm(blank);
          }}
        >
          Create organization
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <div className="form-grid compact">
          <label>
            Search
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Name, legal name, or code"
            />
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All statuses</option>
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          {(filters.q || filters.status) && (
            <button
              type="button"
              className="secondary"
              onClick={() => setFilters({ q: "", status: "" })}
            >
              Clear filters
            </button>
          )}
        </div>
      </Panel>
      <Panel>
        <h2>{editing ? "Edit organization" : "Create organization"}</h2>
        <form className="form-grid" onSubmit={save}>
          <label>
            Organization name
            <input
              value={form.organization_name}
              onChange={(e) =>
                setForm({ ...form, organization_name: e.target.value })
              }
              required
            />
          </label>
          <label>
            Organization code
            <input
              value={form.organization_code}
              onChange={(e) =>
                setForm({ ...form, organization_code: e.target.value })
              }
              required
            />
          </label>
          <label>
            Legal name
            <input
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </label>
          <label>
            Registration / CIN
            <input
              value={form.registration_number}
              onChange={(e) =>
                setForm({ ...form, registration_number: e.target.value })
              }
            />
          </label>
          <label>
            PAN
            <input
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
            />
          </label>
          <label>
            GSTIN
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            />
          </label>
          <label>
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label>
            Pincode
            <input
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            />
          </label>
          <label>
            Compliance start
            <input
              type="date"
              value={form.compliance_start_date}
              onChange={(e) =>
                setForm({ ...form, compliance_start_date: e.target.value })
              }
            />
          </label>
          <label>
            Primary contact
            <input
              value={form.primary_contact_name}
              onChange={(e) =>
                setForm({ ...form, primary_contact_name: e.target.value })
              }
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={form.primary_contact_email}
              onChange={(e) =>
                setForm({ ...form, primary_contact_email: e.target.value })
              }
            />
          </label>
          <label>
            Contact phone
            <input
              value={form.primary_contact_phone}
              onChange={(e) =>
                setForm({ ...form, primary_contact_phone: e.target.value })
              }
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          <label className="wide">
            Registered address
            <textarea
              value={form.registered_address}
              onChange={(e) =>
                setForm({ ...form, registered_address: e.target.value })
              }
            />
          </label>
          <button>
            {editing ? "Save organization" : "Create organization"}
          </button>
        </form>
      </Panel>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Code</th>
              <th>Status</th>
              <th>Contact</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>
                  <b>{String(row.organization_name)}</b>
                  <br />
                  <small>{String(row.legal_name ?? "")}</small>
                </td>
                <td>{String(row.organization_code)}</td>
                <td>
                  <Badge text={String(row.status)} />
                </td>
                <td>{String(row.primary_contact_email ?? "—")}</td>
                <td>
                  <div className="action-row">
                    <button className="secondary" onClick={() => edit(row)}>
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const result = await morax.enterPlatformOrganization(
                            String(row.id),
                          );
                          navigate(
                            `/app/organizations/${String(row.id)}/dashboard`,
                          );
                        } catch (err) {
                          setError(message(err));
                        }
                      }}
                    >
                      Manage
                    </button>
                    <button
                      className={
                        row.status === "ACTIVE" ? "danger" : "secondary"
                      }
                      onClick={async () => {
                        try {
                          await morax.setPlatformOrganizationStatus(
                            String(row.id),
                            row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          );
                          load();
                        } catch (err) {
                          setError(message(err));
                        }
                      }}
                    >
                      {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlatformShell({
  user,
  logout,
  endImpersonation,
  children,
}: {
  user: User;
  logout: () => void;
  endImpersonation: () => Promise<void>;
  children: ReactNode;
}) {
  const { organizationId } = useParams();
  const prefix = organizationId
    ? "/app/organizations/" + organizationId
    : "/app";
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <img
            src="https://www.morainsights.com/images/logo.png"
            alt="MORAX"
            style={{
              background: "#fff",
              borderRadius: "0.35rem",
              display: "block",
              maxWidth: "160px",
              padding: "0.35rem",
            }}
          />
        </div>
        <p className="tenant">
          {user.name}
          <br />
          <small>
            {user.platform_role || user.roles.join(", ") || "No role"}
          </small>
          {organizationId && (
            <>
              <br />
              <small>Organization context</small>
            </>
          )}
        </p>
        <nav aria-label="Workspace navigation">
          {user.platform_role === "MORAX_ADMIN" && (
            <WorkspaceNavLink label="Organizations" to="/app/organizations" />
          )}
          {workspaceLinks(user).map(([label, path]) => (
            <WorkspaceNavLink
              key={path}
              label={label}
              to={prefix + "/" + path}
            />
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="content">
        <header className="app-topbar">
          <span className="topbar-context">
            {organizationId
              ? "Organization workspace"
              : "Platform administration"}
          </span>
          <div className="topbar-actions">
            <Link
              className="topbar-icon-link"
              to={prefix + "/notifications"}
              aria-label="Notifications"
            >
              <Bell size={18} />
            </Link>
            <Link className="topbar-user" to={prefix + "/settings"}>
              <span className="avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <b>{user.name}</b>
                <small>
                  {user.platform_role || user.roles[0] || "Workspace user"}
                </small>
              </span>
            </Link>
          </div>
        </header>
        <ImpersonationBanner user={user} endImpersonation={endImpersonation} />
        {children}
      </main>
    </div>
  );
}

function OrganizationLanding({ user }: { user: User }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "" });
  const deferredSearch = useDeferredValue(filters.q);
  const blank = {
    organization_name: "",
    organization_code: "",
    legal_name: "",
    registration_number: "",
    pan: "",
    gstin: "",
    registered_address: "",
    city: "",
    pincode: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
    compliance_start_date: today(),
    status: "ACTIVE",
  };
  const [form, setForm] = useState(blank);
  const load = () =>
    morax
      .platformOrganizations(filters)
      .then(setRows)
      .catch((err) => setError(message(err)));

  useEffect(() => {
    if (user.platform_role !== "MORAX_ADMIN") return;
    morax
      .platformOrganizations({
        q: deferredSearch.trim(),
        status: filters.status,
      })
      .then(setRows)
      .catch((err) => setError(message(err)));
  }, [deferredSearch, filters.status, user.platform_role]);
  if (user.platform_role !== "MORAX_ADMIN")
    return <Panel>Platform administrator permission is required.</Panel>;

  const closeForm = () => {
    setShowForm(false);
    setEditing("");
    setForm(blank);
  };
  const edit = (row: Row) => {
    setEditing(String(row.id));
    setForm({ ...blank, ...objectToForm(row) });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const enter = async (id: string) => {
    try {
      await morax.enterPlatformOrganization(id);
      navigate(`/app/organizations/${id}/dashboard`);
    } catch (err) {
      setError(message(err));
    }
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      if (editing)
        await morax.updatePlatformOrganization(editing, payload(form));
      else await morax.createPlatformOrganization(payload(form));
      setError("Success: Organization saved");
      closeForm();
      load();
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <div className="platform-page">
      <Header title="Organizations">
        <div className="action-row">
          <button
            className="secondary"
            onClick={() => navigate("/app/dashboard")}
          >
            Back to workspace
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditing("");
              setForm(blank);
            }}
          >
            Create organization
          </button>
        </div>
      </Header>
      <ErrorBox text={error} />
      {showForm && (
        <Panel>
          <div className="split">
            <div>
              <h2>{editing ? "Edit organization" : "Create organization"}</h2>
              <p className="muted">
                Create a separate tenant workspace. Organization code cannot be
                changed to a duplicate value.
              </p>
            </div>
            <button className="secondary" onClick={closeForm}>
              Cancel
            </button>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label>
              Organization name
              <input
                value={form.organization_name}
                onChange={(e) =>
                  setForm({ ...form, organization_name: e.target.value })
                }
                required
              />
            </label>
            <label>
              Organization code
              <input
                value={form.organization_code}
                onChange={(e) =>
                  setForm({ ...form, organization_code: e.target.value })
                }
                required
              />
            </label>
            <label>
              Legal name
              <input
                value={form.legal_name}
                onChange={(e) =>
                  setForm({ ...form, legal_name: e.target.value })
                }
              />
            </label>
            <label>
              Registration / CIN
              <input
                value={form.registration_number}
                onChange={(e) =>
                  setForm({ ...form, registration_number: e.target.value })
                }
              />
            </label>
            <label>
              PAN
              <input
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value })}
              />
            </label>
            <label>
              GSTIN
              <input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              />
            </label>
            <label>
              City
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
            <label>
              Pincode
              <input
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </label>
            <label>
              Compliance start
              <input
                type="date"
                value={form.compliance_start_date}
                onChange={(e) =>
                  setForm({ ...form, compliance_start_date: e.target.value })
                }
              />
            </label>
            <label>
              Primary contact
              <input
                value={form.primary_contact_name}
                onChange={(e) =>
                  setForm({ ...form, primary_contact_name: e.target.value })
                }
              />
            </label>
            <label>
              Contact email
              <input
                type="email"
                value={form.primary_contact_email}
                onChange={(e) =>
                  setForm({ ...form, primary_contact_email: e.target.value })
                }
              />
            </label>
            <label>
              Contact phone
              <input
                value={form.primary_contact_phone}
                onChange={(e) =>
                  setForm({ ...form, primary_contact_phone: e.target.value })
                }
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </label>
            <label className="wide">
              Registered address
              <textarea
                value={form.registered_address}
                onChange={(e) =>
                  setForm({ ...form, registered_address: e.target.value })
                }
              />
            </label>
            <div className="action-row">
              <button>
                {editing ? "Save changes" : "Create organization"}
              </button>
              <button type="button" className="secondary" onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}
      <Panel>
        <div className="form-grid compact">
          <label>
            Search
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Name, legal name, or code"
            />
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All statuses</option>
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          {(filters.q || filters.status) && (
            <div className="action-row">
              <button
                type="button"
                className="secondary"
                onClick={() => setFilters({ q: "", status: "" })}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </Panel>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Code</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>
                  <b>{String(row.organization_name)}</b>
                  <br />
                  <small>{String(row.legal_name ?? "")}</small>
                </td>
                <td>{String(row.organization_code)}</td>
                <td>
                  <Badge text={String(row.status)} />
                </td>
                <td>{String(row.primary_contact_email ?? "—")}</td>
                <td>
                  <div className="action-row">
                    <button className="secondary" onClick={() => edit(row)}>
                      View / Edit
                    </button>
                    <button onClick={() => enter(String(row.id))}>
                      Manage
                    </button>
                    <button
                      className={
                        row.status === "ACTIVE" ? "danger" : "secondary"
                      }
                      onClick={async () => {
                        try {
                          await morax.setPlatformOrganizationStatus(
                            String(row.id),
                            row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          );
                          load();
                        } catch (err) {
                          setError(message(err));
                        }
                      }}
                    >
                      {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dashboard() {
  const { organizationId } = useParams();
  const base = organizationId ? `/app/organizations/${organizationId}` : "/app";
  const [data, setData] = useState<{
    total: number;
    statuses: Record<string, number>;
    overdue: number;
    completed_late: number;
  }>();
  const [error, setError] = useState("");
  const load = () =>
    morax
      .dashboard()
      .then(setData)
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  const metrics = data
    ? [
        ["Total", data.total],
        ["Pending", data.statuses.PENDING ?? 0],
        ["In progress", data.statuses.IN_PROGRESS ?? 0],
        ["Under review", data.statuses.UNDER_REVIEW ?? 0],
        ["Overdue", data.overdue],
        ["Completed late", data.completed_late],
      ]
    : [];
  return (
    <>
      <Header title="Compliance dashboard">
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </Header>
      <ErrorBox text={error} />
      <div className="metric-grid">
        {metrics.map(([label, value]) => (
          <div className="metric" key={String(label)}>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Panel>
        <h2>Operational control centre</h2>
        <p className="muted">
          Configure Master data, generate obligations, assign a Maker and
          Checker, then track submission through approval.
        </p>
        <div className="quick">
          <Link to={`${base}/compliances/recurring`}>View worklist</Link>
          <Link to={`${base}/compliance-master`}>Manage rules</Link>
          <Link to={`${base}/notifications`}>Open notifications</Link>
        </div>
      </Panel>
    </>
  );
}

function Worklist() {
  const { kind, organizationId } = useParams();
  const base = organizationId ? `/app/organizations/${organizationId}` : "/app";
  const [items, setItems] = useState<Instance[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    risk_level: "",
    entity_type: "",
  });
  const frequency = kind === "recurring" ? "MONTHLY" : "ONE_TIME";
  const load = () =>
    morax
      .instances({ ...filters, frequency })
      .then((r) => setItems(r.items))
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, [kind]);
  return (
    <>
      <Header
        title={
          kind === "one-time" ? "One-time compliance" : "Recurring compliance"
        }
      >
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <form
          className="form-grid compact"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label>
            Search
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Rule or entity"
            />
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All</option>
              {[
                "PENDING",
                "IN_PROGRESS",
                "SUBMITTED",
                "UNDER_REVIEW",
                "APPROVED",
                "CORRECTION_REQUIRED",
                "REJECTED",
                "NOT_APPLICABLE",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Risk
            <select
              value={filters.risk_level}
              onChange={(e) =>
                setFilters({ ...filters, risk_level: e.target.value })
              }
            >
              <option value="">All</option>
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
          </label>
          <label>
            Entity
            <select
              value={filters.entity_type}
              onChange={(e) =>
                setFilters({ ...filters, entity_type: e.target.value })
              }
            >
              <option value="">All</option>
              <option>UNIT</option>
              <option>CONTRACTOR</option>
              <option>CONTRACTOR_SITE</option>
            </select>
          </label>
          <button>Apply filters</button>
        </form>
      </Panel>
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Compliance</th>
                <th>Entity</th>
                <th>Due date</th>
                <th>Risk</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <b>{i.compliance_id}</b>
                    <br />
                    <small>{i.compliance_name}</small>
                  </td>
                  <td>{i.subject_name}</td>
                  <td className={i.is_overdue ? "danger-text" : ""}>
                    {i.due_date}
                    {i.is_overdue ? ` · ${i.days_overdue}d late` : ""}
                  </td>
                  <td>{i.risk_level}</td>
                  <td>
                    <Badge text={i.display_status ?? i.status} />
                  </td>
                  <td>
                    <Link to={`${base}/compliances/detail/${i.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Panel>No compliance instances match this worklist.</Panel>
      )}
    </>
  );
}

function Detail({ user }: { user: User }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Instance>();
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("SUPPORTING_DOCUMENT");
  const [verifyReason, setVerifyReason] = useState("");
  const [assignment, setAssignment] = useState({ maker: "", checker: "" });
  const [form, setForm] = useState({
    filing_reference: "",
    completed_on: "",
    amount: "",
    remarks: "",
  });
  const load = () =>
    morax
      .instance(id)
      .then((r) => {
        setItem(r);
        setForm({
          filing_reference: r.activity_reference ?? "",
          completed_on: r.completed_on ?? "",
          amount: r.amount?.toString() ?? "",
          remarks: r.remarks ?? "",
        });
        const active = r.assignments ?? [];
        setAssignment({
          maker:
            active.find((a) => a.assignment_type === "MAKER")?.user_id ?? "",
          checker:
            active.find((a) => a.assignment_type === "CHECKER")?.user_id ?? "",
        });
      })
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
    morax
      .users()
      .then(setPeople)
      .catch(() => undefined);
  }, [id]);
  async function act(call: () => Promise<unknown>, success?: string) {
    try {
      await call();
      if (success) setError(`Success: ${success}`);
      await load();
    } catch (err) {
      setError(message(err, "Action failed"));
    }
  }
  if (!item) return <Panel>Loading compliance detail…</Panel>;
  const editable = ![
    "APPROVED",
    "SUBMITTED",
    "UNDER_REVIEW",
    "NOT_APPLICABLE",
  ].includes(item.status);
  const manager = canManage(user);
  const checker = canCheck(user);
  const activeAssignments = item.assignments ?? [];
  const assignedName = (type: "MAKER" | "CHECKER") =>
    people.find(
      (p) =>
        p.id ===
        activeAssignments.find((a) => a.assignment_type === type)?.user_id,
    )?.name ?? "Not assigned";
  return (
    <>
      <Header title={item.compliance_name}>
        <button className="secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </Header>
      <ErrorBox text={error} />
      <div className="detail-grid">
        <Panel>
          <div className="split">
            <div>
              <p className="eyebrow">{item.compliance_id}</p>
              <h2>{item.subject_name}</h2>
            </div>
            <Badge text={item.display_status ?? item.status} />
          </div>
          <dl>
            <dt>Frequency</dt>
            <dd>{item.frequency}</dd>
            <dt>Due date</dt>
            <dd>{item.due_date}</dd>
            <dt>Required evidence</dt>
            <dd>{item.required_document ?? "None"}</dd>
            <dt>Rule version</dt>
            <dd>{String(item.rule_snapshot?.version ?? "—")}</dd>
          </dl>
        </Panel>
        <Panel>
          <h2>Applicability</h2>
          {Object.entries(item.applicability?.matched ?? {}).map(
            ([name, matched]) => (
              <p key={name}>
                {matched ? "✓" : "×"} {name.replaceAll("_", " ")}
              </p>
            ),
          )}
        </Panel>
      </div>
      {manager && (
        <Panel>
          <h2>Assignments</h2>
          <p className="muted">
            Assign one active Maker and one active Checker. Reassigning replaces
            the existing assignment and is audited.
          </p>
          <div className="form-grid compact">
            <label>
              Maker
              <select
                value={assignment.maker}
                onChange={(e) =>
                  setAssignment({ ...assignment, maker: e.target.value })
                }
              >
                <option value="">Select Maker</option>
                {people
                  .filter((p) =>
                    p.roles.some(
                      (role) =>
                        role.includes("MAKER") ||
                        role.endsWith("_ADMIN") ||
                        ["MORAX_ADMIN", "SUPER_ADMIN"].includes(role),
                    ),
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} — {p.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Checker
              <select
                value={assignment.checker}
                onChange={(e) =>
                  setAssignment({ ...assignment, checker: e.target.value })
                }
              >
                <option value="">Select Checker</option>
                {people
                  .filter((p) =>
                    p.roles.some(
                      (role) =>
                        role.includes("CHECKER") ||
                        role.endsWith("_ADMIN") ||
                        ["MORAX_ADMIN", "SUPER_ADMIN"].includes(role),
                    ),
                  )
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name} — {p.email}
                    </option>
                  ))}
              </select>
            </label>
            <div className="action-row">
              <button
                disabled={!assignment.maker}
                onClick={() =>
                  act(
                    () =>
                      morax.assign(id, {
                        user_id: assignment.maker,
                        assignment_type: "MAKER",
                      }),
                    "Maker assigned",
                  )
                }
              >
                Save Maker
              </button>
              <button
                disabled={!assignment.checker}
                onClick={() =>
                  act(
                    () =>
                      morax.assign(id, {
                        user_id: assignment.checker,
                        assignment_type: "CHECKER",
                      }),
                    "Checker assigned",
                  )
                }
              >
                Save Checker
              </button>
            </div>
          </div>
          <p className="muted">
            Current: Maker — {assignedName("MAKER")} · Checker —{" "}
            {assignedName("CHECKER")}
          </p>
        </Panel>
      )}
      <Panel>
        <h2>Maker activity</h2>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              () =>
                morax.activity(id, {
                  ...form,
                  amount: form.amount ? Number(form.amount) : null,
                  completed_on: form.completed_on || null,
                  row_version: item.row_version,
                }),
              "Draft saved",
            );
          }}
        >
          <label>
            Filing reference
            <input
              value={form.filing_reference}
              disabled={!editable}
              onChange={(e) =>
                setForm({ ...form, filing_reference: e.target.value })
              }
            />
          </label>
          <label>
            Completed on
            <input
              type="date"
              value={form.completed_on}
              disabled={!editable}
              onChange={(e) =>
                setForm({ ...form, completed_on: e.target.value })
              }
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              value={form.amount}
              disabled={!editable}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label className="wide">
            Remarks
            <textarea
              value={form.remarks}
              disabled={!editable}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </label>
          <button disabled={!editable}>Save draft</button>
        </form>
      </Panel>
      <div className="detail-grid">
        <Panel>
          <h2>Evidence</h2>
          <div className="form-grid compact">
            <label>
              Category
              <input
                value={category}
                disabled={!editable}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label>
              File
              <input
                type="file"
                disabled={!editable}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              className="secondary"
              disabled={!file || !editable}
              onClick={() =>
                file &&
                act(
                  () => morax.evidence(id, file, category),
                  "Evidence uploaded",
                )
              }
            >
              Upload evidence
            </button>
          </div>
          {item.evidence?.length ? (
            item.evidence.map((e) => (
              <EvidenceRow
                key={e.id}
                evidence={e}
                checker={checker}
                reason={verifyReason}
                setReason={setVerifyReason}
                reload={load}
                report={setError}
              />
            ))
          ) : (
            <p className="muted">No evidence uploaded.</p>
          )}
        </Panel>
        <Panel>
          <h2>Workflow</h2>
          <textarea
            placeholder="Decision comment (required for decisions)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="action-row">
            {editable && (
              <button
                onClick={() =>
                  act(() => morax.submit(id), "Submitted for review")
                }
              >
                Submit for review
              </button>
            )}
            {item.status === "SUBMITTED" && checker && (
              <button
                onClick={() =>
                  act(
                    () =>
                      morax.review(id, {
                        comment: note || "Review started",
                        row_version: item.row_version,
                      }),
                    "Review started",
                  )
                }
              >
                Begin review
              </button>
            )}
            {item.status === "UNDER_REVIEW" && checker && (
              <>
                <button
                  onClick={() =>
                    act(
                      () =>
                        morax.approve(id, {
                          comment: note || "Approved",
                          row_version: item.row_version,
                        }),
                      "Approved",
                    )
                  }
                >
                  Approve
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    act(
                      () =>
                        morax.correction(id, {
                          comment: note || "Correction required",
                          row_version: item.row_version,
                        }),
                      "Returned for correction",
                    )
                  }
                >
                  Request correction
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    act(
                      () =>
                        morax.reject(id, {
                          comment: note || "Rejected",
                          row_version: item.row_version,
                        }),
                      "Rejected",
                    )
                  }
                >
                  Reject
                </button>
              </>
            )}
            {manager && editable && (
              <button
                className="danger"
                onClick={() =>
                  note.trim()
                    ? act(
                        () => morax.notApplicable(id, note.trim()),
                        "Marked not applicable",
                      )
                    : setError("Enter a reason before marking not applicable")
                }
              >
                Not applicable
              </button>
            )}
          </div>
          <p className="muted">
            Required evidence must be verified by the assigned Checker before
            approval.
          </p>
        </Panel>
      </div>
      <Panel>
        <h2>Comments</h2>
        <div className="form-grid compact">
          <label className="wide">
            Add comment
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button
            disabled={!comment.trim()}
            onClick={() =>
              act(async () => {
                await morax.comment(id, comment.trim());
                setComment("");
              }, "Comment added")
            }
          >
            Post comment
          </button>
        </div>
        {item.comments?.map((c) => (
          <p className="timeline" key={c.id}>
            <b>{people.find((p) => p.id === c.author_id)?.name ?? "User"}</b>
            <br />
            {c.body}
            <br />
            <small>{c.created_at}</small>
          </p>
        ))}
      </Panel>
      <Panel>
        <h2>History</h2>
        {item.history?.map((h) => (
          <p className="timeline" key={h.id}>
            <b>{h.action.replaceAll("_", " ")}</b>{" "}
            {h.to_status ? `→ ${h.to_status}` : ""}
            <br />
            <small>
              {h.created_at} {h.comment ? `— ${h.comment}` : ""}
            </small>
          </p>
        ))}
      </Panel>
    </>
  );
}

function EvidenceRow({
  evidence,
  checker,
  reason,
  setReason,
  reload,
  report,
}: {
  evidence: Evidence;
  checker: boolean;
  reason: string;
  setReason: (value: string) => void;
  reload: () => void;
  report: (value: string) => void;
}) {
  const act = async (state: "VERIFIED" | "REJECTED") => {
    if (state === "REJECTED" && !reason.trim()) {
      report("Enter a rejection reason before rejecting evidence");
      return;
    }
    try {
      await morax.verifyDocument(
        evidence.id,
        state,
        reason.trim() || undefined,
      );
      setReason("");
      await reload();
    } catch (err) {
      report(message(err));
    }
  };
  return (
    <div className="file-row">
      <b>{evidence.original_filename}</b>{" "}
      <small>
        v{evidence.version} · {evidence.category} ·{" "}
        {evidence.verification_state ?? "PENDING"}
      </small>
      <div className="action-row">
        <button
          className="secondary"
          onClick={() =>
            morax
              .downloadDocument(evidence.id, evidence.original_filename)
              .catch((err) => report(message(err)))
          }
        >
          Download
        </button>
        {checker && evidence.verification_state !== "VERIFIED" && (
          <>
            <input
              aria-label="Evidence rejection reason"
              placeholder="Rejection reason (only if rejecting)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button onClick={() => act("VERIFIED")}>Verify</button>
            <button className="danger" onClick={() => act("REJECTED")}>
              Reject evidence
            </button>
          </>
        )}
      </div>
      {evidence.verification_reason && (
        <small>Reason: {evidence.verification_reason}</small>
      )}
    </div>
  );
}

function Entities({ user }: { user: User }) {
  const { kind = "units" } = useParams();
  const [states, setStates] = useState<Master[]>([]);
  const [industries, setIndustries] = useState<Master[]>([]);
  const [units, setUnits] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const initial = {
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
    compliance_start_date: today(),
    status: "ACTIVE",
  };
  const [form, setForm] = useState(initial);
  const isUnit = kind === "units";
  const isSite = kind === "sites";
  const title = isUnit
    ? "Units / branches"
    : isSite
      ? "Contractor sites"
      : "Contractors";
  const otherIndustryId = industries.find(
    (industry) => industry.code.toUpperCase() === "OTHER",
  )?.id;
  const isOtherIndustry = form.industry_type_id === otherIndustryId;
  const load = () =>
    Promise.all([
      morax.states(),
      morax.industries(),
      morax.units(),
      morax.contractors(),
      morax.sites(),
    ])
      .then(([s, i, u, c, sites]) => {
        setStates(s);
        setIndustries(i);
        setUnits(u.items);
        setContractors(c);
        setRows(isUnit ? u.items : isSite ? sites : c);
      })
      .catch((err) => setError(message(err)));
  useEffect(() => {
    setSelected("");
    setForm(initial);
    load();
  }, [kind]);
  const choose = (value: string) => {
    setSelected(value);
    const row = rows.find((r) => String(r.id) === value);
    if (row) setForm({ ...initial, ...objectToForm(row) });
  };
  const remove = async (row: Row) => {
    if (!canManageEntity(user)) {
      setError("Organization administrator permission is required");
      return;
    }
    if (!window.confirm(`Delete ${String(row.name ?? "this record")}?`)) return;
    try {
      if (isUnit) await morax.deleteUnit(String(row.id));
      else if (isSite) await morax.deleteSite(String(row.id));
      else await morax.deleteContractor(String(row.id));
      setSelected("");
      setForm(initial);
      setError("Success: Entity deleted");
      load();
    } catch (err) {
      setError(message(err, "Could not delete entity"));
    }
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canManageEntity(user)) {
      setError("Organization administrator permission is required");
      return;
    }
    try {
      const body = payload(
        form,
        isUnit
          ? ["male_employees", "female_employees"]
          : ["male_workers", "female_workers"],
      );
      if (isUnit)
        selected
          ? await morax.updateUnit(selected, body)
          : await morax.createUnit(body);
      else if (isSite)
        selected
          ? await morax.updateSite(selected, body)
          : await morax.createSite(body);
      else
        selected
          ? await morax.updateContractor(selected, body)
          : await morax.createContractor(body);
      setError(`Success: ${selected ? "Entity updated" : "Entity created"}`);
      setSelected("");
      setForm(initial);
      load();
    } catch (err) {
      setError(message(err, "Could not save entity"));
    }
  }
  return (
    <>
      <Header title={title}>
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <h2>
          {selected
            ? `Edit ${subjectLabel(isUnit ? "UNIT" : isSite ? "CONTRACTOR_SITE" : "CONTRACTOR")}`
            : `Add ${subjectLabel(isUnit ? "UNIT" : isSite ? "CONTRACTOR_SITE" : "CONTRACTOR")}`}
        </h2>
        {canManageEntity(user) && (
          <label>
            Existing record
            <select value={selected} onChange={(e) => choose(e.target.value)}>
              <option value="">New record</option>
              {rows.map((r) => (
                <option value={String(r.id)} key={String(r.id)}>
                  {String(r.name)} — {String(r.code)}
                </option>
              ))}
            </select>
          </label>
        )}
        <form className="form-grid" onSubmit={save}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Code
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </label>
          {isUnit && (
            <label>
              Unit type
              <input
                value={form.unit_type}
                onChange={(e) =>
                  setForm({ ...form, unit_type: e.target.value })
                }
              />
            </label>
          )}
          {!isUnit && (
            <label>
              Parent Unit
              <select
                value={form.unit_id}
                onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              >
                <option value="">Not linked</option>
                {units.map((r) => (
                  <option value={String(r.id)} key={String(r.id)}>
                    {String(r.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isUnit && !isSite && (
            <label>
              Contractor type
              <input
                value={form.contractor_type}
                onChange={(e) =>
                  setForm({ ...form, contractor_type: e.target.value })
                }
              />
            </label>
          )}
          {isSite && (
            <label>
              Contractor
              <select
                value={form.contractor_id}
                onChange={(e) =>
                  setForm({ ...form, contractor_id: e.target.value })
                }
                required
              >
                <option value="">Select contractor</option>
                {contractors.map((r) => (
                  <option value={String(r.id)} key={String(r.id)}>
                    {String(r.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            State
            <select
              value={form.state_id}
              onChange={(e) => setForm({ ...form, state_id: e.target.value })}
              required={isUnit || isSite}
            >
              <option value="">Not configured</option>
              {states.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Industry type
            <select
              value={form.industry_type_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  industry_type_id: e.target.value,
                  other_industry_name:
                    e.target.value === otherIndustryId
                      ? form.other_industry_name
                      : "",
                })
              }
              required={isUnit || isSite}
            >
              <option value="">Not configured</option>
              {industries.map((i) => (
                <option value={i.id} key={i.id}>
                  {i.code.toUpperCase() === "OTHER" ? "Other industry" : i.name}
                </option>
              ))}
            </select>
          </label>
          {isOtherIndustry && (
            <label>
              Other industry name
              <input
                value={form.other_industry_name}
                onChange={(e) =>
                  setForm({ ...form, other_industry_name: e.target.value })
                }
                placeholder="Enter industry name"
                required
              />
            </label>
          )}
          <label>
            Compliance start
            <input
              type="date"
              value={form.compliance_start_date}
              onChange={(e) =>
                setForm({ ...form, compliance_start_date: e.target.value })
              }
              required={isUnit || isSite}
            />
          </label>
          <label>
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label>
            Pincode
            <input
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            />
          </label>
          <label>
            GSTIN
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
            />
          </label>
          <label>
            PAN
            <input
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
            />
          </label>
          <label>
            LIN
            <input
              value={form.lin}
              onChange={(e) => setForm({ ...form, lin: e.target.value })}
            />
          </label>
          <label>
            Male {isUnit ? "employees" : "workers"}
            <input
              type="number"
              min="0"
              value={isUnit ? form.male_employees : form.male_workers}
              onChange={(e) =>
                setForm({
                  ...form,
                  [isUnit ? "male_employees" : "male_workers"]: e.target.value,
                })
              }
            />
          </label>
          <label>
            Female {isUnit ? "employees" : "workers"}
            <input
              type="number"
              min="0"
              value={isUnit ? form.female_employees : form.female_workers}
              onChange={(e) =>
                setForm({
                  ...form,
                  [isUnit ? "female_employees" : "female_workers"]:
                    e.target.value,
                })
              }
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          <label className="wide">
            Address
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="wide">
            Registration identifiers
            <textarea
              value={form.registration_identifiers}
              onChange={(e) =>
                setForm({ ...form, registration_identifiers: e.target.value })
              }
            />
          </label>
          <label className="wide">
            Applicable regulations
            <textarea
              value={form.applicable_regulations}
              onChange={(e) =>
                setForm({ ...form, applicable_regulations: e.target.value })
              }
            />
          </label>
          <button disabled={!canManageEntity(user)}>
            {selected ? "Save changes" : "Add entity"}
          </button>
        </form>
      </Panel>
      <EntityTable
        rows={rows}
        onEdit={(row) => choose(String(row.id))}
        onDelete={remove}
        canEdit={canManageEntity(user)}
      />
    </>
  );
}

function EntityTable({
  rows,
  onEdit,
  onDelete,
  canEdit,
}: {
  rows: Row[];
  onEdit: (row: Row) => void;
  onDelete?: (row: Row) => void;
  canEdit: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>State</th>
            <th>Industry</th>
            <th>Workers / employees</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td>{String(r.name)}</td>
              <td>{String(r.code)}</td>
              <td>{String(r.state_name ?? "—")}</td>
              <td>{String(r.industry_name ?? "—")}</td>
              <td>{String(r.total_employees ?? r.total_workers ?? "—")}</td>
              <td>{String(r.status)}</td>
              <td>
                <div className="action-row">
                  <button className="secondary" onClick={() => onEdit(r)}>
                    View / Edit
                  </button>
                  {canEdit && onDelete && (
                    <button className="danger" onClick={() => onDelete(r)}>
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const roles = [
  "ORGANIZATION_ADMIN",
  "UNIT_ADMIN",
  "UNIT_MAKER",
  "UNIT_CHECKER",
  "CONTRACTOR_ADMIN",
  "CONTRACTOR_MAKER",
  "CONTRACTOR_CHECKER",
  "VIEWER",
  "AUDITOR",
];
function Users({
  user,
  onImpersonate,
}: {
  user: User;
  onImpersonate: (userId: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [sites, setSites] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
  });
  const [selected, setSelected] = useState("");
  const [scopeRows, setScopeRows] = useState<RoleScope[]>([]);
  const load = () =>
    Promise.all([
      morax.users(),
      morax.units(),
      morax.contractors(),
      morax.sites(),
    ])
      .then(([rows, unitPage, contractorRows, siteRows]) => {
        setUsers(rows);
        setUnits(unitPage.items);
        setContractors(contractorRows);
        setSites(siteRows);
      })
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  const changeUser = (id: string) => {
    setSelected(id);
    const selectedUser = users.find((item) => item.id === id);
    setScopeRows(selectedUser?.scopes ?? []);
  };
  const choices = (type: string) =>
    type === "ORGANIZATION"
      ? [{ id: user.organization_id, name: "Entire organization" }]
      : type === "UNIT"
        ? units
        : type === "CONTRACTOR"
          ? contractors
          : sites;
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await morax.createUser({ ...form, mobile: form.mobile || null });
      setForm({ name: "", email: "", mobile: "", password: "" });
      setError("Success: User created");
      load();
    } catch (err) {
      setError(message(err));
    }
  }
  async function saveScopes(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      await morax.replaceScopes(selected, scopeRows);
      setError("Success: Role scopes saved");
      load();
    } catch (err) {
      setError(message(err));
    }
  }
  async function loginAs(target: User) {
    if (
      !window.confirm(
        "Start a temporary session as " +
          target.name +
          "? All actions will be audited.",
      )
    )
      return;
    try {
      await onImpersonate(target.id);
      navigate("/app/dashboard");
    } catch (err) {
      setError(message(err, "Could not start impersonation"));
    }
  }
  return (
    <>
      <Header title="Users and access" />
      <ErrorBox text={error} />
      <Panel>
        <h2>Create user</h2>
        <form className="form-grid" onSubmit={create}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              required
            />
          </label>
          <label>
            Mobile
            <input
              value={form.mobile}
              onChange={(event) =>
                setForm({ ...form, mobile: event.target.value })
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              required
              minLength={8}
            />
          </label>
          <button>Create user</button>
        </form>
      </Panel>
      <Panel>
        <h2>Role scopes</h2>
        <p className="muted">
          This screen saves the complete role-scope list for the selected user.
        </p>
        <form onSubmit={saveScopes}>
          <label>
            User
            <select
              value={selected}
              onChange={(event) => changeUser(event.target.value)}
              required
            >
              <option value="">Select user</option>
              {users.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} - {item.email}
                </option>
              ))}
            </select>
          </label>
          {scopeRows.map((scope, index) => (
            <div className="scope-row" key={index}>
              <label>
                Role
                <select
                  value={scope.role}
                  onChange={(event) =>
                    setScopeRows(
                      scopeRows.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, role: event.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>
                Scope type
                <select
                  value={scope.scope_type}
                  onChange={(event) => {
                    const type = event.target.value;
                    const first = choices(type)[0];
                    setScopeRows(
                      scopeRows.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              scope_type: type,
                              scope_id: String(first?.id ?? ""),
                            }
                          : item,
                      ),
                    );
                  }}
                >
                  <option>ORGANIZATION</option>
                  <option>UNIT</option>
                  <option>CONTRACTOR</option>
                  <option>CONTRACTOR_SITE</option>
                </select>
              </label>
              <label>
                Assigned scope
                <select
                  value={scope.scope_id}
                  onChange={(event) =>
                    setScopeRows(
                      scopeRows.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, scope_id: event.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  {choices(scope.scope_type).map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {String(row.name)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="danger"
                onClick={() =>
                  setScopeRows(
                    scopeRows.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
          <div className="action-row">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setScopeRows([
                  ...scopeRows,
                  {
                    role: "UNIT_MAKER",
                    scope_type: "UNIT",
                    scope_id: String(units[0]?.id ?? ""),
                  },
                ])
              }
            >
              Add role scope
            </button>
            <button disabled={!selected}>Save all scopes</button>
          </div>
        </form>
      </Panel>
      <Panel>
        <h2>Validate user access</h2>
        <p className="muted">
          Use Login as user to validate the selected user’s actual role and
          entity scope. This creates an audited, temporary session and never
          uses their password.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Roles</th>
                <th>Scopes</th>
                <th>Active</th>
                <th>Access validation</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.name}</b>
                    <br />
                    <small>{item.email}</small>
                  </td>
                  <td>{item.roles.join(", ") || "Not assigned"}</td>
                  <td>
                    {item.scopes
                      .map((scope) => scope.role + ": " + scope.scope_type)
                      .join(", ") || "-"}
                  </td>
                  <td>{item.active === false ? "No" : "Yes"}</td>
                  <td>
                    <button
                      className="secondary"
                      disabled={
                        item.active === false ||
                        item.id === user.id ||
                        Boolean(item.platform_role)
                      }
                      onClick={() => loginAs(item)}
                    >
                      Login as user
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function ComplianceMaster() {
  const [rules, setRules] = useState<Row[]>([]);
  const [states, setStates] = useState<Master[]>([]);
  const [industries, setIndustries] = useState<Master[]>([]);
  const [units, setUnits] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [sites, setSites] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    rows?: {
      row_number: number;
      valid: boolean;
      errors: { field: string; message: string }[];
    }[];
  }>();
  const [generation, setGeneration] = useState({
    subject_type: "",
    subject_id: "",
    as_of_date: today(),
  });
  const [form, setForm] = useState({
    compliance_id: "",
    name: "",
    description: "",
    act: "",
    rule_reference: "",
    section: "",
    compliance_type: "",
    document_type: "",
    form_number: "",
    legal_description: "",
    consequence_or_penalty: "",
    version: "1",
    entity_type: "UNIT",
    state_id: "",
    industry_type_id: "",
    frequency: "MONTHLY",
    due_date_rule: "FIXED_DAY_OF_MONTH",
    due_date_offset: "15",
    due_date_anchor: "",
    grace_days: "0",
    required_document: "",
    risk_level: "MEDIUM",
    effective_from: today(),
    effective_to: "",
    active: "true",
  });
  const load = () =>
    Promise.all([
      morax.rules(),
      morax.states(),
      morax.industries(),
      morax.units(),
      morax.contractors(),
      morax.sites(),
    ])
      .then(([r, s, i, u, c, siteRows]) => {
        setRules(r);
        setStates(s);
        setIndustries(i);
        setUnits(u.items);
        setContractors(c);
        setSites(siteRows);
      })
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  const generationChoices =
    generation.subject_type === "UNIT"
      ? units
      : generation.subject_type === "CONTRACTOR"
        ? contractors
        : sites;
  return (
    <>
      <Header title="Compliance Master">
        <button
          className="secondary"
          onClick={() =>
            morax.downloadRuleTemplate().catch((err) => setError(message(err)))
          }
        >
          Download Excel template
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <h2>Generate obligations</h2>
        <form
          className="form-grid compact"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await morax.generate({
                subject_type: generation.subject_type || undefined,
                subject_id: generation.subject_id || undefined,
                as_of_date: generation.as_of_date || undefined,
              });
              setError(
                `Success: Generation completed — ${r.created} new obligation(s)`,
              );
            } catch (err) {
              setError(message(err));
            }
          }}
        >
          <label>
            Subject type
            <select
              value={generation.subject_type}
              onChange={(e) =>
                setGeneration({
                  ...generation,
                  subject_type: e.target.value,
                  subject_id: "",
                })
              }
            >
              <option value="">All accessible subjects</option>
              <option>UNIT</option>
              <option>CONTRACTOR</option>
              <option>CONTRACTOR_SITE</option>
            </select>
          </label>
          <label>
            Subject
            <select
              value={generation.subject_id}
              disabled={!generation.subject_type}
              onChange={(e) =>
                setGeneration({ ...generation, subject_id: e.target.value })
              }
            >
              <option value="">All of selected type</option>
              {generationChoices.map((r) => (
                <option value={String(r.id)} key={String(r.id)}>
                  {String(r.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            As-of date
            <input
              type="date"
              value={generation.as_of_date}
              onChange={(e) =>
                setGeneration({ ...generation, as_of_date: e.target.value })
              }
            />
          </label>
          <button>Run generation</button>
        </form>
      </Panel>
      <Panel>
        <h2>Excel import</h2>
        <p className="muted">
          Validate the workbook, inspect the rows, then explicitly confirm its
          import.
        </p>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
        />{" "}
        <button
          className="secondary"
          disabled={!importFile}
          onClick={async () => {
            try {
              const result = await morax.validateImport(importFile!);
              const detail = await morax.previewImport(result.id);
              setPreview({ ...result, rows: detail.rows });
            } catch (err) {
              setError(message(err, "Validation failed"));
            }
          }}
        >
          Validate workbook
        </button>
        {preview && (
          <div className="import-preview">
            <p className="alert success">
              {preview.valid_rows} valid of {preview.total_rows};{" "}
              {preview.error_rows} error rows.
            </p>
            {preview.rows
              ?.filter((row) => !row.valid)
              .map((row) => (
                <p className="alert error" key={row.row_number}>
                  Row {row.row_number}:{" "}
                  {row.errors
                    .map((e) => `${e.field} — ${e.message}`)
                    .join("; ")}
                </p>
              ))}
            <button
              onClick={async () => {
                try {
                  await morax.confirmImport(preview.id);
                  setPreview(undefined);
                  setError("Success: Import confirmed");
                  load();
                } catch (err) {
                  setError(message(err, "Import failed"));
                }
              }}
              disabled={preview.error_rows > 0}
            >
              Confirm import
            </button>
          </div>
        )}
      </Panel>
      <Panel>
        <h2>Add rule version</h2>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await morax.createRule({
                ...payload(form, ["version", "due_date_offset", "grace_days"]),
                active: form.active === "true",
              });
              setError("Success: Rule version saved");
              setForm({
                ...form,
                compliance_id: "",
                name: "",
                description: "",
              });
              load();
            } catch (err) {
              setError(message(err, "Could not save rule"));
            }
          }}
        >
          <label>
            Compliance ID
            <input
              value={form.compliance_id}
              onChange={(e) =>
                setForm({ ...form, compliance_id: e.target.value })
              }
              required
            />
          </label>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Version
            <input
              type="number"
              min="1"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              required
            />
          </label>
          <label>
            Entity type
            <select
              value={form.entity_type}
              onChange={(e) =>
                setForm({ ...form, entity_type: e.target.value })
              }
            >
              <option>UNIT</option>
              <option>CONTRACTOR</option>
              <option>CONTRACTOR_SITE</option>
            </select>
          </label>
          <label>
            State
            <select
              value={form.state_id}
              onChange={(e) => setForm({ ...form, state_id: e.target.value })}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Industry
            <select
              value={form.industry_type_id}
              onChange={(e) =>
                setForm({ ...form, industry_type_id: e.target.value })
              }
            >
              <option value="">All industries</option>
              {industries.map((i) => (
                <option value={i.id} key={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frequency
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            >
              {[
                "MONTHLY",
                "QUARTERLY",
                "HALF_YEARLY",
                "ANNUAL",
                "ONE_TIME",
                "EVENT_BASED",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Due-date method
            <select
              value={form.due_date_rule}
              onChange={(e) =>
                setForm({ ...form, due_date_rule: e.target.value })
              }
            >
              {[
                "FIXED_DAY_OF_MONTH",
                "DAYS_AFTER_PERIOD_END",
                "FIXED_ANNUAL_DATE",
                "ONE_TIME_CONFIGURED_DATE",
                "MANUAL",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Due day / offset
            <input
              type="number"
              value={form.due_date_offset}
              onChange={(e) =>
                setForm({ ...form, due_date_offset: e.target.value })
              }
            />
          </label>
          <label>
            Due-date anchor
            <input
              value={form.due_date_anchor}
              onChange={(e) =>
                setForm({ ...form, due_date_anchor: e.target.value })
              }
            />
          </label>
          <label>
            Grace days
            <input
              type="number"
              min="0"
              value={form.grace_days}
              onChange={(e) => setForm({ ...form, grace_days: e.target.value })}
            />
          </label>
          <label>
            Risk
            <select
              value={form.risk_level}
              onChange={(e) => setForm({ ...form, risk_level: e.target.value })}
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
          </label>
          <label>
            Effective from
            <input
              type="date"
              value={form.effective_from}
              onChange={(e) =>
                setForm({ ...form, effective_from: e.target.value })
              }
            />
          </label>
          <label>
            Effective to
            <input
              type="date"
              value={form.effective_to}
              onChange={(e) =>
                setForm({ ...form, effective_to: e.target.value })
              }
            />
          </label>
          <label>
            Required evidence
            <input
              value={form.required_document}
              onChange={(e) =>
                setForm({ ...form, required_document: e.target.value })
              }
            />
          </label>
          <label>
            Act
            <input
              value={form.act}
              onChange={(e) => setForm({ ...form, act: e.target.value })}
            />
          </label>
          <label>
            Rule reference
            <input
              value={form.rule_reference}
              onChange={(e) =>
                setForm({ ...form, rule_reference: e.target.value })
              }
            />
          </label>
          <label>
            Section
            <input
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            />
          </label>
          <label>
            Form number
            <input
              value={form.form_number}
              onChange={(e) =>
                setForm({ ...form, form_number: e.target.value })
              }
            />
          </label>
          <label className="wide">
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="wide">
            Legal description
            <textarea
              value={form.legal_description}
              onChange={(e) =>
                setForm({ ...form, legal_description: e.target.value })
              }
            />
          </label>
          <label className="wide">
            Consequence / penalty
            <textarea
              value={form.consequence_or_penalty}
              onChange={(e) =>
                setForm({ ...form, consequence_or_penalty: e.target.value })
              }
            />
          </label>
          <button>Save rule version</button>
        </form>
      </Panel>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Compliance ID</th>
              <th>Name</th>
              <th>Version</th>
              <th>Frequency</th>
              <th>Due-date method</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.compliance_id)}</td>
                <td>{String(r.name)}</td>
                <td>{String(r.version)}</td>
                <td>{String(r.frequency)}</td>
                <td>{String(r.due_date_rule)}</td>
                <td>{String(r.active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Documents({ user }: { user: User }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", entity_type: "" });
  const load = () =>
    morax
      .documents(filters)
      .then(setRows)
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Header title="Document library">
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <form
          className="form-grid compact"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label>
            Search
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </label>
          <label>
            Entity type
            <select
              value={filters.entity_type}
              onChange={(e) =>
                setFilters({ ...filters, entity_type: e.target.value })
              }
            >
              <option value="">All</option>
              <option>UNIT</option>
              <option>CONTRACTOR</option>
              <option>CONTRACTOR_SITE</option>
            </select>
          </label>
          <button>Filter</button>
        </form>
      </Panel>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Entity</th>
              <th>Period</th>
              <th>Verification</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>
                  {String(row.original_filename)}
                  <br />
                  <small>v{String(row.version)}</small>
                </td>
                <td>{String(row.entity_type)}</td>
                <td>{String(row.period)}</td>
                <td>
                  <Badge text={String(row.verification_state ?? "PENDING")} />
                </td>
                <td>{String(row.created_at)}</td>
                <td>
                  <div className="action-row">
                    <button
                      className="secondary"
                      onClick={() =>
                        morax
                          .downloadDocument(
                            String(row.id),
                            String(row.original_filename),
                          )
                          .catch((err) => setError(message(err)))
                      }
                    >
                      Download
                    </button>
                    <Link
                      to={`/app/compliances/detail/${String(row.compliance_instance_id)}`}
                    >
                      Open workflow
                    </Link>
                    {canManage(user) && (
                      <button
                        className="danger"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete ${String(row.original_filename)}?`,
                            )
                          )
                            return;
                          try {
                            await morax.deleteDocument(String(row.id));
                            setError("Success: Document deleted");
                            load();
                          } catch (err) {
                            setError(message(err));
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Notifications() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(false);
  const load = () =>
    morax
      .notifications(unread)
      .then(setRows)
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, [unread]);
  return (
    <>
      <Header title="Notifications">
        <label className="inline">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => setUnread(e.target.checked)}
          />{" "}
          Unread only
        </label>
      </Header>
      <ErrorBox text={error} />
      {rows.length ? (
        rows.map((row) => (
          <Panel key={String(row.id)}>
            <div className="split">
              <div>
                <h2>{String(row.title)}</h2>
                <p>{String(row.body ?? "")}</p>
                <small>{String(row.created_at)}</small>
              </div>
              <div className="action-row">
                {row.reference_type === "ComplianceInstance" && (
                  <Link
                    to={`/app/compliances/detail/${String(row.reference_id)}`}
                  >
                    Open
                  </Link>
                )}
                {!row.read_at && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await morax.readNotification(String(row.id));
                        load();
                      } catch (err) {
                        setError(message(err));
                      }
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          </Panel>
        ))
      ) : (
        <Panel>No notifications.</Panel>
      )}
    </>
  );
}

function Reports() {
  const [status, setStatus] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<Record<string, number>>({});
  const [entities, setEntities] = useState<
    {
      entity: string;
      due: number;
      overdue: number;
      done: number;
      rate: number;
    }[]
  >([]);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([
      morax.statusChart(),
      morax.frequencyChart(),
      morax.entityChart(),
    ])
      .then(([s, f, e]) => {
        setStatus(s);
        setFrequency(f);
        setEntities(e);
      })
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Header title="Compliance reports">
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <h2>CSV exports</h2>
        <div className="action-row">
          <button
            onClick={() =>
              morax
                .downloadStatusReport()
                .catch((err) => setError(message(err)))
            }
          >
            Compliance status
          </button>
          <button
            onClick={() =>
              morax
                .downloadOverdueReport()
                .catch((err) => setError(message(err)))
            }
          >
            Overdue
          </button>
          <button
            onClick={() =>
              morax
                .downloadCompletionReport()
                .catch((err) => setError(message(err)))
            }
          >
            Completion
          </button>
          <button
            onClick={() =>
              morax
                .downloadEntityReport()
                .catch((err) => setError(message(err)))
            }
          >
            Entity compliance
          </button>
        </div>
      </Panel>
      <div className="detail-grid">
        <Panel>
          <h2>Status summary</h2>
          {Object.entries(status).map(([key, value]) => (
            <p key={key}>
              {key.replaceAll("_", " ")} <b>{value}</b>
            </p>
          ))}
        </Panel>
        <Panel>
          <h2>Frequency summary</h2>
          {Object.entries(frequency).map(([key, value]) => (
            <p key={key}>
              {key} <b>{value}</b>
            </p>
          ))}
        </Panel>
      </div>
      <Panel>
        <h2>Entity compliance summary</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Due</th>
                <th>Overdue</th>
                <th>Done</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((row) => (
                <tr key={row.entity}>
                  <td>{row.entity}</td>
                  <td>{row.due}</td>
                  <td>{row.overdue}</td>
                  <td>{row.done}</td>
                  <td>{row.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Audit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const load = () =>
    morax
      .audit()
      .then((r) => setRows(r.items))
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Header title="Audit trail">
        <button className="secondary" onClick={load}>
          Refresh
        </button>
      </Header>
      <ErrorBox text={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Module</th>
              <th>Entity</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.created_at)}</td>
                <td>{String(r.action)}</td>
                <td>{String(r.module)}</td>
                <td>{String(r.entity_type)}</td>
                <td>{String(r.reason ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Settings({ user }: { user: User }) {
  const [org, setOrg] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
  });
  const load = () =>
    morax
      .organization()
      .then((row) => setOrg(objectToForm(row)))
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Header title="Workspace settings" />
      <ErrorBox text={error} />
      <Panel>
        <h2>Organization profile</h2>
        <form
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await morax.updateOrganization({
                ...payload(org),
                compliance_start_date: org.compliance_start_date || null,
              });
              setError("Success: Organization updated");
              load();
            } catch (err) {
              setError(message(err));
            }
          }}
        >
          <label>
            Name
            <input
              value={org.name ?? ""}
              onChange={(e) => setOrg({ ...org, name: e.target.value })}
              required
            />
          </label>
          <label>
            Legal name
            <input
              value={org.legal_name ?? ""}
              onChange={(e) => setOrg({ ...org, legal_name: e.target.value })}
            />
          </label>
          <label>
            Code
            <input
              value={org.code ?? ""}
              onChange={(e) => setOrg({ ...org, code: e.target.value })}
              required
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={org.contact_email ?? ""}
              onChange={(e) =>
                setOrg({ ...org, contact_email: e.target.value })
              }
            />
          </label>
          <label>
            Contact phone
            <input
              value={org.contact_phone ?? ""}
              onChange={(e) =>
                setOrg({ ...org, contact_phone: e.target.value })
              }
            />
          </label>
          <label>
            Compliance start
            <input
              type="date"
              value={org.compliance_start_date ?? ""}
              onChange={(e) =>
                setOrg({ ...org, compliance_start_date: e.target.value })
              }
            />
          </label>
          <label>
            Status
            <select
              value={org.status ?? "DRAFT"}
              onChange={(e) => setOrg({ ...org, status: e.target.value })}
            >
              <option>DRAFT</option>
              <option>ACTIVE</option>
              <option>INACTIVE</option>
            </select>
          </label>
          <label className="wide">
            Identifiers
            <textarea
              value={org.identifiers ?? ""}
              onChange={(e) => setOrg({ ...org, identifiers: e.target.value })}
            />
          </label>
          <label className="wide">
            Address
            <textarea
              value={org.address ?? ""}
              onChange={(e) => setOrg({ ...org, address: e.target.value })}
            />
          </label>
          <button disabled={!canManage(user)}>Save organization</button>
        </form>
      </Panel>
      <Panel>
        <h2>Change my password</h2>
        <form
          className="form-grid compact"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await morax.changePassword(passwords);
              setPasswords({ current_password: "", new_password: "" });
              setError("Success: Password changed");
            } catch (err) {
              setError(message(err));
            }
          }}
        >
          <label>
            Current password
            <input
              type="password"
              value={passwords.current_password}
              onChange={(e) =>
                setPasswords({ ...passwords, current_password: e.target.value })
              }
              required
              minLength={8}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={passwords.new_password}
              onChange={(e) =>
                setPasswords({ ...passwords, new_password: e.target.value })
              }
              required
              minLength={8}
            />
          </label>
          <button>Change password</button>
        </form>
      </Panel>
    </>
  );
}

function OrganizationSettings({ user }: { user: User }) {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const base = organizationId ? "/app/organizations/" + organizationId : "/app";
  const [organization, setOrganization] = useState<Row>();
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
  });
  const load = () =>
    morax
      .organization()
      .then(setOrganization)
      .catch((err) => setError(message(err)));
  useEffect(() => {
    load();
  }, [organizationId]);

  return (
    <>
      <Header title="Organization settings">
        <button
          className="secondary"
          onClick={() => navigate(base + "/dashboard")}
        >
          Back to dashboard
        </button>
      </Header>
      <ErrorBox text={error} />
      <Panel>
        <div className="split">
          <div>
            <p className="eyebrow">SELECTED ORGANIZATION</p>
            <h2>{String(organization?.name ?? "Loading organization…")}</h2>
          </div>
          {Boolean(organization?.status) && (
            <Badge text={String(organization?.status)} />
          )}
        </div>
        <dl>
          <dt>Organization code</dt>
          <dd>{String(organization?.code ?? "—")}</dd>
          <dt>Legal name</dt>
          <dd>{String(organization?.legal_name ?? "—")}</dd>
          <dt>Compliance start</dt>
          <dd>{String(organization?.compliance_start_date ?? "—")}</dd>
          <dt>Contact</dt>
          <dd>
            {String(organization?.contact_email ?? "—")}
            {organization?.contact_phone
              ? " · " + String(organization.contact_phone)
              : ""}
          </dd>
          <dt>Address</dt>
          <dd>{String(organization?.address ?? "—")}</dd>
        </dl>
        {user.platform_role === "MORAX_ADMIN" ? (
          <div className="action-row">
            <Link to="/app/organizations">
              Edit organization details in Organizations
            </Link>
          </div>
        ) : (
          <p className="muted">
            Organization identity, status, and tenant profile are managed by a
            MORAX platform administrator.
          </p>
        )}
      </Panel>
      <Panel>
        <h2>My security</h2>
        <p className="muted">
          Change only your own password. Organization access is managed in Users
          & access by an authorized administrator.
        </p>
        <form
          className="form-grid compact"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await morax.changePassword(passwords);
              setPasswords({ current_password: "", new_password: "" });
              setError("Success: Password changed");
            } catch (err) {
              setError(message(err));
            }
          }}
        >
          <label>
            Current password
            <input
              type="password"
              value={passwords.current_password}
              onChange={(e) =>
                setPasswords({ ...passwords, current_password: e.target.value })
              }
              required
              minLength={8}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={passwords.new_password}
              onChange={(e) =>
                setPasswords({ ...passwords, new_password: e.target.value })
              }
              required
              minLength={8}
            />
          </label>
          <button>Change password</button>
        </form>
      </Panel>
    </>
  );
}

function AppRoutes() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    morax
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);
  if (!ready) return <div className="loading">Loading MORAX…</div>;
  if (!user) return <Login done={setUser} />;
  const impersonate = async (userId: string) => {
    const response = await morax.impersonate(userId);
    setToken(response.access_token);
    setUser(response.user);
  };
  const endImpersonation = async () => {
    const response = await morax.endImpersonation();
    setToken(response.access_token);
    setUser(response.user);
  };
  const logout = async () => {
    try {
      if (user.impersonation?.active) await endImpersonation();
      await morax.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  };
  const home =
    user.platform_role === "MORAX_ADMIN"
      ? "/app/organizations"
      : "/app/dashboard";
  return (
    <Routes>
      <Route
        path="/app/organizations"
        element={
          <PlatformShell
            user={user}
            logout={logout}
            endImpersonation={endImpersonation}
          >
            <OrganizationLanding user={user} />
          </PlatformShell>
        }
      />
      <Route
        path="/app/organizations/:organizationId/settings"
        element={
          <PlatformShell
            user={user}
            logout={logout}
            endImpersonation={endImpersonation}
          >
            <OrganizationSettings user={user} />
          </PlatformShell>
        }
      />
      <Route
        path="/app/settings"
        element={
          <PlatformShell
            user={user}
            logout={logout}
            endImpersonation={endImpersonation}
          >
            <OrganizationSettings user={user} />
          </PlatformShell>
        }
      />
      <Route
        path="/app/organizations/:organizationId/*"
        element={
          <Layout
            user={user}
            logout={logout}
            onImpersonate={impersonate}
            endImpersonation={endImpersonation}
          />
        }
      />
      <Route
        path="/app/*"
        element={
          <Layout
            user={user}
            logout={logout}
            onImpersonate={impersonate}
            endImpersonation={endImpersonation}
          />
        }
      />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
