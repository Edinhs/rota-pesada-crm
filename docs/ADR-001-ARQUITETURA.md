# ADR-001 — Aplicação local com SQLite

Status: decisão de implementação para piloto local. Data: 27/10/2026.

## Contexto e decisão

O piloto precisa operar neste computador sem depender de contratação ou provisionamento externo. Usar React/TypeScript na interface, Fastify na API e SQLite local pelo runtime Node 24. Frontend compilado servido pelo mesmo processo da API; `npm start` na porta 3000 e `npm run demo` na porta 3001, somente loopback.

Dados operacionais: `%LOCALAPPDATA%\CRMFaculdade`; demonstração em diretório separado. A base não fica no OneDrive do código. Uma instância por diretório de dados possui lock para evitar concorrência entre processos e restauração com base aberta.

O módulo `node:sqlite` é classificado como **Stability 1.2 — Release candidate** no Node 24.16.0, conforme a [documentação oficial desta versão](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html). A escolha reduz dependências nativas extras neste piloto, mas exige manter a linha de runtime verificada e repetir testes de persistência/backup ao atualizá-la. Não é apresentado como API de estabilidade plena.

As regras comerciais, validações, dinheiro em centavos, snapshots e conversão atômica pertencem ao servidor. Interfaces compartilhadas descrevem entidades e respostas. Escritas exigem token CSRF; o servidor restringe origem/host. Isso não substitui autenticação para uma futura versão compartilhada.

## Continuidade

Backup usa mecanismo consistente do SQLite, não cópia arbitrária de arquivo aberto. Restauração valida origem, recusa processo ativo e preserva cópia anterior antes da substituição. Exportação CSV não substitui backup, pois não contém todas as relações e documentos.

## Consequências e limites

Benefícios: instalação pequena, persistência real, operação independente de serviços externos e um único processo de execução. Limites: máquina única, responsabilidade local por cópias e ausência de autenticação por pessoa. Não disponibilizar portas na rede nem publicar esta arquitetura como sistema de equipe.

Alternativas: armazenamento só no navegador foi descartado pela recuperação e consistência do fluxo; banco hospedado e autenticação multiusuário ficam para release próprio, quando equipe remota for requisito. Catálogo técnico licenciado e ERP não são simulados por esta implementação.
