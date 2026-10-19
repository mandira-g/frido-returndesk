
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(request, { params }) {
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
  const note = body?.note;

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST_ID",
        message: "Request ID must be a positive integer.",
      },
      { status: 400 }
    );
  }

  if (typeof note !== "string" || !note.trim()) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Note cannot be empty.",
      },
      { status: 400 }
    );
  }

  try {
    const existing = await pool.query(
      `SELECT id
       FROM public.return_requests
       WHERE id = $1 AND is_removed = FALSE`,
      [requestId]
    );

    if (existing.rowCount === 0) {
      return NextResponse.json(
        {
          error: "REQUEST_NOT_FOUND",
          message: "Return request was not found.",
        },
        { status: 404 }
      );
    }

    const result = await pool.query(
      `INSERT INTO public.return_notes (request_id, note)
       VALUES ($1, $2)
       RETURNING id, request_id, note, created_at`,
      [requestId, note.trim()]
    );

    return NextResponse.json(
      {
        message: "Note added successfully.",
        note: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add note failed:", error.message);

    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Unable to add note.",
      },
      { status: 500 }
    );
  }
}
