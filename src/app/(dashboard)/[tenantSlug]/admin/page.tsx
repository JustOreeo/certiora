export default function AdminPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-heading">Overview</h1>
        <p className="text-sm text-secondary mt-1">Manage your review center from here.</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Students", value: "—" },
          { label: "Total Questions", value: "—" },
          { label: "Exams Completed", value: "—" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-card border border-border rounded-xl p-6 shadow-sm">
            <p className="text-xs font-medium text-secondary uppercase tracking-wide mb-2">{stat.label}</p>
            <p className="text-3xl font-semibold text-heading">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
