
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import pool from "@/lib/db";

const REASONS = [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
];

const STATUSES = [
  "Open",
  "In Review",
  "Approved",
  "Rejected",
  "Completed",
];

const SORT_COLUMNS = {
  created_at: "created_at",
  reference: "reference",
  customer_name: "customer_name",
  order_number: "order_number",
  status: "status",
  reason: "reason",
};

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "";
    const reason = searchParams.get("reason") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = (
      searchParams.get("sortOrder") || "desc"
    ).toLowerCase();

    const page = positiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(
      positiveInteger(searchParams.get("limit"), 10),
      100
    );

    if (status && !STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: "The selected status is invalid.",
        },
        { status: 400 }
      );
    }

    if (reason && !REASONS.includes(reason)) {
      return NextResponse.json(
        {
          error: "INVALID_REASON",
          message: "The selected reason is invalid.",
        },
        { status: 400 }
      );
    }

    if (!SORT_COLUMNS[sortBy] || !["asc", "desc"].includes(sortOrder)) {
      return NextResponse.json(
        {
          error: "INVALID_SORT",
          message: "The selected sorting options are invalid.",
        },
        { status: 400 }
      );
    }

    // Build the filters for the current request list.
    const values = [];
    const conditions = ["is_removed = FALSE"];

    if (search) {
      values.push(`%${search}%`);
      const index = values.length;

      conditions.push(
        `(customer_name ILIKE $${index}
          OR order_number ILIKE $${index}
          OR reference ILIKE $${index})`
      );
    }

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    if (reason) {
      values.push(reason);
      conditions.push(`reason = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Count requests matching the active filters.
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.return_requests
       ${whereClause}`,
      values
    );

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // Fetch the requested page using SQL pagination.
    const listValues = [...values, limit, offset];

    const result = await pool.query(
      `SELECT
        id,
        reference,
        customer_name,
        customer_email,
        order_number,
        item_name,
        quantity,
        reason,
        status,
        resolution,
        refund_amount,
        created_at,
        updated_at
       FROM public.return_requests
       ${whereClause}
       ORDER BY ${SORT_COLUMNS[sortBy]} ${sortOrder.toUpperCase()}, id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      listValues
    );

    // Overall status counts, independent of current filters and page.
    const summaryResult = await pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'In Review')::int AS in_review,
        COUNT(*) FILTER (WHERE status = 'Approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'Rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed
       FROM public.return_requests
       WHERE is_removed = FALSE`
    );

    const summary = summaryResult.rows[0];

    console.log("RETURNDESK SUMMARY:", summary);

    return NextResponse.json({
      requests: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary,
    });
  } catch (error) {
    console.error("List return requests failed:", error);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not load return requests. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let client;

  try {
    const body = await request.json();

    const customer_name =
      typeof body.customer_name === "string"
        ? body.customer_name.trim()
        : "";

    const customer_email =
      typeof body.customer_email === "string"
        ? body.customer_email.trim()
        : "";

    const order_number =
      typeof body.order_number === "string"
        ? body.order_number.trim()
        : "";

    const item_name =
      typeof body.item_name === "string"
        ? body.item_name.trim()
        : "";

    const quantity = Number(body.quantity);
    const reason = body.reason;

    if (
      !customer_name ||
      !customer_email ||
      !order_number ||
      !item_name ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !REASONS.includes(reason)
    ) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message:
            "Provide a customer name, valid email, order number, item name, positive integer quantity, and valid reason.",
        },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(customer_email)) {
      return NextResponse.json(
        {
          error: "INVALID_EMAIL",
          message: "Provide a valid customer email address.",
        },
        { status: 400 }
      );
    }

    const reference = `RET-${new Date().getFullYear()}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    client = await pool.connect();
    await client.query("BEGIN");

    const orderKey = order_number.toLowerCase();
    const itemKey = item_name.toLowerCase();

    // Serialize duplicate checks for the same order and item.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [orderKey, itemKey]
    );

    const duplicate = await client.query(
      `SELECT id
       FROM public.return_requests
       WHERE LOWER(order_number) = $1
         AND LOWER(item_name) = $2
         AND status NOT IN ('Rejected', 'Completed')
         AND is_removed = FALSE
       LIMIT 1`,
      [orderKey, itemKey]
    );

    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "DUPLICATE_LIVE_REQUEST",
          message:
            "An active return request already exists for this item on this order.",
        },
        { status: 409 }
      );
    }

    const result = await client.query(
      `INSERT INTO public.return_requests (
        reference,
        customer_name,
        customer_email,
        order_number,
        item_name,
        quantity,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        reference,
        customer_name,
        customer_email,
        order_number,
        item_name,
        quantity,
        reason,
        status,
        resolution,
        refund_amount,
        created_at,
        updated_at`,
      [
        reference,
        customer_name,
        customer_email,
        order_number,
        item_name,
        quantity,
        reason,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        message: "Return request created successfully.",
        request: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Create return request failed:", error);

    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: "DUPLICATE_REFERENCE",
          message: "A duplicate reference was generated. Please retry.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Could not create the return request. Please try again.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
