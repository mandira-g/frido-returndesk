
import { NextResponse } from "next/server";
import pool from "@/lib/db";

const allowedTransitions = {
  Open: ["In Review"],
  "In Review": ["Approved", "Rejected"],
  Approved: ["Completed"],
  Rejected: [],
  Completed: [],
};

const allowedResolutions = ["Refund", "Replacement", "Store Credit"];

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const requestId = Number(id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST_ID",
          message: "Request ID must be a positive integer.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT id, reference, customer_name, customer_email,
              order_number, item_name, quantity, reason,
              status, resolution, refund_amount,
              created_at, updated_at
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE`,
      [requestId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        {
          error: "REQUEST_NOT_FOUND",
          message: "Return request was not found.",
        },
        { status: 404 }
      );
    }

    const notesResult = await pool.query(
      `SELECT id, request_id, note, created_at
       FROM public.return_notes
       WHERE request_id = $1
       ORDER BY created_at ASC, id ASC`,
      [requestId]
    );

    return NextResponse.json({
      request: result.rows[0],
      notes: notesResult.rows,
    });
  } catch (error) {
    console.error("Get return request failed:", error.message);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to retrieve return request details.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  let body;

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

  const { id } = await params;
  const requestId = Number(id);
  const { status, resolution, refund_amount } = body ?? {};

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST_ID",
        message: "Request ID must be a positive integer.",
      },
      { status: 400 }
    );
  }

  if (
    typeof status !== "string" ||
    !Object.hasOwn(allowedTransitions, status)
  ) {
    return NextResponse.json(
      {
        error: "INVALID_STATUS",
        message: "Provide a valid target status.",
      },
      { status: 400 }
    );
  }

  if (
    status === "Approved" &&
    !allowedResolutions.includes(resolution)
  ) {
    return NextResponse.json(
      {
        error: "INVALID_RESOLUTION",
        message: "Approval requires Refund, Replacement, or Store Credit.",
      },
      { status: 400 }
    );
  }

  if (
    status === "Approved" &&
    resolution === "Refund" &&
    (typeof refund_amount !== "number" ||
      !Number.isFinite(refund_amount) ||
      refund_amount <= 0)
  ) {
    return NextResponse.json(
      {
        error: "INVALID_REFUND_AMOUNT",
        message: "Refund amount must be greater than zero.",
      },
      { status: 400 }
    );
  }

  if (
    status === "Approved" &&
    resolution !== "Refund" &&
    refund_amount !== undefined &&
    refund_amount !== null
  ) {
    return NextResponse.json(
      {
        error: "REFUND_AMOUNT_NOT_ALLOWED",
        message: "Only Refund resolutions may have a refund amount.",
      },
      { status: 400 }
    );
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT id, status, resolution, refund_amount
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE
       FOR UPDATE`,
      [requestId]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "REQUEST_NOT_FOUND",
          message: "Return request was not found.",
        },
        { status: 404 }
      );
    }

    const currentRequest = currentResult.rows[0];
    const currentStatus = currentRequest.status;

    if (!allowedTransitions[currentStatus].includes(status)) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "INVALID_STATUS_TRANSITION",
          message: `Cannot change status from ${currentStatus} to ${status}.`,
        },
        { status: 409 }
      );
    }

    // Save resolution details when approving.
    // Preserve them when moving from Approved to Completed.
    const resolutionValue =
      status === "Approved"
        ? resolution
        : currentRequest.resolution;

    const refundValue =
      status === "Approved"
        ? resolution === "Refund"
          ? refund_amount
          : null
        : currentRequest.refund_amount;

    const updatedResult = await client.query(
      `UPDATE public.return_requests
       SET status = $1,
           resolution = $2,
           refund_amount = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, reference, status, resolution,
                 refund_amount, updated_at`,
      [status, resolutionValue, refundValue, requestId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Return request status updated successfully.",
      request: updatedResult.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction may already have rolled back.
      }
      
    }

    console.error("Update request status failed:", error.message);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to update request status.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const requestId = Number(id);

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST_ID",
        message: "Request ID must be a positive integer.",
      },
      { status: 400 }
    );
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, status
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE
       FOR UPDATE`,
      [requestId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "REQUEST_NOT_FOUND",
          message: "Return request was not found.",
        },
        { status: 404 }
      );
    }

    const currentRequest = result.rows[0];

    if (!["Open", "Rejected"].includes(currentRequest.status)) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "REQUEST_CANNOT_BE_REMOVED",
          message: "Only Open or Rejected requests can be removed.",
        },
        { status: 409 }
      );
    }

    await client.query(
      `UPDATE public.return_requests
       SET is_removed = TRUE,
           updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Return request removed successfully.",
      id: requestId,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The transaction may already have rolled back.
      }
    }

    console.error("Remove return request failed:", error.message);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to remove the return request.",
      },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
