import { initializeDb } from "@/db";

export async function GET() {
  try {
    await initializeDb();
    return Response.json({ status: "ok", database: "connected" });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        database: "unavailable",
        message: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 },
    );
  }
}
