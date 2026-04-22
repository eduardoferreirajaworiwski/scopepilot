# Evidence Store

## Objetivo
Persistir trilha auditável do fluxo de bug bounty com separação clara entre:
- evidência bruta sanitizada
- snapshots de request/response
- snapshots de decisão
- findings persistidos
- drafts narrativos de report

## Componentes
- `evidence`: evidência bruta sanitizada, com `content_sha256` e vínculo com programa, alvo, hipótese, execução e finding.
- `flow_snapshots`: snapshots sanitizados de request, response e decision por estágio.
- `report_drafts`: narrativa gerada por IA separada da evidência bruta.
- `findings`: achados persistidos como resultado operacional.

## Regras
- Nunca armazenar segredos. Campos sensíveis e padrões como `password=`, `token=` e `Bearer ...` são redigidos.
- Evidência bruta nunca é misturada com narrativa de report.
- Toda persistência usa SQLAlchemy e repositório dedicado para facilitar futura troca de SQLite por Postgres.

## Consultas
- por programa: `GET /api/evidence-store/programs/{program_id}`
- por alvo: `GET /api/evidence-store/targets/{target_id}`
- por finding: `GET /api/evidence-store/findings/{finding_id}`

