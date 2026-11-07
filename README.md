# Sistema de Automação do Cardápio — Cafeteria (protótipo)

Protótipo dos **dois módulos** descritos na documentação (FATEC Osasco):

| Módulo | Quem usa | Como acessa | Endereço |
|---|---|---|---|
| **Cliente** | cliente no salão | smartphone, ao ler o **QR Code** | `/` |
| **Colaborador** | atendente/caixa | desktop, com **login e senha** | `/painel/` |

## Linguagens escolhidas (e por quê)
- **PostgreSQL / SQL** — regras de negócio também no banco (preço, total, transições de status, auditoria, versão), pois o sistema é transacional e concorrente.
- **Java 21 + Spring Boot** — back-end tipado, camadas espelhando o diagrama BCE (`api` = controle, `servico`, `repositorio`, `nucleo`), JDBC puro com SQL parametrizado.
- **TypeScript + React (Vite)** — dois aplicativos independentes (mobile-first e desktop) com tipos compartilhados do contrato da API.

## Estrutura
```
banco/       schema.sql (tabelas, gatilhos, views) · papeis.sql (menor privilégio) · seed_dev.sql · consultas_dao.sql · teste_regras.sql
backend/     Spring Boot: api/ servico/ repositorio/ nucleo/ (regras puras e segurança) seguranca/ (filtros) config/
frontend/    apps/cliente · apps/painel · src/compartilhado (tokens, http, QR, textos) · publico/ (imagens e aparencia.json) · dev/mock-api.mjs
docker/      nginx.conf · Dockerfile.web · db/inicializar.sh
docs/        API.md · SEGURANCA.md · PERSONALIZACAO.md
```

## Como executar
**Tudo com Docker** (recomendado):
```bash
cp .env.example .env        # troque as senhas
docker compose --env-file .env up --build
# Cliente:     http://localhost/          (QR Code em /painel/ → "QR Code")
# Colaborador: http://localhost/painel/   (demo: ana.souza / trocar-senha-dev — somente com CARREGAR_DADOS_DEMO=true)
```
**Só o front-end (sem Java nem banco)**, para ver e ajustar o design:
```bash
cd frontend && npm install
npm run mock                # API simulada em :8080 (mesmas regras e mensagens)
npm run dev:cliente         # http://localhost:5173
npm run dev:painel          # http://localhost:5174/painel/
```
**Back-end local**: `cd backend && mvn spring-boot:run` (variáveis `DB_URL`, `DB_USUARIO`, `DB_SENHA`). Banco: execute `banco/schema.sql` e depois `banco/papeis.sql`.

## Fluxo do QR Code
O colaborador abre **QR Code** no painel, confere o endereço (precisa ser acessível pelo celular: IP da rede ou domínio) e imprime a folha para mesas e balcão.

## Regras da documentação implementadas
Código único `PED-0001` mantido após alterações · pagamento **somente presencial**, confirmado no terminal (RF09) · alteração só enquanto *Aguardando pagamento*, com conflito tratado se o cliente alterar durante a confirmação · ciclo AGUARDANDO_PAGAMENTO → EM_PREPARO → PRONTO → ENTREGUE → FINALIZADO e CANCELADO (ENTREGUE não cancela; cancelar pedido pago exige justificativa) · observações de lista fechada por produto · produtos indisponíveis em cinza, com aviso de pedidos pendentes · histórico com aviso, observação interna e auditoria de quem agiu · mensagens exatas dos casos de uso (`frontend/src/compartilhado/textos.ts`, `backend/.../nucleo/Textos.java`).

## O que foi verificado e o que NÃO foi
| Verificado | Como |
|---|---|
| Banco | 61 testes de regras em PostgreSQL 16, teste de concorrência real (alterar × pagar), fluxo completo com o papel restrito |
| Consultas SQL do back-end | todas executadas em PostgreSQL real, como o papel `cafeteria_app` |
| Núcleo Java (validação, sessão, bloqueio, limite, diff de itens) | 21 testes compilados e executados com JDK 21 |
| Front-end | verificação de tipos TypeScript, 12 testes unitários, 23 verificações ponta a ponta em Chromium (celular e desktop) contra a API simulada, QR Code decodificado por leitor real |
| **Não verificado** | **compilação e execução do Spring Boot** (o ambiente de criação bloqueia o Maven Central; a camada Spring foi checada apenas contra stubs de tipos), **build do Vite** e **`docker compose`** (sem rede/Docker no ambiente). Rode `mvn package` e `npm run build` na primeira vez; ajustes pequenos de dependência podem ser necessários |
