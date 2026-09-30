import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCog,
  X,
} from "lucide-react";
import { morax } from "../api/morax";
import type { User } from "../api/morax";
import { EmptyState, InlineError, LoadingSkeleton } from "./workspace-ui";

const userTableFeatures = tableFeatures({ rowSortingFeature });
const EMPTY_USERS: User[] = [];
const ROLES = [
  "ORGANIZATION_ADMIN",
  "UNIT_ADMIN",
  "UNIT_MAKER",
  "UNIT_CHECKER",
  "CONTRACTOR_ADMIN",
  "CONTRACTOR_MAKER",
  "CONTRACTOR_CHECKER",
  "VIEWER",
  "AUDITOR",
] as const;
const SCOPE_TYPES = [
  "ORGANIZATION",
  "UNIT",
  "CONTRACTOR",
  "CONTRACTOR_SITE",
] as const;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(150),
  email: z.string().trim().email("Enter a valid email address"),
  mobile: z.string(),
  password: z.string().min(8, "Use at least 8 characters"),
  active: z.boolean(),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

const scopesSchema = z.object({
  scopes: z.array(
    z.object({
      role: z.enum(ROLES),
      scope_type: z.enum(SCOPE_TYPES),
      scope_id: z.string().min(1, "Select an assigned scope"),
    }),
  ),
});
type ScopesForm = z.infer<typeof scopesSchema>;

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOrgAdmin(user: User) {
  return (
    user.platform_role === "MORAX_ADMIN" ||
    user.roles.includes("ORGANIZATION_ADMIN")
  );
}

