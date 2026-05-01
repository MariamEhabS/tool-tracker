import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { isAdminUser } from "@/lib/adminWhitelist";
import {
  useAdminPresenceSocket,
  type EnrichedPresenceUser,
} from "@/hooks/useAdminPresenceSocket";
import { getStoredUser } from "@/utils/getStoredUser";

export const Route = createLazyFileRoute("/admin/online")({
  component: AdminOnline,
});

function AdminOnline() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { data, connected } = useAdminPresenceSocket({
    enabled: authorized === true,
  });

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!isAdminUser(storedUser?.email)) {
      setAuthorized(false);
      navigate({ to: "/dashboard" });
    } else {
      setAuthorized(true);
    }
  }, [navigate]);

  if (authorized === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Checking authorization...</div>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="h-full min-h-0 flex flex-col p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <i className="bx bx-wifi mr-2 text-indigo-600"></i>
            Users Online
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time view of users currently active on desktop and
            mobile-focused routes.
          </p>
        </div>
        <ConnectionBadge connected={connected} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <OnlineCountCard
          label="Desktop users online"
          value={data?.desktop ?? 0}
          loading={!data}
        />
        <OnlineCountCard
          label="Mobile users online"
          value={data?.mobile ?? 0}
          loading={!data}
        />
      </div>

      <OnlineUsersTable users={data?.users ?? []} loading={!data} />
    </main>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium select-none">
      <span
        className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`}
      />
      {connected ? "Live" : "Disconnected"}
    </div>
  );
}

function OnlineCountCard(props: {
  label: string;
  value: number;
  loading: boolean;
}) {
  const { label, value, loading } = props;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-4xl font-semibold text-gray-900">
        {loading ? "..." : value}
      </p>
    </div>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function OnlineUsersTable({
  users,
  loading,
}: {
  users: EnrichedPresenceUser[];
  loading: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...users].sort((a, b) => {
        // Sort by company name, then by last name
        const cmp = a.companyName.localeCompare(b.companyName);
        if (cmp !== 0) return cmp;
        return a.lastName.localeCompare(b.lastName);
      }),
    [users],
  );

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Email
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Company
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Route
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Platform
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">
              Last Seen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                Connecting...
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                No users online
              </td>
            </tr>
          ) : (
            sorted.map((user) => <UserRow key={user.sessionId} user={user} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user }: { user: EnrichedPresenceUser }) {
  const isAnon = user.firstName === "Anonymous";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">
        {isAnon ? (
          <span className="text-gray-400 italic">Anonymous</span>
        ) : (
          `${user.firstName} ${user.lastName}`
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {isAnon ? <span className="text-gray-300">&mdash;</span> : user.email}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {user.companyName || <span className="text-gray-300">&mdash;</span>}
      </td>
      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
        {user.routePath}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            user.isMobileRoute
              ? "bg-purple-100 text-purple-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {user.isMobileRoute ? "Mobile" : "Desktop"}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {formatRelativeTime(user.lastSeenAt)}
      </td>
    </tr>
  );
}
