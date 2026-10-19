
"use client";

import { useCallback, useEffect, useState } from "react";

const STATUSES = ["Open", "In Review", "Approved", "Rejected", "Completed"];

const REASONS = [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
];

const initialForm = {
  customer_name: "",
  customer_email: "",
  order_number: "",
  item_name: "",
  quantity: 1,
  reason: "Damaged",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50";

const initialSummary = {
  total: 0,
  open: 0,
  in_review: 0,
  approved: 0,
  rejected: 0,
  completed: 0,
};

export default function Home() {
  const [requests, setRequests] = useState([]);

  const [summary, setSummary] = useState(initialSummary);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [refreshKey, setRefreshKey] = useState(0);

  // Debounce search to avoid sending a request for every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset pagination when filters or sorting change.
  useEffect(() => {
    setPagination((current) =>
      current.page === 1 ? current : { ...current, page: 1 }
    );
  }, [search, status, reason, sortBy, sortOrder]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        search,
        status,
        reason,
        sortBy,
        sortOrder,
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      const response = await fetch(`/api/requests?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Could not load requests."
        );
      }

      setRequests(data.requests || []);

      // Overall status totals returned by the backend.
      setSummary({
        ...initialSummary,
        ...(data.summary || {}),
      });

      setPagination((current) => ({
        ...current,
        ...(data.pagination || {}),
      }));
    } catch (err) {
      setError(err.message || "Could not load return requests.");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    status,
    reason,
    sortBy,
    sortOrder,
    pagination.page,
    pagination.limit,
    refreshKey,
  ]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function createRequest(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Could not create request."
        );
      }

      setForm(initialForm);
      setShowForm(false);
      setSearchInput("");
      setSearch("");
      setStatus("");
      setReason("");
      setSortBy("created_at");
      setSortOrder("desc");
      setPagination((current) => ({ ...current, page: 1 }));
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function updateFilter(setter, value) {
    setter(value);
    setPagination((current) => ({ ...current, page: 1 }));
  }

  function toggleSort(field) {
    if (sortBy === field) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }

    setPagination((current) => ({ ...current, page: 1 }));
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <div className="bg-neutral-950 px-4 py-2 text-center text-[11px] font-semibold tracking-[0.18em] text-white">
        RETURN MANAGEMENT · CUSTOMER EXPERIENCE
      </div>

      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              frido<span className="text-orange-600">.</span>
            </h1>
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.22em] text-neutral-500">
              RETURNS DESK
            </p>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <div className="text-right">
              <p className="text-sm font-semibold">Operations dashboard</p>
              <p className="text-xs text-neutral-500">
                Return request management
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
              Customer experience / operations
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
              Returns, made simpler.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
              Review customer return requests, track their progress, and manage
              resolutions from one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError("");
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:ring-4 focus:ring-orange-100"
          >
            <span className="text-xl">+</span>
            New return request
          </button>
        </div>

        {/* Summary cards use totals from the backend, not just the current page. */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total requests"
            value={summary.total}
            description="All visible requests"
            accent
          />

          <SummaryCard
            label="Open requests"
            value={summary.open}
            description="Awaiting review"
          />

          <SummaryCard
            label="In review"
            value={summary.in_review}
            description="Currently being reviewed"
          />
        </div>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-600">
            Manage requests
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight">
            Return requests
          </h3>
          <p className="mt-2 text-sm text-neutral-500">
            Select a request to view its details and manage its progress.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search customer, order or reference..."
              aria-label="Search requests"
              className={inputClass}
            />

            <select
              value={status}
              onChange={(e) => updateFilter(setStatus, e.target.value)}
              aria-label="Filter by status"
              className={inputClass}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={reason}
              onChange={(e) => updateFilter(setReason, e.target.value)}
              aria-label="Filter by reason"
              className={inputClass}
            >
              <option value="">All reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500">
              {loading
                ? "Loading requests..."
                : `${pagination.total} matching request(s)`}
            </p>

            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="sortBy" className="text-neutral-600">
                Sort by
              </label>

              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => updateFilter(setSortBy, e.target.value)}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
              >
                <option value="created_at">Date created</option>
                <option value="reference">Reference</option>
                <option value="customer_name">Customer</option>
                <option value="order_number">Order number</option>
                <option value="status">Status</option>
                <option value="reason">Reason</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setSortOrder((v) => (v === "asc" ? "desc" : "asc"))
                }
                className="rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
                aria-label="Change sort direction"
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="ml-3 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleSort("reference")}
                      >
                        Reference ↕
                      </button>
                    </th>
                    <th className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleSort("customer_name")}
                      >
                        Customer ↕
                      </button>
                    </th>
                    <th className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleSort("order_number")}
                      >
                        Order ↕
                      </button>
                    </th>
                    <th className="px-5 py-4">Reason</th>
                    <th className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                      >
                        Status ↕
                      </button>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-100">
                  {loading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-14 text-center text-neutral-500"
                      >
                        Loading requests from the database...
                      </td>
                    </tr>
                  )}

                  {!loading && !error && requests.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-16 text-center text-neutral-500"
                      >
                        No matching requests. Try another filter or create a
                        request.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !error &&
                    requests.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          window.location.href = `/requests/${item.id}`;
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            window.location.href = `/requests/${item.id}`;
                          }
                        }}
                        tabIndex={0}
                        className="cursor-pointer transition hover:bg-orange-50/60 focus:bg-orange-50 focus:outline-none"
                        title={`View request ${item.reference}`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-semibold">
                            {item.reference}
                          </span>
                          <p className="mt-1 text-xs text-neutral-400">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString()
                              : "—"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium">{item.customer_name}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {item.customer_email}
                          </p>
                        </td>

                        <td className="px-5 py-4 font-medium">
                          {item.order_number}
                        </td>

                        <td className="px-5 py-4 text-neutral-600">
                          {item.reason}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
                className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={
                  pagination.page >= pagination.totalPages || loading
                }
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
                className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-5 py-6 text-center text-xs text-neutral-500">
        ReturnDesk · Returns management
      </footer>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-neutral-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-request-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
                  Returns desk
                </p>
                <h3
                  id="new-request-title"
                  className="mt-2 text-2xl font-bold"
                >
                  New return request
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
                className="rounded-lg px-3 py-2 text-xl text-neutral-500 hover:bg-neutral-100"
              >
                ×
              </button>
            </div>

            <form onSubmit={createRequest} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Customer name">
                  <input
                    required
                    maxLength={120}
                    value={form.customer_name}
                    onChange={(e) =>
                      setForm({ ...form, customer_name: e.target.value })
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Customer email">
                  <input
                    required
                    type="email"
                    maxLength={254}
                    value={form.customer_email}
                    onChange={(e) =>
                      setForm({ ...form, customer_email: e.target.value })
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Order number">
                  <input
                    required
                    maxLength={100}
                    value={form.order_number}
                    onChange={(e) =>
                      setForm({ ...form, order_number: e.target.value })
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Item name">
                  <input
                    required
                    maxLength={160}
                    value={form.item_name}
                    onChange={(e) =>
                      setForm({ ...form, item_name: e.target.value })
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Quantity">
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Return reason">
                  <select
                    required
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                    className={inputClass}
                  >
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Create request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function FormField({ label, children }) {
  return (
    <label className="block text-sm font-semibold text-neutral-700">
      {label}
      {children}
    </label>
  );
}

function SummaryCard({ label, value, description, accent }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            accent ? "bg-orange-500" : "bg-neutral-300"
          }`}
        />
      </div>
      <p className="mt-4 text-4xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Open: "bg-blue-50 text-blue-700 ring-blue-600/15",
    "In Review": "bg-amber-50 text-amber-700 ring-amber-600/15",
    Approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    Rejected: "bg-red-50 text-red-700 ring-red-600/15",
    Completed: "bg-neutral-100 text-neutral-700 ring-neutral-500/15",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[status] || styles.Open
      }`}
    >
      <span className="mr-1.5">•</span>
      {status}
    </span>
  );
}
