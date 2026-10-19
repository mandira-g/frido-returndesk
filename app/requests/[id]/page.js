
"use client";

import { useCallback, useEffect, useState } from "react";

const STATUSES = ["Open", "In Review", "Approved", "Rejected", "Completed"];

const inputClass =
  "mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50";

export default function RequestDetailsPage({ params }) {
  const [requestId, setRequestId] = useState(null);
  const [request, setRequest] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [resolution, setResolution] = useState("Refund");
  const [refundAmount, setRefundAmount] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((value) => setRequestId(value.id));
  }, [params]);

  const loadRequest = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/requests/${requestId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not load this request.");
      }

      setRequest(data.request || data);
      setNotes(data.notes || data.request?.notes || []);
    } catch (err) {
      setError(err.message || "Could not load request details.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const status = request?.status;

  const availableStatuses = {
    Open: ["In Review"],
    "In Review": ["Approved", "Rejected"],
    Approved: ["Completed"],
    Rejected: [],
    Completed: [],
  };

  const allowedNextStatuses = availableStatuses[status] || [];
  const isFinal = ["Approved", "Rejected", "Completed"].includes(status);

  async function updateStatus(event) {
    event.preventDefault();
    setActionError("");
    setMessage("");

    if (!nextStatus) {
      setActionError("Choose a status first.");
      return;
    }

    if (nextStatus === "Approved" && resolution === "Refund") {
      if (!Number.isFinite(Number(refundAmount)) || Number(refundAmount) <= 0) {
        setActionError("A refund requires an amount greater than zero.");
        return;
      }
    }

    setSaving(true);

    try {
      const body = { status: nextStatus };

      if (nextStatus === "Approved") {
        body.resolution = resolution;

        if (resolution === "Refund") {
          body.refund_amount = Number(refundAmount);
        }
      }

      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not update status.");
      }

      setMessage("Request status updated successfully.");
      setNextStatus("");
      await loadRequest();
    } catch (err) {
      setActionError(err.message || "Could not update the request.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    setActionError("");
    setMessage("");

    if (!noteText.trim()) {
      setActionError("Enter a note before submitting.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/requests/${requestId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not add the note.");
      }

      setNoteText("");
      setMessage("Note added successfully.");
      await loadRequest();
    } catch (err) {
      setActionError(err.message || "Could not add the note.");
    } finally {
      setSaving(false);
    }
  }

  async function softRemove() {
    if (!window.confirm("Soft-remove this return request?")) return;

    setSaving(true);
    setActionError("");

    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Could not remove request.");
      }

      window.location.href = "/";
    } catch (err) {
      setActionError(err.message || "Could not remove the request.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#f7f7f5] p-8 text-neutral-600">Loading request details...</main>;
  }

  if (error || !request) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] p-6 sm:p-10">
        <a href="/" className="font-semibold text-orange-700 hover:underline">← Back to requests</a>
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-red-200 bg-white p-6">
          <h1 className="text-xl font-bold">Could not open request</h1>
          <p className="mt-2 text-sm text-red-700">{error || "Request not found."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <a href="/" className="text-2xl font-black">
            frido<span className="text-orange-600">.</span>
            <span className="ml-2 text-[10px] font-bold tracking-widest text-neutral-500">RETURNS DESK</span>
          </a>
          <a href="/" className="text-sm font-semibold text-orange-700 hover:underline">← All requests</a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Return request details</p>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="break-all text-2xl font-bold sm:text-3xl">{request.reference}</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Created {request.created_at ? new Date(request.created_at).toLocaleString() : "—"}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        {message && (
          <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {actionError}
          </p>
        )}

        <section className="mt-7 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold">Request information</h2>

          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Detail label="Customer name" value={request.customer_name} />
            <Detail label="Customer email" value={request.customer_email} />
            <Detail label="Order number" value={request.order_number} />
            <Detail label="Item" value={request.item_name} />
            <Detail label="Quantity" value={request.quantity} />
            <Detail label="Reason" value={request.reason} />
            <Detail label="Resolution" value={request.resolution || "Not decided"} />
            <Detail
              label="Refund amount"
              value={request.refund_amount == null ? "—" : Number(request.refund_amount).toFixed(2)}
            />
          </dl>

          {request.updated_at && (
            <p className="mt-5 text-xs text-neutral-400">
              Last updated: {new Date(request.updated_at).toLocaleString()}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold">Status management</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Only valid next steps are available for the current status.
          </p>

          {allowedNextStatuses.length > 0 ? (
            <form onSubmit={updateStatus} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">
                Next status
                <select required value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} className={inputClass}>
                  <option value="">Choose a status</option>
                  {allowedNextStatuses.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>

              {nextStatus === "Approved" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Resolution
                    <select value={resolution} onChange={(e) => setResolution(e.target.value)} className={inputClass}>
                      <option value="Refund">Refund</option>
                      <option value="Replacement">Replacement</option>
                      <option value="Store Credit">Store Credit</option>
                    </select>
                  </label>

                  {resolution === "Refund" && (
                    <label className="block text-sm font-semibold">
                      Refund amount
                      <input required type="number" min="0.01" step="0.01" value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)} className={inputClass} />
                    </label>
                  )}
                </div>
              )}

              <button disabled={saving} type="submit"
                className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                {saving ? "Saving..." : "Update status"}
              </button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
              This request has no further status transitions available.
            </p>
          )}

          {isFinal && (
            <p className="mt-3 text-xs text-neutral-500">
              Customer and item details are locked after approval, rejection, or completion. Notes remain available.
            </p>
          )}

          {["Open", "Rejected"].includes(status) && (
            <button type="button" disabled={saving} onClick={softRemove}
              className="mt-5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
              Soft-remove request
            </button>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold">Request notes</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Notes are kept in chronological order and cannot be edited or deleted.
          </p>

          <div className="mt-5 space-y-3">
            {notes.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">No notes have been added yet.</p>
            ) : (
              notes.map((note) => (
                <article key={note.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6">{note.note}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    {note.created_at ? new Date(note.created_at).toLocaleString() : "—"}
                  </p>
                </article>
              ))
            )}
          </div>

          <form onSubmit={addNote} className="mt-6 border-t border-neutral-100 pt-5">
            <label htmlFor="new-note" className="block text-sm font-semibold">Add a note</label>
            <textarea id="new-note" required maxLength={5000} rows={4} value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note about this request..."
              className={inputClass} />
            <button disabled={saving} type="submit"
              className="mt-3 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-60">
              {saving ? "Saving..." : "Add note"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-neutral-900">{value ?? "—"}</dd>
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
    <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.Open}`}>
      <span className="mr-1.5">•</span>{status}
    </span>
  );
}
