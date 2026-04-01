if (!process.env.NEXTAUTH_URL) {
  console.warn("[email] NEXTAUTH_URL not set — invitation links will use http://localhost:3000");
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0D0D12;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="40" height="40" rx="10" fill="#0D0D12"/>
                      <path d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
                      <path d="M16 19.5L18.5 22L24 17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #E4E4E7;padding:40px 36px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#A1A1AA;">
                Certiora &mdash; You received this because you were invited to the platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function primaryButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="background:#4B4EFC;border-radius:10px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function fallbackLink(href: string): string {
  return `<p style="margin:20px 0 0;font-size:12px;color:#71717A;">
    If the button doesn't work, copy and paste this link into your browser:<br/>
    <a href="${href}" style="color:#4B4EFC;word-break:break-all;">${href}</a>
  </p>`;
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function adminInvitationEmail(opts: {
  email: string;
  tenantName: string;
  inviterName: string | null;
  token: string;
  expiresAt: Date;
}) {
  const url = `${getBaseUrl()}/accept-invitation?token=${opts.token}`;
  const expiry = opts.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return {
    subject: `You're invited to set up ${opts.tenantName} on Certiora`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0D0D12;">You've been invited</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#52525B;">
        ${opts.inviterName ? `<strong>${opts.inviterName}</strong> has invited you` : "You've been invited"} to set up
        <strong>${opts.tenantName}</strong> as an administrator on Certiora.
      </p>
      <p style="margin:0;font-size:14px;color:#71717A;">
        Click the button below to create your account and configure your review center.
        This invitation expires on <strong>${expiry}</strong>.
      </p>
      ${primaryButton(url, "Accept invitation")}
      ${fallbackLink(url)}
    `),
  };
}

export function studentInvitationEmail(opts: {
  email: string;
  tenantName: string;
  inviterName: string | null;
  token: string;
  expiresAt: Date;
}) {
  const url = `${getBaseUrl()}/accept-invitation?token=${opts.token}`;
  const expiry = opts.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return {
    subject: `You've been invited to ${opts.tenantName} on Certiora`,
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0D0D12;">You've been invited</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#52525B;">
        ${opts.inviterName ? `<strong>${opts.inviterName}</strong> has invited you` : "You've been invited"} to join
        <strong>${opts.tenantName}</strong> as a student on Certiora.
      </p>
      <p style="margin:0;font-size:14px;color:#71717A;">
        Click the button below to create your account and start learning.
        This invitation expires on <strong>${expiry}</strong>.
      </p>
      ${primaryButton(url, "Accept invitation")}
      ${fallbackLink(url)}
    `),
  };
}

export function welcomeEmail(opts: { name: string; role: "ADMIN" | "STUDENT"; tenantName: string | null }) {
  const loginUrl = `${getBaseUrl()}/login`;
  const roleLabel = opts.role === "ADMIN" ? "administrator" : "student";
  const context = opts.tenantName ? ` at <strong>${opts.tenantName}</strong>` : "";

  return {
    subject: "Welcome to Certiora — your account is ready",
    html: layout(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0D0D12;">Welcome, ${opts.name}!</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#52525B;">
        Your Certiora account has been created. You're now ${roleLabel === "administrator" ? "an" : "a"} ${roleLabel}${context}.
      </p>
      <p style="margin:0;font-size:14px;color:#71717A;">
        Sign in with your email and the password you just set.
      </p>
      ${primaryButton(loginUrl, "Sign in to Certiora")}
    `),
  };
}
