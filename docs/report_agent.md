# Report Agent

## Objetivo
Gerar drafts profissionais de bug bounty report a partir de evidências confirmadas, sem exagerar conclusões nem misturar observação com inferência.

## Entradas
- `finding`
- `evidence`
- `impact`
- `steps`
- `program_context`

## Saída
- `title`
- `summary`
- `impact`
- `steps_to_reproduce`
- `evidence`
- `remediation_notes`
- `markdown_export`
- `json_export`

## Garantias
- O agente usa apenas dados estruturados fornecidos.
- O modo padrão é `offline_deterministic`, adequado para demo e desenvolvimento local.
- A saída marca explicitamente o que é `Evidence:` e o que é `Inference:`.
- O draft em Markdown é armazenado separadamente da evidência bruta.

## Templates
- [app/templates/report_agent/bug_bounty_report.md.tmpl](/home/eduardo/projects/scopepilot/app/templates/report_agent/bug_bounty_report.md.tmpl)
- [app/templates/report_agent/bug_bounty_report.json.tmpl](/home/eduardo/projects/scopepilot/app/templates/report_agent/bug_bounty_report.json.tmpl)

