"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { useSessions } from "@/hooks/useSessions";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { sessions, isLoading } = useSessions();

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (status === "unauthenticated") {
    redirect("/auth/login");
  }

  const userSessions = sessions || [];
  const totalCorrections = userSessions.reduce(
    (acc, s) => acc + (s._count?.corrections || 0),
    0
  );
  const totalDetections = userSessions.reduce(
    (acc, s) => acc + (s._count?.detections || 0),
    0
  );

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold">
              Systems Trader
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/sessions/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Session
            </Link>
            <div className="relative group">
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-800 transition-colors">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || ""}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
                    {session?.user?.name?.charAt(0) || "U"}
                  </div>
                )}
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 rounded-lg shadow-xl border border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-3 border-b border-gray-800">
                  <div className="font-medium text-sm">{session?.user?.name}</div>
                  <div className="text-xs text-gray-500 truncate">{session?.user?.email}</div>
                </div>
                <div className="p-1">
                  <Link
                    href="/account"
                    className="block px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Account Settings
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Welcome back, {session?.user?.name?.split(" ")[0] || "Trader"}
          </h1>
          <p className="text-gray-400">
            Track your pattern validation progress and contribute to improving detection algorithms.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Total Sessions</div>
            <div className="text-2xl font-bold">{userSessions.length}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Detections Reviewed</div>
            <div className="text-2xl font-bold">{totalDetections}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Corrections Made</div>
            <div className="text-2xl font-bold">{totalCorrections}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-gray-400 text-sm mb-1">Accuracy Impact</div>
            <div className="text-2xl font-bold text-green-400">
              {totalCorrections > 0 ? `+${(totalCorrections * 0.1).toFixed(1)}%` : "-"}
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-gray-900 rounded-lg border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold">Recent Sessions</h2>
            <Link
              href="/sessions"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading sessions...
              </div>
            ) : userSessions.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-gray-400 mb-3">No sessions yet</div>
                <Link
                  href="/sessions/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create your first session
                </Link>
              </div>
            ) : (
              userSessions.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      s.status === "active" ? "bg-green-500" :
                      s.status === "completed" ? "bg-blue-500" : "bg-gray-500"
                    }`} />
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm text-gray-500">
                        {s.symbol}/{s.timeframe.toUpperCase()} - {s._count?.detections || 0} detections
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(s.updatedAt)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/sessions/new"
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-blue-600 transition-colors group"
          >
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-600/30 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="font-medium mb-1">New Session</div>
            <div className="text-sm text-gray-500">Start validating patterns on a new chart</div>
          </Link>

          <Link
            href="/sessions"
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-purple-600 transition-colors group"
          >
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-600/30 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div className="font-medium mb-1">Browse Sessions</div>
            <div className="text-sm text-gray-500">View and continue existing sessions</div>
          </Link>

          <Link
            href="/account"
            className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-green-600 transition-colors group"
          >
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-600/30 transition-colors">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="font-medium mb-1">Account Settings</div>
            <div className="text-sm text-gray-500">Manage your profile and preferences</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
