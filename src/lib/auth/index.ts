import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import type { Session } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tenantId: true, role: true },
        });
        if (dbUser) {
          (session as Session).tenantId = dbUser.tenantId;
          (session as Session).role = dbUser.role;
        }
      }
      return session;
    },
  },
  providers: [
    // Placeholder: replace with real providers (Google, GitHub, or Credentials with tenant slug).
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" }, tenantSlug: { label: "Tenant", type: "text" } },
      async authorize() {
        return null;
      },
    }),
  ],
};
