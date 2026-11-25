import { NextResponse } from "next/server";

// This legacy endpoint used the retired tenants/staff_profiles schema and a
// service-role key. It is intentionally disabled until tenant provisioning is
// implemented against organizations/profiles with transactional rollback,
// abuse controls and verified email ownership.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is retired. Use the current PowerOS account onboarding flow." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
