"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureRequestModal } from "@/components/feature-request-modal";
import { cn } from "@/lib/utils";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  upvotes: number;
  created_at: string;
  user_voted?: boolean;
}

export default function FeatureRequestsPage() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("submitted");
  const [sort, setSort] = useState("upvotes");
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRequests();
  }, [status, sort]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/feature-requests?status=${status}&sort=${sort}`
      );
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

  const handleVote = async (requestId: string, hasVoted: boolean) => {
    try {
      const method = hasVoted ? "DELETE" : "POST";
      const res = await fetch("/api/feature-requests/vote", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (res.ok) {
        // Update local state
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  upvotes: hasVoted ? r.upvotes - 1 : r.upvotes + 1,
                  user_voted: !hasVoted,
                }
              : r
          )
        );

        // Update vote tracking
        if (hasVoted) {
          userVotes.delete(requestId);
        } else {
          userVotes.add(requestId);
        }
        setUserVotes(new Set(userVotes));
      }
    } catch (err) {
      console.error("Failed to vote:", err);
    }
  };

  const statusBadgeColor: Record<string, string> = {
    submitted: "bg-blue-500/15 text-blue-400",
    "in-progress": "bg-amber-500/15 text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-400",
    declined: "bg-red-500/15 text-red-400",
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Help Shape the Future
          </h1>
          <p className="text-muted-foreground">
            Vote on features you'd like to see next, or submit your own ideas.
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 flex-shrink-0"
        >
          <Plus className="h-5 w-5" />
          Submit Request
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="submitted">All Features</option>
          <option value="submitted">Submitted</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="declined">Declined</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="upvotes">Most Popular</option>
          <option value="newest">Newest First</option>
        </select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading feature requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No feature requests yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to submit an idea!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                {/* Voting sidebar */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleVote(request.id, userVotes.has(request.id))}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      userVotes.has(request.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    title={userVotes.has(request.id) ? "Remove vote" : "Upvote"}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold">{request.upvotes}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {request.title}
                      </h3>
                      {request.category && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {request.category}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded-full flex-shrink-0",
                        statusBadgeColor[request.status] ||
                          "bg-gray-500/15 text-gray-400"
                      )}
                    >
                      {request.status === "in-progress"
                        ? "In Progress"
                        : request.status.charAt(0).toUpperCase() +
                          request.status.slice(1)}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {request.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <FeatureRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchRequests}
      />
    </main>
  );
}
