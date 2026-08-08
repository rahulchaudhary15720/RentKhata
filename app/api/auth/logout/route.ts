import { clearSession } from "@/app/lib/auth";

export async function POST() {
  try {
    await clearSession();
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Unable to sign out." }, { status: 500 });
  }
}
