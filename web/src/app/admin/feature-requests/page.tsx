"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, X, Eye } from "lucide-react";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  upvotes: number;
  created_at: string;
  user_id: string;
}

export default function AdminFeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<FeatureRequest | null>(
    null
  );
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feature-requests?limit=500");
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (requestId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      // This would need a new admin API endpoint
      // For now, this is a placeholder
      console.log(`Would update ${requestId} to ${newStatus}`);
      // After API call, update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: newStatus } : r
        )
      );
      setUpdatingStatus(false);
    } catch (err) {
      console.error("Failed to update status:", err);
      setUpdatingStatus(false);
    }
  };

  const statusColors: Record<string, string> = {
    submitted: "bg-blue-500/15 text-blue-400",
    "in-progress": "bg-amber-500/15 text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-400",
    declined: "bg-red-500/15 text-red-400",
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Feature Requests
          </h1>
          <p className="text-muted-foreground">
            Admin dashboard: manage feature requests from users
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Requests List */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border p-4">
                  <h2 className="font-semibold">
                    All Requests ({requests.length})
                  </h2>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {requests.map((request) => (
                    <button
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                        selectedRequest?.id === request.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-sm line-clamp-2">
                          {request.title}
                        </h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                            statusColors[request.status] ||
                            "bg-gray-500/15 text-gray-400"
                          }`}
                        >
                          {request.status === "in-progress"
                            ? "In Progress"
                            : request.status.charAt(0).toUpperCase() +
                              request.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>👍 {request.upvotes} upvotes</span>
                        <span>{request.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Detail View */}
            <div>
              {selectedRequest ? (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold mb-4">{selectedRequest.title}</h3>

                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">
                        Description
                      </p>
                      <p className="text-foreground">
                        {selectedRequest.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">
                          Upvotes
                        </p>
                        <p className="text-lg font-bold">
                          {selectedRequest.upvotes}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">
                          Category
                        </p>
                        <p className="font-medium">{selectedRequest.category}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-xs mb-2">Status</p>
                      <div className="space-y-2">
                        {["submitted", "in-progress", "completed", "declined"].map(
                          (s) => (
                            <button
                              key={s}
                              onClick={() => updateStatus(selectedRequest.id, s)}
                              disabled={updatingStatus}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                selectedRequest.status === s
                                  ? "bg-primary/20 border border-primary text-primary font-medium"
                                  : "border border-border hover:bg-muted"
                              }`}
                            >
                              {s === "in-progress"
                                ? "In Progress"
                                : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border text-xs text-muted-foreground">
                      <p>Submitted: {new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <Eye className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Select a request to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
