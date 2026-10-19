
import { NextResponse } from "next/server";
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

const RESOLUTIONS = ["Refund", "Replacement", "Store Credit"];

const FINAL_STATUSES = ["Approved", "Rejected", "Completed"];

const ALLOWED_TRANSITIONS = {
  Open: ["In Review"],
  "In Review": ["Approved", "Rejected"],
  Approved: ["Completed"],
  Rejected: [],
  Completed: [],
};

const DETAIL_FIELDS = [
  "customer_name",
  "customer_email",
  "order_number",
  "item_name",
  "quantity",
  "reason",
];

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function errorResponse(error, message, status) {
  return NextResponse.json({ error, message }, { status });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET: Fetch one request and its notes.
export async function GET(request, { params }) {
  try {
    const { id: rawId } = await params;
    const id = validId(rawId);

    if (!id) {
      return errorResponse(
        "INVALID_REQUEST_ID",
        "A valid request ID is required.",
        400
      );
    }

    const result = await pool.query(
      `SELECT *
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE`,
      [id]
    );

    if (result.rowCount === 0) {
      return errorResponse(
        "REQUEST_NOT_FOUND",
        "The return request was not found.",
        404
      );
    }

    const notesResult = await pool.query(
      `SELECT id, request_id, note, created_at
       FROM public.return_notes
       WHERE request_id = $1
       ORDER BY created_at ASC, id ASC`,
      [id]
    );

    return NextResponse.json({
      request: result.rows[0],
      notes: notesResult.rows,
    });
  } catch (error) {
    console.error("Fetch return request failed:", error);

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Could not fetch the return request.",
      500
    );
  }
}

