import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import Papa from "papaparse";

function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

type CsvRow = {
  studentId: string;
  name: string;
  email?: string;
  credentialsExpiresAt: string;
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.tenantId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: "CSV parsing failed", details: parsed.errors }, { status: 400 });
    }

    const results: Array<{ studentId: string; name: string; username: string; password: string; error?: string }> = [];
    const seenStudentIds = new Set<string>();

    for (const row of parsed.data) {
      if (!row.studentId || !row.name || !row.credentialsExpiresAt) {
        continue;
      }

      if (seenStudentIds.has(row.studentId)) {
        results.push({
          studentId: row.studentId,
          name: row.name,
          username: row.email || `${row.studentId}@student.local`,
          password: "(duplicate studentId in file)",
          error: "Duplicate studentId in CSV",
        });
        continue;
      }
      seenStudentIds.add(row.studentId);

      const email = row.email?.trim() || `${row.studentId}@student.local`;
      const existing = await prisma.user.findFirst({
        where: {
          tenantId: session.tenantId,
          OR: [{ studentId: row.studentId }, { email }],
        },
      });
      if (existing) {
        results.push({
          studentId: row.studentId,
          name: row.name,
          username: email,
          password: "(skipped: already exists)",
          error: "Duplicate studentId or email in tenant",
        });
        continue;
      }

      const password = generatePassword();
      const passwordHash = await hash(password, 10);
      const expiresAt = new Date(row.credentialsExpiresAt);

      await prisma.user.create({
        data: {
          tenantId: session.tenantId,
          studentId: row.studentId,
          email,
          name: row.name,
          role: "STUDENT",
          passwordHash,
          credentialsExpiresAt: expiresAt,
        },
      });

      results.push({
        studentId: row.studentId,
        name: row.name,
        username: email,
        password,
      });
    }

    return NextResponse.json({ success: true, students: results });
  } catch (error) {
    console.error("Bulk create students error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
