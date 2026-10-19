
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    return NextResponse.json({
      success: true,
      message: "ReturnDesk database connection successful",
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
  console.error("Database connection test failed:", error);

  return NextResponse.json(
    {
      success: false,
      error: "Database connection failed. Check the server terminal.",
    },
    { status: 500 }
  );
  }
}
