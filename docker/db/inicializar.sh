#!/bin/bash
# Executado UMA vez pelo contêiner do PostgreSQL ao criar o banco (pasta docker-entrypoint-initdb.d).
# 1) cria as tabelas, regras e gatilhos; 2) cria o papel de privilégio mínimo da aplicação;
# 3) opcionalmente carrega os dados de demonstração (CARREGAR_DADOS_DEMO=true).
set -euo pipefail
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /banco/schema.sql
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v senha_app="'${APP_DB_SENHA}'" -f /banco/papeis.sql
if [ "${CARREGAR_DADOS_DEMO:-false}" = "true" ]; then
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /banco/seed_dev.sql
fi
