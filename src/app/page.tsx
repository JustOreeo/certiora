import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">Certiora</h1>
        <p className="text-xl text-gray-600 mb-8">
          Multi-tenant EdTech Assessment Platform
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
