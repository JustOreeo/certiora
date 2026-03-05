"use client";

import { useEffect, useState } from "react";

type TenantAdmin = { id: string; email: string; name: string | null };
type Tenant = {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  users: TenantAdmin[];
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/tenants")
      .then((r) => r.json())
      .then((data) => {
        setTenants(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <a
          href="/super-admin/invitations"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          + Invite New Admin
        </a>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No tenants yet. Invite an admin to create the first tenant.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{tenant.name}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{tenant.slug}</td>
                  <td className="px-4 py-3">
                    {tenant.users[0] ? (
                      <div>
                        <div>{tenant.users[0].name}</div>
                        <div className="text-gray-400 text-xs">{tenant.users[0].email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">No admin yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
