import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    select: { isActive: true },
  });

  if (!tenant) return NextResponse.json({ isActive: true });

  return NextResponse.json({ isActive: tenant.isActive });
}
