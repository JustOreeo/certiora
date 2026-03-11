import Link from "next/link";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-error-bg border border-error-border flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#DC2626"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-heading mb-2">
          Account Suspended
        </h1>
        <p className="text-sm text-secondary mb-6">
          This account has been temporarily suspended. No data has been deleted.
          Please contact{" "}
          <a
            href="mailto:support@certiora.com"
            className="text-primary hover:text-primary-hover font-medium"
          >
            support@certiora.com
          </a>{" "}
          for assistance.
        </p>
        <Link
          href="/login"
          className="inline-flex h-9 items-center px-5 rounded-lg text-sm font-medium border border-border text-body hover:bg-surface-card transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
