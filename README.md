# Bug Bounty Copilot (MVP)

Plataforma de apoio para programas autorizados de bug bounty com fluxo **human-in-the-loop**, validação de escopo obrigatória e trilha de auditoria completa.

## Princípios obrigatórios implementados
- IA não executa nada sem aprovação humana prévia.
- Toda ação passa por validação de escopo.
- Toda decisão operacional é registrada.
- Fluxo separado em hipótese, aprovação, execução e evidência.
- Sem automação agressiva/destrutiva no MVP.

## Arquitetura (FastAPI + SQLite + Pydantic)
- **Backend**: FastAPI.
- **Persistência**: SQLite + SQLAlchemy.
- **Contratos**: Pydantic.
- **Observabilidade**: logging estruturado em JSON.
- **Evidence Store**: snapshots sanitizados de request/response/decision, evidência bruta sanitizada e drafts narrativos separados.
- **Report Agent**: geração determinística offline de drafts profissionais com export em Markdown e JSON.
- **Fila**: fila simples in-memory para despacho manual de execuções.
- **Adapters**: camada dedicada para ferramentas externas (mock no MVP).
- **Agentes com responsabilidade isolada**:
  - Scope Guard Agent
  - Recon Analyst Agent
  - Hypothesis Agent
  - Approval Workflow
  - Evidence & Report Agent

Detalhamento da arquitetura: [docs/architecture.md](/home/eduardo/projects/scopepilot/docs/architecture.md)
Detalhamento do Evidence Store: [docs/evidence_store.md](/home/eduardo/projects/scopepilot/docs/evidence_store.md)
Detalhamento do Report Agent: [docs/report_agent.md](/home/eduardo/projects/scopepilot/docs/report_agent.md)

## Modelo de dados do MVP
- `Program`: programa autorizado e política de escopo.
- `Target`: alvo e resultado da validação de escopo.
- `ReconRecord`: contexto de recon passivo.
- `Hypothesis`: hipótese técnica.
- `Approval`: decisão humana de aprovação/rejeição.
- `Execution`: solicitação e ciclo de execução.
- `Evidence`: evidências produzidas na execução.
- `Finding`: achado final consolidado.
- `DecisionLog`: auditoria de todas as decisões.

## Fluxo operacional implementado
1. `program` -> cadastro com política de escopo.
2. `target` -> validação Scope Guard.
3. `hypothesis` -> criada manualmente ou assistida.
4. `approval request` -> solicitação humana rastreável com `pending`, `approved`, `rejected` ou `expired`.
5. `execution` -> somente após decisão humana `approved` válida e não expirada.
6. `finding` -> gerado com base em execução e evidências.

## Estrutura do projeto
```text
app/
  agents/
  adapters/
  api/
  core/
  db/
  frontend/
  schemas/
  services/
  main.py
docs/
  architecture.md
README.md
pyproject.toml
```

## Como executar
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

Interface web: `http://127.0.0.1:8000/`  
OpenAPI: `http://127.0.0.1:8000/docs`

## Endpoints principais
- `POST /api/programs`
- `POST /api/targets`
- `POST /api/recon/run`
- `POST /api/hypotheses`
- `POST /api/hypotheses/{id}/approvals`
- `GET /api/approvals/pending`
- `POST /api/approvals/{id}/approve`
- `POST /api/approvals/{id}/reject`
- `POST /api/approvals/{id}/decide`
- `POST /api/executions`
- `POST /api/executions/queue/next`
- `POST /api/executions/{id}/complete`
- `GET /api/evidence-store/programs/{id}`
- `GET /api/evidence-store/targets/{id}`
- `GET /api/evidence-store/findings/{id}`
- `GET /api/findings`
- `GET /api/audit/decisions`

## Observações de segurança
- Este MVP não executa exploração automática ativa.
- O adapter de recon é mock e usa somente lógica segura/passiva.
- Regras de escopo e lista de termos proibidos devem ser endurecidas antes de produção.
- A execução depende formalmente de uma aprovação humana registrada e válida.
- O Evidence Store sanitiza request/response e nunca deve persistir segredos.
- Evidência bruta e narrativa gerada por IA são armazenadas separadamente.
- O Report Agent usa templates editáveis e marca explicitamente evidência versus inferência.
- Recomenda-se autenticação/autorização e assinatura de decisões para ambiente real.