// PATCH: Update request details or change its status.
export async function PATCH(request, { params }) {
  let client;

  try {
    const { id: rawId } = await params;
    const id = validId(rawId);

    if (!id) {
      return errorResponse(
        "INVALID_REQUEST_ID",
        "A valid request ID is required.",
        400
      );
    }

    const body = await request.json();

    const allowedFields = [
      ...DETAIL_FIELDS,
      "status",
      "resolution",
      "refund_amount",
    ];

    const unknownFields = Object.keys(body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (unknownFields.length > 0) {
      return errorResponse(
        "INVALID_FIELDS",
        `Unsupported field(s): ${unknownFields.join(", ")}.`,
        400
      );
    }

    if (Object.keys(body).length === 0) {
      return errorResponse(
        "EMPTY_UPDATE",
        "Provide at least one field to update.",
        400
      );
    }

    const has = (field) =>
      Object.prototype.hasOwnProperty.call(body, field);

    for (const field of [
      "customer_name",
      "customer_email",
      "order_number",
      "item_name",
    ]) {
      if (has(field)) {
        if (
          typeof body[field] !== "string" ||
          !body[field].trim()
        ) {
          return errorResponse(
            "VALIDATION_ERROR",
            `${field} must be a non-empty string.`,
            400
          );
        }
      }
    }

    if (
      has("customer_email") &&
      !isValidEmail(body.customer_email.trim())
    ) {
      return errorResponse(
        "INVALID_EMAIL",
        "Provide a valid customer email address.",
        400
      );
    }

    if (
      has("quantity") &&
      (!Number.isInteger(body.quantity) || body.quantity <= 0)
    ) {
      return errorResponse(
        "INVALID_QUANTITY",
        "Quantity must be a positive integer.",
        400
      );
    }

    if (has("reason") && !REASONS.includes(body.reason)) {
      return errorResponse(
        "INVALID_REASON",
        "The selected return reason is invalid.",
        400
      );
    }

    if (has("status") && !STATUSES.includes(body.status)) {
      return errorResponse(
        "INVALID_STATUS",
        "The selected status is invalid.",
        400
      );
    }

    if (has("resolution") && !RESOLUTIONS.includes(body.resolution)) {
      return errorResponse(
        "INVALID_RESOLUTION",
        "Choose Refund, Replacement, or Store Credit.",
        400
      );
    }

    if (has("refund_amount")) {
      const amount = body.refund_amount;

      if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return errorResponse(
          "INVALID_REFUND_AMOUNT",
          "The refund amount must be a positive number.",
          400
        );
      }
    }

    client = await pool.connect();
    await client.query("BEGIN");

    // Lock the row so concurrent updates cannot bypass lifecycle rules.
    const currentResult = await client.query(
      `SELECT *
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE
       FOR UPDATE`,
      [id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        "REQUEST_NOT_FOUND",
        "The return request was not found.",
        404
      );
    }

    const current = currentResult.rows[0];
    const currentStatus = current.status;
    const nextStatus = has("status") ? body.status : currentStatus;

    const detailsChanged = DETAIL_FIELDS.some(has);

    // Customer and item details cannot be changed after a final decision.
    if (
      detailsChanged &&
      (FINAL_STATUSES.includes(currentStatus) ||
        FINAL_STATUSES.includes(nextStatus))
    ) {
      await client.query("ROLLBACK");

      return errorResponse(
        "REQUEST_DETAILS_LOCKED",
        "Customer and item details cannot be changed after approval, rejection, or completion.",
        409
      );
    }

    // Validate only actual status changes.
    if (
      has("status") &&
      nextStatus !== currentStatus &&
      !ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus)
    ) {
      await client.query("ROLLBACK");

      return errorResponse(
        "INVALID_STATUS_TRANSITION",
        `Cannot change status from ${currentStatus} to ${nextStatus}.`,
        409
      );
    }

    // Resolution and refund details are supplied when approving.
    if (nextStatus === "Approved" && currentStatus !== "Approved") {
      if (!has("status") || !has("resolution")) {
        await client.query("ROLLBACK");

        return errorResponse(
          "RESOLUTION_REQUIRED",
          "Choose a resolution when approving a request.",
          400
        );
      }

      if (
        body.resolution === "Refund" &&
        (!has("refund_amount") ||
          typeof body.refund_amount !== "number" ||
          !Number.isFinite(body.refund_amount) ||
          body.refund_amount <= 0)
      ) {
        await client.query("ROLLBACK");

        return errorResponse(
          "REFUND_AMOUNT_REQUIRED",
          "A refund requires a positive refund amount.",
          400
        );
      }

      if (
        body.resolution !== "Refund" &&
        has("refund_amount")
      ) {
        await client.query("ROLLBACK");

        return errorResponse(
          "REFUND_AMOUNT_NOT_ALLOWED",
          "A refund amount must not be recorded for Replacement or Store Credit.",
          400
        );
      }
    } else if (has("resolution") || has("refund_amount")) {
      await client.query("ROLLBACK");

      return errorResponse(
        "RESOLUTION_UPDATE_NOT_ALLOWED",
        "Resolution and refund details can only be supplied when approving a request.",
        400
      );
    }

    let nextResolution = current.resolution;
    let nextRefundAmount = current.refund_amount;

    if (nextStatus === "Approved" && currentStatus !== "Approved") {
      nextResolution = body.resolution;
      nextRefundAmount =
        body.resolution === "Refund" ? body.refund_amount : null;
    }

    // Rejected requests do not retain an approval resolution.
    if (nextStatus === "Rejected") {
      nextResolution = null;
      nextRefundAmount = null;
    }

    const updatedResult = await client.query(
      `UPDATE public.return_requests
       SET
         customer_name = $1,
         customer_email = $2,
         order_number = $3,
         item_name = $4,
         quantity = $5,
         reason = $6,
         status = $7,
         resolution = $8,
         refund_amount = $9,
         updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        has("customer_name")
          ? body.customer_name.trim()
          : current.customer_name,
        has("customer_email")
          ? body.customer_email.trim()
          : current.customer_email,
        has("order_number")
          ? body.order_number.trim()
          : current.order_number,
        has("item_name")
          ? body.item_name.trim()
          : current.item_name,
        has("quantity") ? body.quantity : current.quantity,
        has("reason") ? body.reason : current.reason,
        nextStatus,
        nextResolution,
        nextRefundAmount,
        id,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Return request updated successfully.",
      request: updatedResult.rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Update return request failed:", error);

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Could not update the return request.",
      500
    );
  } finally {
    client?.release();
  }
}

// DELETE: Soft-remove an Open or Rejected request.
export async function DELETE(request, { params }) {
  let client;

  try {
    const { id: rawId } = await params;
    const id = validId(rawId);

    if (!id) {
      return errorResponse(
        "INVALID_REQUEST_ID",
        "A valid request ID is required.",
        400
      );
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, status
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE
       FOR UPDATE`,
      [id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");

      return errorResponse(
        "REQUEST_NOT_FOUND",
        "The return request was not found.",
        404
      );
    }

    const current = result.rows[0];

    if (!["Open", "Rejected"].includes(current.status)) {
      await client.query("ROLLBACK");

      return errorResponse(
        "REQUEST_CANNOT_BE_REMOVED",
        "Only Open or Rejected requests can be removed.",
        409
      );
    }

    await client.query(
      `UPDATE public.return_requests
       SET is_removed = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Return request removed successfully.",
      id,
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Remove return request failed:", error);

    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Could not remove the return request.",
      500
    );
  } finally {
    client?.release();
  }
}
