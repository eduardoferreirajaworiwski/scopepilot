const output = document.querySelector("#output");

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_error) {
    data = { raw: text };
  }

  if (!response.ok) {
    throw { status: response.status, data };
  }
  return data;
}

function render(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

function csvToList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

document.querySelector("#program-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    name: form.name.value,
    description: form.description.value,
    owner: form.owner.value,
    scope_policy: {
      allowed_domains: csvToList(form.allowed_domains.value),
      forbidden_keywords: csvToList(form.forbidden_keywords.value),
    },
  };
  try {
    render(await fetchJson("/api/programs", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#target-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    program_id: Number(form.program_id.value),
    identifier: form.identifier.value,
    target_type: form.target_type.value,
    created_by: form.created_by.value,
  };
  try {
    render(await fetchJson("/api/targets", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#recon-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    target_id: Number(form.target_id.value),
    analyst: form.analyst.value,
  };
  try {
    render(await fetchJson("/api/recon/run", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#hypothesis-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const reconRecordId = form.recon_record_id.value ? Number(form.recon_record_id.value) : null;
  const payload = {
    target_id: Number(form.target_id.value),
    created_by: form.created_by.value,
    title: form.title.value || null,
    description: form.description.value || null,
    severity: form.severity.value || "medium",
    recon_record_id: reconRecordId,
  };
  try {
    render(await fetchJson("/api/hypotheses", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#approval-request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const hypothesisId = Number(form.hypothesis_id.value);
  const payload = { requested_by: form.requested_by.value };
  try {
    render(
      await fetchJson(`/api/hypotheses/${hypothesisId}/approvals`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  } catch (error) {
    render(error);
  }
});

document.querySelector("#approval-decision-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const approvalId = Number(form.approval_id.value);
  const payload = {
    status: form.status.value,
    approver: form.approver.value,
    reason: form.reason.value,
  };
  try {
    render(
      await fetchJson(`/api/approvals/${approvalId}/decide`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  } catch (error) {
    render(error);
  }
});

document.querySelector("#execution-request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    hypothesis_id: Number(form.hypothesis_id.value),
    requested_by: form.requested_by.value,
    action_plan: form.action_plan.value,
  };
  try {
    render(await fetchJson("/api/executions", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#execution-dispatch-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = { operator: form.operator.value };
  try {
    render(await fetchJson("/api/executions/queue/next", { method: "POST", body: JSON.stringify(payload) }));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#execution-complete-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const executionId = Number(form.execution_id.value);
  const evidenceContent = form.evidence_content.value.trim();

  const payload = {
    actor: form.actor.value,
    output_summary: form.output_summary.value,
    evidence: evidenceContent
      ? [{ evidence_type: "note", content: evidenceContent, artifact_uri: null }]
      : [],
  };

  try {
    render(
      await fetchJson(`/api/executions/${executionId}/complete`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-programs").addEventListener("click", async () => {
  try {
    render(await fetchJson("/api/programs"));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-targets").addEventListener("click", async () => {
  try {
    const programId = Number(document.querySelector("#program-id-query").value);
    if (!programId) {
      render({ error: "Informe Program ID para listar targets." });
      return;
    }
    render(await fetchJson(`/api/programs/${programId}/targets`));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-hypotheses").addEventListener("click", async () => {
  try {
    render(await fetchJson("/api/hypotheses"));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-approvals").addEventListener("click", async () => {
  try {
    render(await fetchJson("/api/approvals"));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-executions").addEventListener("click", async () => {
  try {
    render(await fetchJson("/api/executions"));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-findings").addEventListener("click", async () => {
  try {
    render(await fetchJson("/api/findings"));
  } catch (error) {
    render(error);
  }
});

document.querySelector("#load-audit").addEventListener("click", async () => {
  try {
    render(await fetchJson("/api/audit/decisions"));
  } catch (error) {
    render(error);
  }
});

