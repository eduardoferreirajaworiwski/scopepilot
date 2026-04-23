"use client";

import { useDeferredValue, useState } from "react";

import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAuditTrailQuery } from "@/lib/api/hooks";
import { formatDateTime, humanizeToken } from "@/lib/format";

function formatMetadataValue(value: unknown) {
  if (value == null) {
    return "n/a";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((item) => String(item)).join(", ") : "empty";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function MetadataCell({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return <span className="text-xs text-[var(--muted-foreground)]">No metadata</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex max-w-sm flex-wrap gap-2">
        {entries.slice(0, 4).map(([key, value]) => (
          <span
            key={key}
            className="rounded-full border border-[var(--border-subtle)] bg-white/[0.04] px-2.5 py-1 text-xs text-[var(--muted-foreground)]"
            title={formatMetadataValue(value)}
          >
            <span className="text-[var(--foreground)]">{humanizeToken(key)}:</span>{" "}
            {formatMetadataValue(value).slice(0, 48)}
          </span>
        ))}
      </div>
      <details className="text-xs text-[var(--muted-foreground)]">
        <summary className="cursor-pointer text-[var(--foreground)]">Raw JSON</summary>
        <pre className="mt-2 max-w-sm whitespace-pre-wrap break-words leading-6">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AuditPage() {
  const auditQuery = useAuditTrailQuery();
  const [entityFilter, setEntityFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  if (auditQuery.isPending) {
    return (
      <LoadingState
        title="Loading audit trail"
        description="Fetching durable decisions and actor context from the backend."
      />
    );
  }

  if (auditQuery.error) {
    return (
      <ErrorState
        title="Audit trail could not be loaded"
        description={getApiErrorMessage(auditQuery.error)}
        onRetry={() => void auditQuery.refetch()}
      />
    );
  }

  const auditTrail = auditQuery.data ?? [];
  const entityTypes = Array.from(new Set(auditTrail.map((event) => event.entity_type))).sort();
  const decisions = Array.from(new Set(auditTrail.map((event) => event.decision))).sort();
  const filteredEvents = auditTrail.filter((event) => {
    const matchesEntity = entityFilter === "all" || event.entity_type === entityFilter;
    const matchesDecision = decisionFilter === "all" || event.decision === decisionFilter;
    const needle = deferredSearch.toLowerCase();
    const matchesSearch =
      needle.length === 0 ||
      event.event_type.toLowerCase().includes(needle) ||
      event.reason.toLowerCase().includes(needle) ||
      event.actor.toLowerCase().includes(needle);

    return matchesEntity && matchesDecision && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        description="Every meaningful state transition should be reconstructible from this page. Actor, entity, decision, reason, and metadata remain visible without collapsing into opaque activity logs."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Events"
          value={String(auditTrail.length)}
          description="Durable audit records captured by the backend."
          tone="info"
        />
        <MetricCard
          label="Blocked"
          value={String(auditTrail.filter((event) => event.decision === "blocked").length)}
          description="Scope or approval gate blocks recorded explicitly."
          tone="danger"
        />
        <MetricCard
          label="Approved"
          value={String(auditTrail.filter((event) => event.decision === "approved").length)}
          description="Human approvals and accepted transitions."
          tone="success"
        />
        <MetricCard
          label="Executed"
          value={String(auditTrail.filter((event) => event.decision === "executed").length)}
          description="Execution-related completion markers."
          tone="accent"
        />
      </div>

      <Card>
        <CardHeader>
          <p className="eyebrow">Filters</p>
          <CardTitle>Reconstruct specific paths</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[0.8fr_0.8fr_1.4fr]">
          <div className="space-y-2">
            <Label htmlFor="audit-entity">Entity type</Label>
            <NativeSelect id="audit-entity" value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
              <option value="all">All entities</option>
              {entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {humanizeToken(entityType)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-decision">Decision</Label>
            <NativeSelect
              id="audit-decision"
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value)}
            >
              <option value="all">All decisions</option>
              {decisions.map((decision) => (
                <option key={decision} value={decision}>
                  {humanizeToken(decision)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-search">Search</Label>
            <Input
              id="audit-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actor, event type, or reason"
            />
          </div>
        </CardContent>
      </Card>

      {filteredEvents.length === 0 ? (
        <EmptyState
          title="No audit records match the current filter"
          description="Change the filters to inspect a different slice of the workflow history."
        />
      ) : (
        <Card>
          <CardHeader>
            <p className="eyebrow">Event list</p>
            <CardTitle>Durable decision history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Metadata</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="font-medium text-white">{event.event_type}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {event.entity_type} #{event.entity_id ?? "n/a"}
                      </div>
                    </TableCell>
                    <TableCell>{event.actor}</TableCell>
                    <TableCell>
                      <StatusBadge status={event.decision} />
                    </TableCell>
                    <TableCell className="max-w-md text-[var(--muted-foreground)]">{event.reason}</TableCell>
                    <TableCell className="max-w-sm">
                      <MetadataCell metadata={event.metadata_json} />
                    </TableCell>
                    <TableCell>{formatDateTime(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
