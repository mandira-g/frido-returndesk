
const { Pool } = require("pg");
const { randomUUID } = require("crypto");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Check your .env.local file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const reasons = [
  "Damaged",
  "Wrong Item",
  "Size Issue",
  "Not As Described",
  "Changed Mind",
];

const statuses = [
  "Open",
  "In Review",
  "Approved",
  "Rejected",
  "Completed",
];

const resolutions = ["Refund", "Replacement", "Store Credit"];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.return_requests
       WHERE order_number LIKE 'SEED-RET-%'`
    );

    if (existing.rows[0].count > 0) {
      throw new Error(
        "Seed records already exist. No data was changed."
      );
    }

    for (let i = 1; i <= 50; i++) {
      const status = statuses[(i - 1) % statuses.length];
      const reason = reasons[(i - 1) % reasons.length];

      let resolution = null;
      let refundAmount = null;

      if (status === "Approved" || status === "Completed") {
        resolution = resolutions[(i - 1) % resolutions.length];

        if (resolution === "Refund") {
          refundAmount = 500 + i * 25;
        }
      }

      const reference =
        `RET-${new Date().getFullYear()}-${randomUUID()
          .slice(0, 8)
          .toUpperCase()}`;

      const result = await client.query(
        `INSERT INTO public.return_requests (
          reference,
          customer_name,
          customer_email,
          order_number,
          item_name,
          quantity,
          reason,
          status,
          resolution,
          refund_amount
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, reference`,
        [
          reference,
          `Seed Customer ${String(i).padStart(2, "0")}`,
          `seed${i}@example.com`,
          `SEED-RET-${String(i).padStart(3, "0")}`,
          [
            "Ergonomic Seat Cushion",
            "Memory Foam Cushion",
            "Back Support Cushion",
          ][(i - 1) % 3],
          (i % 3) + 1,
          reason,
          status,
          resolution,
          refundAmount,
        ]
      );

      if (i % 3 === 0) {
        await client.query(
          `INSERT INTO public.return_notes (request_id, note)
           VALUES ($1, $2)`,
          [
            result.rows[0].id,
            `Seed note: Request reviewed for testing. Current status: ${status}.`,
          ]
        );
      }
    }

    await client.query("COMMIT");

    console.log("Seed completed successfully.");
    console.log("Created 50 return requests.");
    console.log("Covered all five statuses and all five reasons.");
    console.log("Added notes to 16 requests.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
