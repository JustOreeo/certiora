import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.role = user.role;
        token.credentialsExpiresAt = user.credentialsExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      // Block expired student credentials: invalidate session so API routes reject
      if (
        token.role === "STUDENT" &&
        token.credentialsExpiresAt &&
        new Date(token.credentialsExpiresAt as string) < new Date()
      ) {
        return { ...session, user: { ...session.user, id: "" }, expires: "1970-01-01" };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.tenantId = token.tenantId as string | undefined;
        session.tenantSlug = token.tenantSlug as string | undefined;
        session.role = token.role as string;
      }
      return session;
    },
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            tenantId: true,
            role: true,
            passwordHash: true,
            credentialsExpiresAt: true,
            tenant: { select: { slug: true } },
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (user.credentialsExpiresAt && user.credentialsExpiresAt < new Date()) {
          throw new Error("CredentialsExpired");
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        const userWithTenant = user as typeof user & { tenant?: { slug: string } };
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tenantId: user.tenantId ?? undefined,
          tenantSlug: userWithTenant.tenant?.slug ?? undefined,
          role: user.role,
          credentialsExpiresAt: user.credentialsExpiresAt?.toISOString() ?? undefined,
        };
      },
    }),
  ],
};
