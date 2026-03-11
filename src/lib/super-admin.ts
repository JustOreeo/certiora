import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSuperAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") return null;
  return session;
}
