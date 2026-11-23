"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function setBranchScope(v: string) {
  if (v !== "all" && !UUID.test(v)) return;
  cookies().set("pe_branch", v, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/", "layout");
}
