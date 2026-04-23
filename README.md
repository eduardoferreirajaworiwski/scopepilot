# Bug Bounty Copilot (MVP)

Plataforma de apoio para programas autorizados de bug bounty com fluxo **human-in-the-loop**, validação de escopo obrigatória e trilha de auditoria completa.

## Princípios obrigatórios implementados
- IA não executa nada sem aprovação humana prévia.
- Toda ação passa por validação de escopo.
- Toda decisão operacional é registrada.
- Fluxo separado em hipótese, aprovação, execução e evidência.
- Sem automação agressiva/destrutiva no MVP.
- Aprovação exige revisor humano distinto e compatível com o nível exigido pela hipótese.
- Execução só pode ser concluída após despacho manual e com evidência registrada.

## Arquitetura (FastAPI + SQLite + Pydantic + Next.js)
- **Backend**: FastAPI.
- **Frontend operador**: Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui + React Query.
- **Launchpad backend**: `app/frontend/` agora funciona como página de entrada controlada para apontar ao frontend principal e à documentação da API, sem confundir demo com exerciser técnico legado.
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
5. `execution request` -> somente após decisão humana `approved` válida, não expirada e emitida por papel compatível.
6. `dispatch` -> execução sai da fila apenas por ação humana explícita.
7. `completion` -> conclusão exige execução em `running` e ao menos uma evidência.
8. `finding` -> gerado com base em execução aprovada e evidências registradas.

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
frontend/
  app/
  components/
  features/
  lib/
README.md
pyproject.toml
```

## Como executar
### Backend API
```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

### Frontend operador
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend operador: `http://127.0.0.1:3000`  
API FastAPI: `http://127.0.0.1:8000`  
OpenAPI: `http://127.0.0.1:8000/docs`
Launchpad backend: `http://127.0.0.1:8000/`

Observação: `app/frontend/` nao e mais a UI operador. Ele serve apenas como launchpad para evitar ambiguidade em demos. O frontend principal desta etapa esta em `frontend/` e consome a API existente via `NEXT_PUBLIC_SCOPEPILOT_API_URL`.

## Demo frontend
### Dataset profissional de demo
Use um banco SQLite dedicado para demo, sem tocar no banco local padrao:

```bash
source .venv/bin/activate
DATABASE_URL=sqlite:///./scopepilot_demo.db python scripts/seed_demo.py --reset
```

O seed cria um dataset coerente para entrevista, portfólio e screenshots:
- 2 programas autorizados com politicas de escopo explicitas.
- 5 targets, incluindo exemplos dentro e fora de escopo.
- 5 hipoteses em estados diferentes.
- 5 aprovacoes, incluindo `approved`, `pending` e `rejected`.
- 3 execucoes, incluindo `completed`, `running` e `queued`.
- 1 finding reportado com evidencia e report draft.
- eventos de auditoria bloqueados e permitidos para mostrar fail-closed e human-in-the-loop.

### Rodar a demo localmente
Backend:

```bash
source .venv/bin/activate
DATABASE_URL=sqlite:///./scopepilot_demo.db uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

URLs:
- Frontend operador: `http://127.0.0.1:3000`
- Launchpad backend: `http://127.0.0.1:8000/`
- API / docs: `http://127.0.0.1:8000/docs`

### Walkthrough ideal em 60-90 segundos
1. Abra o dashboard e destaque a trilha `program -> target -> hypothesis -> approval -> execution -> evidence -> finding`.
2. Entre em `Programs` para mostrar escopo explicito e pelo menos um target fora de escopo.
3. Entre em `Approvals` para mostrar uma fila pendente e um historico com decisao humana e rationale.
4. Entre em `Executions` para mostrar `queued`, `running` e `completed` como estados separados, com dispatch manual e conclusao baseada em evidencia.
5. Feche em `Findings` e `Audit Trail` para mostrar provenance, evidencia bruta, narrativa sintetizada e bloqueios auditaveis.

### Screenshots e GIFs recomendados
- Dashboard com os cards principais, o rail de workflow e o painel `75-second portfolio walkthrough`.
- Programs mostrando uma politica de escopo forte e um target fora de escopo.
- Approval Queue com uma aprovacao pendente e historico recente.
- Execution Control Room com cards de `queued`, `running`, `completed` e o formulario de completion com evidencia.
- Findings com evidencia bruta de um lado e narrativa/report draft do outro.
- Audit Trail com um evento `blocked` e um evento `approved` ou `completed`.

### Observacoes de demo
- O seed foi desenhado para parecer produto, nao exerciser tecnico: os textos sao deliberadamente profissionais e os estados contam uma historia completa.
- Se quiser resetar a demo, rode novamente `python scripts/seed_demo.py --reset` com o mesmo `DATABASE_URL`.

### Integração frontend/API
- Fluxos integrados sem mock no frontend: listagem de programas, detalhe de programa, listagem de hipóteses, solicitação/aprovação/rejeição de aprovações, request/dispatch/completion de execuções, listagem de findings e trilha de auditoria.
- A tela de detalhe de programa usa um adapter temporário no client: ela resolve o programa a partir de `GET /api/programs`, porque o backend ainda não expõe `GET /api/programs/{id}`.
- O fallback com mock não é usado nesses fluxos prioritários. O mock ainda existente é o adapter seguro/passivo de recon no backend, fora da navegação principal de aprovação e auditoria.
- Mutations de aprovação invalidam aprovações, hipóteses, evidence store e auditoria para manter separação clara entre IA, decisão humana e execução.
- Mutations de execução invalidam execuções, fila, hipóteses, findings, evidence store e auditoria para manter o estado operator-facing consistente durante demos e revisão.

## Endpoints principais
- `POST /api/programs`
- `GET /api/programs`
- `POST /api/targets`
- `GET /api/programs/{id}/targets`
- `POST /api/recon/run`
- `POST /api/hypotheses`
- `GET /api/hypotheses`
- `POST /api/hypotheses/{id}/approvals`
- `GET /api/approvals`
- `GET /api/approvals/pending`
- `POST /api/approvals/{id}/approve`
- `POST /api/approvals/{id}/reject`
- `POST /api/approvals/{id}/decide`
- `POST /api/executions`
- `GET /api/executions`
- `GET /api/executions/queue`
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
- O solicitante não pode aprovar a própria execução e o papel do aprovador deve atender o `required_approval_level`.
- Bloqueios de execução e de decisão também entram na trilha de auditoria.
- O Evidence Store sanitiza request/response e nunca deve persistir segredos.
- Evidência bruta e narrativa gerada por IA são armazenadas separadamente.
- O Report Agent usa templates editáveis e marca explicitamente evidência versus inferência.
- Recomenda-se autenticação/autorização e assinatura de decisões para ambiente real.
