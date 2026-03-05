import Link from "next/link";

function CertioraLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0D0D12" />
      <path
        d="M20 8L11 12V19C11 23.4 15 27.5 20 29C25 27.5 29 23.4 29 19V12L20 8Z"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 19.5L18.5 22L24 17"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface-base flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="flex justify-center mb-5">
          <CertioraLogo />
        </div>
        <h1 className="text-4xl font-bold text-heading tracking-tight mb-2">Certiora</h1>
        <p className="text-base text-secondary mb-8">
          Multi-tenant EdTech Assessment Platform
        </p>
        <Link
          href="/login"
          className="inline-flex h-11 items-center px-6 rounded-xl text-sm font-semibold bg-primary text-inverse hover:bg-primary-hover transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
