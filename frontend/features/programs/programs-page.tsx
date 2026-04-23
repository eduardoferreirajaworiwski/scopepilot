"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DefinitionList } from "@/components/shared/definition-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getApiErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { useFindingsQuery, useHypothesesQuery, useProgramsQuery } from "@/lib/api/hooks";
import { formatDateTime, formatRelativeCount } from "@/lib/format";

function csvToList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProgramsPage() {
  const queryClient = useQueryClient();
  const programsQuery = useProgramsQuery();
  const hypothesesQuery = useHypothesesQuery();
  const findingsQuery = useFindingsQuery();

  const [formState, setFormState] = useState({
    name: "",
    owner: "",
    description: "",
    allowed_domains: "",
    denied_domains: "",
    forbidden_techniques: "",
  });

  const createProgramMutation = useMutation({
    mutationFn: api.createProgram,
    onSuccess: async () => {
      setFormState({
        name: "",
        owner: "",
        description: "",
        allowed_domains: "",
        denied_domains: "",
        forbidden_techniques: "",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.programs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });

  if (programsQuery.isPending || hypothesesQuery.isPending || findingsQuery.isPending) {
    return (
      <LoadingState
        title="Loading programs"
        description="Fetching authorized program registry and related workflow counts."
      />
    );
  }

  if (programsQuery.error) {
    return (
      <ErrorState
        title="Programs could not be loaded"
        description={getApiErrorMessage(programsQuery.error)}
        onRetry={() => void programsQuery.refetch()}
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const hypotheses = hypothesesQuery.data ?? [];
  const findings = findingsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Authorized programs"
        description="Programs are the security boundary for everything else. This page keeps scope policy, ownership, and downstream activity visible without blending them into a generic dashboard."
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Program intake</p>
            <CardTitle>Create program</CardTitle>
            <CardDescription>
              Register a program with explicit scope policy before any target or hypothesis enters the workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createProgramMutation.mutate({
                  name: formState.name,
                  owner: formState.owner,
                  description: formState.description,
                  scope_policy: {
                    allowed_domains: csvToList(formState.allowed_domains),
                    denied_domains: csvToList(formState.denied_domains),
                    forbidden_techniques: csvToList(formState.forbidden_techniques),
                  },
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="program-name">Program name</Label>
                  <Input
                    id="program-name"
                    value={formState.name}
                    onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                    placeholder="Acme Public Bug Bounty"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="program-owner">Owner</Label>
                  <Input
                    id="program-owner"
                    value={formState.owner}
                    onChange={(event) => setFormState({ ...formState, owner: event.target.value })}
                    placeholder="Security Operations"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-description">Description</Label>
                <Textarea
                  id="program-description"
                  value={formState.description}
                  onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                  placeholder="Operator notes, scope summary, disclosure workflow."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowed-domains">Allowed domains</Label>
                <Input
                  id="allowed-domains"
                  value={formState.allowed_domains}
                  onChange={(event) => setFormState({ ...formState, allowed_domains: event.target.value })}
                  placeholder="example.com, api.example.com"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="denied-domains">Denied domains</Label>
                  <Input
                    id="denied-domains"
                    value={formState.denied_domains}
                    onChange={(event) => setFormState({ ...formState, denied_domains: event.target.value })}
                    placeholder="admin.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forbidden-techniques">Forbidden techniques</Label>
                  <Input
                    id="forbidden-techniques"
                    value={formState.forbidden_techniques}
                    onChange={(event) => setFormState({ ...formState, forbidden_techniques: event.target.value })}
                    placeholder="mass_scan, brute_force"
                  />
                </div>
              </div>
              {createProgramMutation.error ? (
                <p className="text-sm text-rose-200">{getApiErrorMessage(createProgramMutation.error)}</p>
              ) : null}
              {createProgramMutation.isSuccess ? (
                <p className="text-sm text-emerald-200">Program created and scope policy registered.</p>
              ) : null}
              <Button type="submit" disabled={createProgramMutation.isPending}>
                {createProgramMutation.isPending ? "Creating program..." : "Create program"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Scope posture</p>
            <CardTitle>Program-level boundaries</CardTitle>
            <CardDescription>
              These counts help the operator see how much workflow activity exists per program without losing the scope context.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                { label: "Programs", value: formatRelativeCount(programs.length, "program") },
                {
                  label: "Hypotheses",
                  value: formatRelativeCount(hypotheses.length, "hypothesis"),
                },
                {
                  label: "Findings",
                  value: formatRelativeCount(findings.length, "finding"),
                },
                {
                  label: "Operators",
                  value: formatRelativeCount(new Set(programs.map((item) => item.owner)).size, "owner"),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          title="No programs registered"
          description="Create the first authorized program to make scope explicit before targets and hypotheses are introduced."
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {programs.map((program) => {
          const relatedHypotheses = hypotheses.filter((hypothesis) => hypothesis.program_id === program.id);
          const relatedFindings = findings.filter((finding) => finding.program_id === program.id);

          return (
            <Card key={program.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="approved" label="Authorized program" />
                  <StatusBadge
                    status={program.scope_policy.allowed_domains.length > 0 ? "confirmed" : "draft"}
                    label={
                      program.scope_policy.allowed_domains.length > 0
                        ? "Explicit allowlist"
                        : "Open scope policy"
                    }
                  />
                </div>
                <CardTitle>{program.name}</CardTitle>
                <CardDescription>{program.description || "No description provided."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DefinitionList
                  items={[
                    { label: "Owner", value: program.owner },
                    { label: "Created", value: formatDateTime(program.created_at) },
                    {
                      label: "Allowed domains",
                      value: formatRelativeCount(program.scope_policy.allowed_domains.length, "entry"),
                    },
                    {
                      label: "Findings",
                      value: formatRelativeCount(relatedFindings.length, "finding"),
                    },
                  ]}
                />
                <div className="subpanel p-4">
                  <div className="text-sm font-medium text-white">Workflow activity</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    {formatRelativeCount(relatedHypotheses.length, "hypothesis")} currently reference this program.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/programs/${program.id}`} className={buttonVariants({ variant: "outline" })}>
                    Open program detail
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
