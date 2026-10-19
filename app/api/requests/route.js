
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import pool from "@/lib/db";

const allowedReasons = [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
];

export async function POST(request) {
  let body;

  // Read the JSON sent by the client.
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
      { status: 400 }
    );
  }

  // Validate all required fields.
  const {
    customer_name,
    customer_email,
    order_number,
    item_name,
    quantity,
    reason,
  } = body ?? {};

  if (
    typeof customer_name !== "string" ||
    !customer_name.trim() ||
    typeof customer_email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email.trim()) ||
    typeof order_number !== "string" ||
    !order_number.trim() ||
    typeof item_name !== "string" ||
    !item_name.trim() ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    !allowedReasons.includes(reason)
  ) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message:
          "Provide a valid name, email, order number, item name, positive quantity, and reason.",
      },
      { status: 400 }
    );
  }

  const reference = `RET-${new Date().getFullYear()}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Normalize order and item names for duplicate checking.
    const orderKey = order_number.trim().toLowerCase();
    const itemKey = item_name.trim().toLowerCase();

    // Serialize simultaneous requests for the same order and item.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [orderKey, itemKey]
    );

    const duplicate = await client.query(
      `SELECT id
       FROM public.return_requests
       WHERE LOWER(TRIM(order_number)) = $1
         AND LOWER(TRIM(item_name)) = $2
         AND status NOT IN ('Rejected', 'Completed')
       LIMIT 1`,
      [orderKey, itemKey]
    );

    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "DUPLICATE_LIVE_REQUEST",
          message:
            "A live return request already exists for this item on this order.",
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
         id, reference, customer_name, customer_email,
         order_number, item_name, quantity, reason,
         status, resolution, refund_amount, created_at`,
      [
        reference,
        customer_name.trim(),
        customer_email.trim(),
        order_number.trim(),
        item_name.trim(),
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
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction may already have rolled back.
      }
    }

    console.error("Create return request failed:", error.message);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to create the return request.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Read search, filter, sorting, and pagination parameters.
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "";
    const reason = searchParams.get("reason") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "10", 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Page must be positive and limit must be between 1 and 100.",
        },
        { status: 400 }
      );
    }

    const allowedStatuses = [
      "Open",
      "In Review",
      "Approved",
      "Rejected",
      "Completed",
    ];

    const allowedSortFields = [
      "created_at",
      "updated_at",
      "customer_name",
      "order_number",
      "status",
      "reason",
      "reference",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: "Invalid status filter." },
        { status: 400 }
      );
    }

    if (reason && !allowedReasons.includes(reason)) {
      return NextResponse.json(
        { error: "INVALID_REASON", message: "Invalid reason filter." },
        { status: 400 }
      );
    }

    if (!allowedSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: "INVALID_SORT_FIELD", message: "Invalid sort field." },
        { status: 400 }
      );
    }

    if (!["asc", "desc"].includes(sortOrder.toLowerCase())) {
      return NextResponse.json(
        { error: "INVALID_SORT_ORDER", message: "Sort order must be asc or desc." },
        { status: 400 }
      );
    }

    // Build SQL conditions safely using parameterized values.
    const conditions = ["is_removed = FALSE"];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(customer_name ILIKE $${values.length}
          OR order_number ILIKE $${values.length}
          OR reference ILIKE $${values.length})`
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

    const whereClause = conditions.join(" AND ");

    // Count matching requests for pagination metadata.
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.return_requests
       WHERE ${whereClause}`,
      values
    );

    const total = countResult.rows[0].total;
    const offset = (page - 1) * limit;

    // sortBy comes from an allowlist; values remain parameterized.
    const direction = sortOrder.toUpperCase();

    const listResult = await pool.query(
      `SELECT
         id, reference, customer_name, customer_email,
         order_number, item_name, quantity, reason,
         status, resolution, refund_amount,
         created_at, updated_at
       FROM public.return_requests
       WHERE ${whereClause}
       ORDER BY ${sortBy} ${direction}, id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return NextResponse.json({
      requests: listResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List return requests failed:", error.message);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to retrieve return requests.",
      },
      { status: 500 }
    );
  }
}
