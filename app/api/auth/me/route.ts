import { getCurrentUser } from "@/app/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return user ? Response.json({ user }) : Response.json({ error: "Not signed in." }, { status: 401 });
  } catch {
    return Response.json({ error: "Unable to verify your session." }, { status: 500 });
  }
}
