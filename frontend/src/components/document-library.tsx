import { useDeferredValue, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Download, Eye, FileUp, Search, X } from "lucide-react";
import { morax } from "../api/morax";
import type { User } from "../api/morax";
import { EmptyState, InlineError, LoadingSkeleton } from "./workspace-ui";

type Row = Record<string, unknown>;
const uploadSchema = z.object({
  instance_id: z.string().min(1, "Select a compliance obligation"),
  category: z.string().trim().min(1, "Enter a document category").max(100),
});
type UploadForm = z.infer<typeof uploadSchema>;

const text = (row: Row, key: string) =>
  row[key] == null || row[key] === "" ? "—" : String(row[key]);
const canDelete = (user: User) =>
  user.platform_role === "MORAX_ADMIN" ||
  user.roles.some((role) =>
    ["ORGANIZATION_ADMIN", "UNIT_ADMIN", "CONTRACTOR_ADMIN"].includes(role),
  );

export function DocumentLibrary({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const { organizationId } = useParams();
  const base = organizationId ? `/app/organizations/${organizationId}` : "/app";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [entityType, setEntityType] = useState("");
  const [verification, setVerification] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: "created_at", dir: "desc" });
  const [selected, setSelected] = useState<Row | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const filters = useMemo(
    () => ({
      page: String(page),
      page_size: "10",
      q: deferredSearch.trim() || undefined,
      entity_type: entityType || undefined,
      verification_state: verification || undefined,
      sort_by: sort.by,
      sort_dir: sort.dir,
    }),
    [deferredSearch, entityType, page, sort, verification],
  );
  const documents = useQuery({
    queryKey: ["documents-page", filters],
    queryFn: () => morax.documentsPage(filters),
    staleTime: 30_000,
  });
  const instances = useQuery({
    queryKey: ["uploadable-instances"],
    queryFn: () => morax.instances({ page: "1", page_size: "100" }),
    enabled: uploadOpen,
    staleTime: 30_000,
  });
  const uploadForm = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: { instance_id: "", category: "SUPPORTING_DOCUMENT" },
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["documents-page"] });
  const upload = useMutation({
    mutationFn: async (values: UploadForm) => {
      if (!file) throw new Error("Choose a file to upload");
      return morax.evidence(values.instance_id, file, values.category);
    },
    onSuccess: async () => {
      setNotice("Document uploaded successfully.");
      setUploadOpen(false);
      setFile(null);
      uploadForm.reset();
      await invalidate();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not upload document.",
      ),
  });
  const remove = useMutation({
    mutationFn: (id: string) => morax.deleteDocument(id),
    onSuccess: async () => {
      setNotice("Document deleted.");
      setSelected(null);
      await invalidate();
    },
    onError: (error) =>
      setNotice(
        error instanceof Error ? error.message : "Could not delete document.",
      ),
  });
  const total = documents.data?.total ?? 0;
  const pageSize = documents.data?.page_size ?? 10;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const setFilter = (setter: (value: string) => void, value: string) => {
    setPage(1);
    setter(value);
  };
  const setSorting = (by: string) =>
    setSort((current) =>
      current.by === by
        ? { by, dir: current.dir === "asc" ? "desc" : "asc" }
        : { by, dir: "asc" },
    );
  const sortMark = (by: string) =>
    sort.by === by ? (sort.dir === "asc" ? " ↑" : " ↓") : " ↕";

  return (
    <section className="crud-page document-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">EVIDENCE REPOSITORY</p>
          <h1>Document library</h1>
          <p className="muted">
            Evidence remains linked to the compliance obligation and its
            workflow history.
          </p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            setNotice("");
            setUploadOpen(true);
          }}
        >
          <FileUp size={17} /> Upload document
        </button>
      </header>
      {notice && (
        <p
          className={`alert ${notice.includes("success") || notice === "Document deleted." ? "success" : "error"}`}
        >
          {notice}
        </p>
      )}
      <section className="panel entity-list-panel">
        <div className="crud-toolbar">
          <label className="table-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setFilter(setSearch, event.target.value)}
              placeholder="Search document name…"
              aria-label="Search documents"
            />
          </label>
          <label className="compact-filter">
            <span>Entity</span>
            <select
              value={entityType}
              onChange={(event) => setFilter(setEntityType, event.target.value)}
            >
              <option value="">All entities</option>
              <option value="UNIT">Unit</option>
              <option value="CONTRACTOR">Contractor</option>
              <option value="CONTRACTOR_SITE">Contractor site</option>
            </select>
          </label>
          <label className="compact-filter">
            <span>Verification</span>
            <select
              value={verification}
              onChange={(event) =>
                setFilter(setVerification, event.target.value)
              }
            >
              <option value="">All states</option>
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          {(search || entityType || verification) && (
            <button
              type="button"
              className="text-action"
              onClick={() => {
                setSearch("");
                setEntityType("");
                setVerification("");
                setPage(1);
              }}
            >
              <X size={15} /> Clear filters
            </button>
          )}
        </div>
        {documents.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : documents.isError ? (
          <InlineError message="Unable to load documents." />
        ) : documents.data?.items.length ? (
          <div className="table-wrap modern-data-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      className="table-sort"
                      type="button"
                      onClick={() => setSorting("filename")}
                    >
                      Document{sortMark("filename")}
                    </button>
                  </th>
                  <th>Compliance / entity</th>
                  <th>Period</th>
                  <th>
                    <button
                      className="table-sort"
                      type="button"
                      onClick={() => setSorting("verification_state")}
                    >
                      Verification{sortMark("verification_state")}
                    </button>
                  </th>
                  <th>
                    <button
                      className="table-sort"
                      type="button"
                      onClick={() => setSorting("created_at")}
                    >
                      Uploaded{sortMark("created_at")}
                    </button>
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.data.items.map((row) => (
                  <tr key={text(row, "id")}>
                    <td>
                      <div className="entity-name-cell">
                        <b>{text(row, "original_filename")}</b>
                        <span>
                          v{text(row, "version")} · {text(row, "category")}
                        </span>
                      </div>
                    </td>
                    <td>
                      <b>{text(row, "compliance_name")}</b>
                      <br />
                      <small>
                        {text(row, "subject_name")} · {text(row, "entity_type")}
                      </small>
                    </td>
                    <td>{text(row, "period")}</td>
                    <td>
                      <span
                        className={`badge ${text(row, "verification_state").toLowerCase()}`}
                      >
                        {text(row, "verification_state")}
                      </span>
                    </td>
                    <td>{text(row, "created_at").slice(0, 10)}</td>
                    <td>
                      <div className="entity-table-actions">
                        <button
                          type="button"
                          className="icon-action"
                          title="View document"
                          onClick={() => setSelected(row)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-action"
                          title="Download document"
                          onClick={() =>
                            morax
                              .downloadDocument(
                                text(row, "id"),
                                text(row, "original_filename"),
                              )
                              .catch((error) =>
                                setNotice(
                                  error instanceof Error
                                    ? error.message
                                    : "Download failed.",
                                ),
                              )
                          }
                        >
                          <Download size={16} />
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
            title="No documents found"
            description="Change filters or upload evidence against a compliance obligation."
          />
        )}
        <footer className="table-pagination">
          <span>
            {total
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
              : "No records"}
          </span>
          <div>
            <button
              type="button"
              className="icon-action"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              ‹
            </button>
            <span>
              Page {page} of {lastPage}
            </span>
            <button
              type="button"
              className="icon-action"
              disabled={page >= lastPage}
              onClick={() => setPage((value) => value + 1)}
            >
              ›
            </button>
          </div>
        </footer>
      </section>
      {selected && (
        <DocumentSheet
          row={selected}
          base={base}
          allowDelete={canDelete(user)}
          busy={remove.isPending}
          onClose={() => setSelected(null)}
          onDelete={() => {
            if (
              window.confirm(`Delete ${text(selected, "original_filename")}?`)
            )
              remove.mutate(text(selected, "id"));
          }}
          onDownload={() =>
            morax
              .downloadDocument(
                text(selected, "id"),
                text(selected, "original_filename"),
              )
              .catch((error) =>
                setNotice(
                  error instanceof Error ? error.message : "Download failed.",
                ),
              )
          }
        />
      )}
      {uploadOpen && (
        <Sheet
          title="Upload supporting document"
          onClose={() => setUploadOpen(false)}
        >
          <form
            className="entity-form"
            onSubmit={uploadForm.handleSubmit((values) =>
              upload.mutate(values),
            )}
          >
            <p className="scope-intro">
              Documents are evidence for an existing compliance obligation.
              Uploading here uses the same auditable evidence workflow as the
              compliance detail screen.
            </p>
            <label>
              Compliance obligation
              <select {...uploadForm.register("instance_id")}>
                <option value="">Select obligation</option>
                {instances.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.compliance_name} — {item.subject_name} (due{" "}
                    {item.due_date})
                  </option>
                ))}
              </select>
              {uploadForm.formState.errors.instance_id?.message && (
                <small className="field-error">
                  {uploadForm.formState.errors.instance_id.message}
                </small>
              )}
            </label>
            <label>
              Category
              <input {...uploadForm.register("category")} />
            </label>
            <label>
              File
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <footer className="drawer-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </button>
              <button className="primary-action" disabled={upload.isPending}>
                {upload.isPending ? "Uploading…" : "Upload document"}
              </button>
            </footer>
          </form>
        </Sheet>
      )}
    </section>
  );
}

function DocumentSheet({
  row,
  base,
  allowDelete,
  busy,
  onClose,
  onDelete,
  onDownload,
}: {
  row: Row;
  base: string;
  allowDelete: boolean;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  return (
    <Sheet title={text(row, "original_filename")} onClose={onClose}>
      <div className="entity-form">
        <dl className="dialog-detail-grid">
          <div>
            <dt>Compliance</dt>
            <dd>{text(row, "compliance_name")}</dd>
          </div>
          <div>
            <dt>Entity</dt>
            <dd>{text(row, "subject_name")}</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd>{text(row, "period")}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>{text(row, "verification_state")}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{text(row, "category")}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{text(row, "version")}</dd>
          </div>
        </dl>
        <footer className="drawer-footer">
          <Link
            className="secondary"
            to={`${base}/compliances/detail/${text(row, "compliance_instance_id")}`}
          >
            Open workflow
          </Link>
          {allowDelete && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          <button type="button" className="primary-action" onClick={onDownload}>
            <Download size={16} /> Download
          </button>
        </footer>
      </div>
    </Sheet>
  );
}

function Sheet({
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
                Changes and access remain governed by the existing compliance
                workflow.
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
