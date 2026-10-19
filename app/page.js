
const requests = [];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="bg-neutral-950 px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
        RETURN MANAGEMENT · CUSTOMER EXPERIENCE
      </div>

      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              frido<span className="text-orange-600">.</span>
            </h1>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-neutral-500">
              RETURNS DESK
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">Operations Dashboard</p>
            <p className="mt-1 text-xs text-neutral-500">
              Return request management
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            Customer experience / operations
          </p>

          <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Returns, made simpler.
          </h2>

          <p className="mt-4 max-w-xl text-base leading-7 text-neutral-600">
            Review customer return requests, track their progress,
            and manage resolutions from one place.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total requests"
            value={requests.length}
            description="All visible requests"
          />
          <SummaryCard
            label="Open requests"
            value={requests.filter((r) => r.status === "Open").length}
            description="Awaiting review"
          />
          <SummaryCard
            label="In review"
            value={requests.filter((r) => r.status === "In Review").length}
            description="Currently being reviewed"
          />
        </div>

        <section className="mt-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-600">
                Manage requests
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">
                Return requests
              </h3>
              <p className="mt-2 text-sm text-neutral-500">
                Find and review customer returns.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
            >
              <span className="text-lg">+</span>
              New return request
            </button>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
            <input
              type="search"
              placeholder="Search customer, order or reference..."
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />

            <select
              defaultValue=""
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500"
            >
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="In Review">In Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label
              htmlFor="reason"
              className="text-sm text-neutral-600"
            >
              Reason:
            </label>
            <select
              id="reason"
              defaultValue=""
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All reasons</option>
              <option value="Damaged">Damaged</option>
              <option value="Wrong Item">Wrong Item</option>
              <option value="Size Issue">Size Issue</option>
              <option value="Not As Described">Not As Described</option>
              <option value="Changed Mind">Changed Mind</option>
            </select>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Reference</th>
                    <th className="px-5 py-4 font-semibold">Customer</th>
                    <th className="px-5 py-4 font-semibold">Order</th>
                    <th className="px-5 py-4 font-semibold">Reason</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-2xl text-orange-600">
                          ↗
                        </div>
                        <p className="mt-4 font-semibold text-neutral-800">
                          No return requests yet
                        </p>
                        <p className="mt-2 text-sm leading-6 text-neutral-500">
                          Requests will appear here once the application
                          is connected to its database.
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </section>

      <footer className="border-t border-neutral-200 px-5 py-6 text-center text-xs text-neutral-500">
        ReturnDesk · Returns management
      </footer>
    </main>
  );
}

function SummaryCard({ label, value, description }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:border-orange-200">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className="mt-4 text-4xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{description}</p>
    </div>
  );
}
