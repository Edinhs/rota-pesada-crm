# Rota Pesada CRM

Responda em português brasileiro e explique decisões relevantes com clareza para apoiar a formação profissional do usuário.

## Contexto e limites

Piloto local de CRM para distribuição de peças de caminhão, uma empresa e um operador. Não publicar nem contratar recursos pagos sem pedido explícito. Não implementar fiscal, saldo de estoque ou integrações automáticas de mensagens como se existissem.

## Estrutura

- `shared/types.ts`: contrato entre API e interface. Alterações exigem revisar ambos e testes.
- `server/`: Fastify, regras comerciais, SQLite e recuperação.
- `src/`: interface React. Validação do servidor é a autoridade.
- `tests/`: integração em bases temporárias; nunca utilizar a base operacional.
- `docs/`: briefing, pesquisa, SPR, arquitetura, gates e evidências.

## Regras de trabalho

- Usar Node 24.16.x ou atualização compatível da linha 24 e instalar por `npm ci` após o lockfile.
- `npm run build` verifica tipos e gera interface; `npm test` valida a API e as regras.
- Manter valores monetários em centavos e documentos emitidos imutáveis, com revisões explícitas.
- Manter conversão em pedido transacional e idempotente.
- Preservar dados reais em `%LOCALAPPDATA%\CRMFaculdade`; nunca apagar a base operacional para testes ou demonstrações.
- Não copiar SQLite ativo sem mecanismo consistente de snapshot.
- Atualizar a SPR quando novas informações mudarem requisitos ou regras.
- Homologação automatizada não substitui aceite do usuário; registrar a distinção.
