# Arquitetura do MVP - Bug Bounty Copilot

## Objetivo
Entregar uma plataforma defensável para programas autorizados de bug bounty, com controle humano obrigatório e auditoria de decisão ponta a ponta.

## Requisitos não negociáveis
- IA nunca executa ações sem aprovação humana explícita.
- Toda ação passa por validação de escopo.
- Toda decisão é registrada em trilha de auditoria.
- Fluxo separado em: hipótese, aprovação, execução, evidência.
- Sem automação destrutiva ou agressiva no MVP.

## Visão em camadas
1. API (`FastAPI`)
- Endpoints síncronos para orquestrar o fluxo operacional.
- Contratos de entrada/saída com `Pydantic`.

2. Orquestração e regras de negócio (`services`)
- `ApprovalWorkflowService`: controla estado da aprovação.
- `DecisionLoggerService`: persiste decisões em `decision_logs` e emite log estruturado JSON.
- `SimpleExecutionQueue`: fila simples para execução manual.

3. Agentes (`agents`)
- `ScopeGuardAgent`: valida escopo e bloqueia planos de risco.
- `ReconAnalystAgent`: executa recon passivo via adapter.
- `HypothesisAgent`: estrutura hipóteses com base em contexto.
- `EvidenceReportAgent`: transforma execução + evidências em finding.

4. Integração externa (`adapters`)
- Interface para ferramentas externas com implementação mock no MVP.

5. Persistência (`SQLite + SQLAlchemy`)
- Entidades separadas para rastreabilidade: `Program`, `Target`, `Hypothesis`, `Approval`, `Execution`, `Evidence`, `Finding`, `DecisionLog`, `ReconRecord`.

6. Interface web simples
- Página única para operar o fluxo sem dependências complexas de frontend.

## Fluxo principal
1. Criar programa com política de escopo.
2. Registrar target e validar escopo (permitido/bloqueado).
3. Executar recon passivo em target in-scope.
4. Criar hipótese.
5. Solicitar aprovação humana.
6. Decidir aprovação (`approved`, `rejected` ou `expired` por expiração) com revisor distinto e papel compatível.
7. Solicitar execução (somente com decisão humana `approved` válida).
8. Despachar execução manual da fila.
9. Concluir execução somente em estado `running` e com evidências obrigatórias.
10. Gerar finding e draft de report a partir de evidências persistidas.

## Controles defensáveis
- Filtro de termos proibidos no plano de execução.
- Bloqueio automático de execução sem aprovação.
- Bloqueio de autoaprovação e de aprovador com papel insuficiente.
- Gate formal de execução dependente de aprovação válida e não expirada.
- Conclusão de execução bloqueada enquanto o item não for despachado manualmente.
- Geração de finding condicionada a evidência persistida.
- Bloqueio de ações para target fora de escopo.
- Registro de decisões operacionais, inclusive bloqueios, em banco.
- Logging JSON para integração com SIEM futuramente.