export function UserAccessManager({
  user,
  onImpersonate,
}: {
  user: User;
  onImpersonate: (userId: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canManage = isOrgAdmin(user);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [scopeUser, setScopeUser] = useState<User | null>(null);
  const [notice, setNotice] = useState("");
  const sort = sorting[0];

  const filters = useMemo(
    () => ({
      page: String(page),
      page_size: "10",
      q: deferredSearch.trim() || undefined,
      active: active || undefined,
      sort_by: sort?.id || "name",
      sort_dir: sort?.desc ? "desc" : "asc",
    }),
    [active, deferredSearch, page, sort?.desc, sort?.id],
  );
  useEffect(() => setPage(1), [active, deferredSearch, sort?.desc, sort?.id]);

  const usersQuery = useQuery({
    queryKey: ["users-page", filters],
    queryFn: () => morax.usersPage(filters),
    enabled: canManage,
    staleTime: 30_000,
  });
  const scopeOptions = useQuery({
    queryKey: ["scope-options"],
    queryFn: async () => {
      const [units, contractors, sites] = await Promise.all([
        morax.unitsPage({ page: "1", page_size: "100" }),
        morax.contractors(),
        morax.sites(),
      ]);
      return { units: units.items, contractors, sites };
    },
    enabled: canManage,
    staleTime: 5 * 60_000,
  });

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      mobile: "",
      password: "",
      active: true,
    },
  });
  const scopeForm = useForm<ScopesForm>({
    resolver: zodResolver(scopesSchema),
    defaultValues: { scopes: [] },
  });
  const scopeFields = useFieldArray({
    control: scopeForm.control,
    name: "scopes",
  });
  const watchedScopes = scopeForm.watch("scopes");

  const refreshUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["users-page"] });
  };
  const createMutation = useMutation({
    mutationFn: (values: CreateUserForm) =>
      morax.createUser({ ...values, mobile: values.mobile || null }),
    onSuccess: async () => {
      setNotice(
        "User created successfully. Assign a role scope to grant access.",
      );
      createForm.reset();
      setCreateOpen(false);
      await refreshUsers();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not create user.",
      ),
  });
  const scopesMutation = useMutation({
    mutationFn: (values: ScopesForm) => {
      if (!scopeUser) throw new Error("Select a user first");
      return morax.replaceScopes(scopeUser.id, values.scopes);
    },
    onSuccess: async () => {
      setNotice("Role scopes saved successfully.");
      setScopeUser(null);
      await refreshUsers();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not save role scopes.",
      ),
  });

  const candidates = (scopeType: string) => {
    if (scopeType === "ORGANIZATION")
      return [{ id: user.organization_id, name: "Entire organization" }];
    if (scopeType === "UNIT") return scopeOptions.data?.units ?? [];
    if (scopeType === "CONTRACTOR") return scopeOptions.data?.contractors ?? [];
    return scopeOptions.data?.sites ?? [];
  };
  const startScopes = useCallback(
    (target: User) => {
      setNotice("");
      setScopeUser(target);
      scopeForm.reset({
        scopes: target.scopes.map((scope) => ({
          role: scope.role as (typeof ROLES)[number],
          scope_type: scope.scope_type as (typeof SCOPE_TYPES)[number],
          scope_id: scope.scope_id,
        })),
      });
    },
    [scopeForm],
  );
  const addScope = () => {
    const unit = scopeOptions.data?.units[0];
    scopeFields.append({
      role: "UNIT_MAKER",
      scope_type: unit ? "UNIT" : "ORGANIZATION",
      scope_id: unit ? String(unit.id) : user.organization_id,
    });
  };
  const loginAs = useCallback(
    async (target: User) => {
      if (
        !window.confirm(`Start an audited temporary session as ${target.name}?`)
      )
        return;
      try {
        await onImpersonate(target.id);
        navigate("/app/dashboard");
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not start the temporary session.",
        );
      }
    },
    [navigate, onImpersonate],
  );

  const columns = useMemo<ColumnDef<typeof userTableFeatures, User, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "User",
        cell: ({ row }) => (
          <div className="entity-name-cell">
            <b>{row.original.name}</b>
            <span>{row.original.email}</span>
          </div>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="user-roles">
            {row.original.roles.length
              ? row.original.roles.map(roleLabel).join(", ")
              : "No access assigned"}
          </span>
        ),
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`badge ${row.original.active === false ? "inactive" : "active"}`}
          >
            {row.original.active === false ? "Inactive" : "Active"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="user-table-actions">
            <button
              type="button"
              className="secondary compact-action"
              onClick={() => startScopes(row.original)}
            >
              <ShieldCheck size={15} /> Roles & scopes
            </button>
            <button
              type="button"
              className="icon-action"
              title="Login as user"
              aria-label={`Login as ${row.original.name}`}
              disabled={
                row.original.active === false ||
                row.original.id === user.id ||
                Boolean(row.original.platform_role)
              }
              onClick={() => loginAs(row.original)}
            >
              <KeyRound size={16} />
            </button>
          </div>
        ),
      },
    ],
    [loginAs, startScopes, user.id],
  );
  const table = useTable({
    features: userTableFeatures,
    data: usersQuery.data?.items ?? EMPTY_USERS,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
  });
  const total = usersQuery.data?.total ?? 0;
  const pageSize = usersQuery.data?.page_size ?? 10;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  if (!canManage) {
    return (
      <InlineError message="Organization administrator permission is required to manage users and access." />
    );
  }

  return (
    <section className="crud-page user-access-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>Users & access</h1>
          <p className="muted">
            Create users, save their complete role-scope list, and validate
            their actual access with an audited temporary session.
          </p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            setNotice("");
            createForm.reset();
            setCreateOpen(true);
          }}
        >
          <Plus size={17} /> Add user
        </button>
      </header>
      {notice && (
        <p
          className={`alert ${notice.includes("success") ? "success" : "error"}`}
        >
          {notice}
        </p>
      )}

      <section className="panel entity-list-panel">
        <div className="crud-toolbar">
          <label className="table-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email…"
            />
          </label>
          <label className="compact-filter">
            <span>Status</span>
            <select
              value={active}
              onChange={(event) => setActive(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          {(search || active) && (
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setSearch("");
                setActive("");
              }}
            >
              <X size={15} /> Clear filters
            </button>
          )}
        </div>
        {usersQuery.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : usersQuery.isError ? (
          <InlineError message="Unable to load users." />
        ) : table.getRowModel().rows.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Change the filters or create the first organization user."
          />
        ) : (
          <div className="table-wrap modern-data-table">
            <table>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
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

      {createOpen && (
        <Drawer
          title="Create user"
          icon={<UserRoundCog size={19} />}
          onClose={() => setCreateOpen(false)}
        >
          <form
            className="entity-form"
            onSubmit={createForm.handleSubmit((values) =>
              createMutation.mutate(values),
            )}
          >
            <div className="form-grid">
              <FormField
                label="Name"
                error={createForm.formState.errors.name?.message}
              >
                <input autoFocus {...createForm.register("name")} />
              </FormField>
              <FormField
                label="Email"
                error={createForm.formState.errors.email?.message}
              >
                <input type="email" {...createForm.register("email")} />
              </FormField>
              <FormField label="Mobile">
                <input {...createForm.register("mobile")} />
              </FormField>
              <FormField
                label="Temporary password"
                error={createForm.formState.errors.password?.message}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  {...createForm.register("password")}
                />
              </FormField>
              <label className="inline">
                <input type="checkbox" {...createForm.register("active")} />{" "}
                Create as active
              </label>
            </div>
            <DrawerFooter
              onCancel={() => setCreateOpen(false)}
              busy={createMutation.isPending}
              label="Create user"
            />
          </form>
        </Drawer>
      )}

      {scopeUser && (
        <Drawer
          title={`Roles & scopes — ${scopeUser.name}`}
          icon={<ShieldCheck size={19} />}
          onClose={() => setScopeUser(null)}
        >
          <form
            className="entity-form"
            onSubmit={scopeForm.handleSubmit((values) =>
              scopesMutation.mutate(values),
            )}
          >
            <p className="scope-intro">
              This saves the complete role-scope list for this user. Each
              assignment is enforced by the backend; users cannot expand its
              scope from the URL or a request payload.
            </p>
            {scopeFields.fields.length === 0 && (
              <EmptyState
                title="No role scopes"
                description="Add at least one role scope before this user can perform organization work."
              />
            )}
            <div className="scope-editor-list">
              {scopeFields.fields.map((field, index) => {
                const scopeType = watchedScopes[index]?.scope_type || "UNIT";
                const choices = candidates(scopeType);
                return (
                  <div className="scope-row" key={field.id}>
                    <FormField label="Role">
                      <select {...scopeForm.register(`scopes.${index}.role`)}>
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Scope type">
                      <select
                        {...scopeForm.register(`scopes.${index}.scope_type`, {
                          onChange: (event) => {
                            const type = event.target.value;
                            const first = candidates(type)[0];
                            scopeForm.setValue(
                              `scopes.${index}.scope_id`,
                              first ? String(first.id) : "",
                            );
                          },
                        })}
                      >
                        {SCOPE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {roleLabel(type)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      label="Assigned scope"
                      error={
                        scopeForm.formState.errors.scopes?.[index]?.scope_id
                          ?.message
                      }
                    >
                      <select
                        {...scopeForm.register(`scopes.${index}.scope_id`)}
                        disabled={choices.length === 0}
                      >
                        <option value="">
                          {choices.length
                            ? "Select scope"
                            : "No accessible records"}
                        </option>
                        {choices.map((choice) => (
                          <option
                            key={String(choice.id)}
                            value={String(choice.id)}
                          >
                            {String(choice.name)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <button
                      type="button"
                      className="icon-action danger"
                      aria-label="Remove role scope"
                      title="Remove role scope"
                      onClick={() => scopeFields.remove(index)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="secondary add-scope-button"
              onClick={addScope}
              disabled={scopeOptions.isLoading}
            >
              <Plus size={16} /> Add role scope
            </button>
            <DrawerFooter
              onCancel={() => setScopeUser(null)}
              busy={scopesMutation.isPending}
              label="Save all scopes"
            />
          </form>
        </Drawer>
      )}
    </section>
  );
}

function Drawer({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="crud-drawer-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="crud-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-heading">
          <div>
            <span className="drawer-icon">{icon}</span>
            <div>
              <h2>{title}</h2>
              <p>
                Changes are audited and take effect immediately after saving.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-action"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function DrawerFooter({
  onCancel,
  busy,
  label,
}: {
  onCancel: () => void;
  busy: boolean;
  label: string;
}) {
  return (
    <footer className="drawer-footer">
      <button type="button" className="secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="primary-action" disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </footer>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
