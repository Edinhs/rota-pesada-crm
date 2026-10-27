# Rota Pesada CRM

Piloto local para distribuição de peças de caminhão: clientes, catálogo comercial, oportunidades, atividades, orçamentos, pedidos e indicadores. Não é um ERP fiscal ou um controle transacional de estoque.

## Iniciar

Requisito: Node.js **24.16 ou superior da linha 24**, com npm. Na pasta do projeto:

```powershell
npm ci
npm run build
npm start
```

Abra [CRM operacional](http://127.0.0.1:3000). Após preparar dependências e build, também é possível executar `INICIAR-CRM.cmd`. O servidor fica em execução na janela; encerre com **Ctrl+C**. Não é necessário instalar banco ou criar conta externa.

Para conhecer o produto com dados fictícios:

```powershell
npm run demo
```

Abra [demonstração](http://127.0.0.1:3001) ou use `INICIAR-DEMO.cmd`. A demonstração tem base própria. A operação começa sem os clientes e produtos da demonstração.

Os processos escutam apenas `127.0.0.1`. Este piloto é para um operador local e não possui autenticação multiusuário. Não publique a porta na internet ou na rede da empresa como solução compartilhada.

## Primeiro atendimento

1. Cadastre os dados comerciais da empresa e um cliente com seus contatos.
2. Cadastre as peças: SKU, descrição, fabricante, referências, aplicação e preço. Confira aplicação técnica com uma fonte confiável; o cadastro não valida compatibilidade automaticamente.
3. Abra uma oportunidade e registre a necessidade do cliente; agende o retorno na agenda.
4. Monte e confira o orçamento. Use impressão do navegador para imprimir ou salvar como PDF.
5. Registre envio somente após encaminhar a proposta ao cliente. O botão WhatsApp abre conversa para envio manual.
6. Quando houver aceite, converta o orçamento vigente em pedido comercial interno. Acompanhe preparação/conclusão ou registre cancelamento justificado.

Somente rascunhos podem ser editados. Para alterar proposta enviada, use revisão. Proposta vencida precisa de nova validade em revisão antes da conversão. Dados enviados preservam cliente e itens mesmo se o catálogo for alterado depois.

## Dados, backup e restauração

Dados operacionais: `%LOCALAPPDATA%\CRMFaculdade\crm.sqlite`. Demonstração: `%LOCALAPPDATA%\CRMFaculdade\demo\crm.sqlite`. Os dados ficam fora do OneDrive do código. O arquivo SQLite e seus auxiliares não devem ser copiados manualmente enquanto o processo estiver aberto.

Use a ação de backup na interface ou, no terminal:

```powershell
npm run backup
npm run backup -- "C:\Backups\crm-copia.sqlite"
npm run backup -- --demo "C:\Backups\crm-demo.sqlite"
```

Sem caminho, a cópia vai para `backups` dentro do diretório do modo escolhido. O destino não pode existir. Guarde cópias fora deste computador conforme sua necessidade; a rotina não envia arquivos automaticamente para serviço externo. CSV exporta cadastros, mas não substitui backup completo.

Para restaurar, **encerre o CRM com Ctrl+C** e informe a cópia:

```powershell
npm run restore -- "C:\Backups\crm-copia.sqlite"
npm run restore -- --demo "C:\Backups\crm-demo.sqlite"
```

A restauração verifica integridade/estrutura e recusa base em uso. A base anterior, quando existe, é preservada como `before-restore-*.sqlite` na pasta de dados. Inicie novamente e confira documentos. Não apague `app.lock` enquanto houver processo ativo. Nunca experimente restaurações na única cópia de seus dados.

Para testes isolados ou localização alternativa, `CRM_DATA_DIR` define o diretório-base; o modo demo acrescenta `demo`. `PORT` altera a porta em execução por npm. Os lançadores CMD usam as portas padrão.

## Validação e documentação

```powershell
npm test
npm run build
```

Os testes de integração usam bases temporárias e verificam persistência, validações, snapshots, revisão/validade, concorrência de conversão, indicadores, exportação e recuperação. O aceite do processo comercial pelo usuário é uma etapa separada.

O teste completo de navegador também usa uma base temporária e inicia seu próprio servidor, sem tocar nos dados operacionais. Requer Python com Playwright e Chromium (já disponíveis no computador desta entrega):

```powershell
python -m pip install -r e2e/requirements.txt
python -m playwright install chromium
python e2e/browser_acceptance.py
```

Os dois primeiros comandos preparam outro computador para testes; não são necessários para usar o CRM. A execução gera evidências em `artifacts/browser`, incluindo impressão, telas de computador/celular e resultado JSON. Consulte [a validação técnica](docs/VALIDACAO.md) para o resultado desta entrega.

Antes de alterar o código, mantenha `npm run build`, `npm test` e `npm run format:check` aprovados. Os contratos entre tela e servidor estão em `shared/types.ts`; as regras comerciais são aplicadas novamente na API.

- [Briefing](docs/BRIEFING.md)
- [Pesquisa de mercado e fontes](docs/PESQUISA-MERCADO.md)
- [SPR — requisitos, regras e casos de uso](docs/SPR.md)
- [Decisão arquitetural](docs/ADR-001-ARQUITETURA.md)
- [Roteiro de aceite e situação dos gates](docs/ACEITE-E-GATES.md)

Limites do piloto: disponibilidade manual, sem reserva/baixa de estoque; sem faturamento, pagamento, crédito, catálogo técnico licenciado, ERP ou integração WhatsApp oficial. Ganho representa fechamento comercial; cancelamentos são excluídos do ganho ativo no painel. Filtros de período usam encerramento para ganhos/perdas; abertos e tarefas vencidas refletem a situação atual.
