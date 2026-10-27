# Validação técnica — piloto local

Data da entrega: 27/10/2026. Resultado: **apto para piloto local com um operador**, mantendo o aceite do processo comercial pelo usuário pendente.

## Evidências executadas

| Verificação                        | Resultado                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `npm run build`                    | TypeScript e compilação Vite aprovados                                            |
| `npm test`                         | 10 testes de integração aprovados                                                 |
| `npm run format:check`             | Formatação padronizada com Prettier                                               |
| `npm audit`                        | Nenhuma vulnerabilidade conhecida reportada na instalação verificada              |
| `python e2e/browser_acceptance.py` | Jornada completa no Chromium, base descartável, sem erros JavaScript não tratados |
| Inicialização operacional          | Porta 3000, somente 127.0.0.1, base vazia (zero clientes e produtos)              |
| Inicialização da demonstração      | Porta 3001, banco separado, quatro clientes e cinco produtos fictícios            |

## Jornada de navegador

O teste preenche formulários pelas telas e valida gravações do servidor. Cria cliente, duas peças, atendimento e tarefa; movimenta o funil; monta proposta com dois itens; registra envio; modifica o preço do catálogo e comprova preservação dos valores enviados; cria revisão, registra aceite e conclui o pedido.

Cálculo conferido: 2 × R$ 125,00 + R$ 49,90 − R$ 10,00 + R$ 5,00 = **R$ 294,90**. O teste registra uma perda adicional e confere taxa de ganho de **50%**. Cartões comerciais usam pedido ou orçamento vigente antes da estimativa inicial.

Valida também:

- falha HTTP simulada na gravação de cliente, mantendo o formulário preenchido e permitindo tentar novamente;
- Escape, retorno de foco e confinamento de Tab no modal;
- busca de peça por referência, link do WhatsApp sem envio e histórico do cliente;
- modo de impressão com número, situação, itens, totais e indicação de documento não fiscal;
- páginas em 320, 390, 768 e 1440 pixels sem transbordamento horizontal da página; tabelas/funil podem rolar internamente;
- formulário de cliente em tela de 390 pixels;
- reinício real do processo mantendo pedido e documentos;
- renovação da sessão CSRF após reinício, com página já aberta;
- download de backup pela interface, restauração por CLI em outra base e comparação dos pedidos/revisões recuperados.

As capturas e o relatório são regenerados em `artifacts/browser`; essa pasta está ignorada pelo Git para não versionar bancos ou dados de execução. A evidência de impressão verifica o conteúdo e CSS do navegador; não houve teste de impressora física.

## Integração e recuperação

Os testes de API exercitam registros e configurações após reinício, entradas inválidas sem gravação parcial, snapshots, validade com relógio controlado, conversão concorrente sem pedidos duplicados, cancelamentos e indicadores. Exercitam ainda CSV, backup íntegro, arquivo corrompido recusado, restauração bloqueada com base ativa e preservação de cópia anterior. Os comandos reais de backup/restauração também foram executados em subprocessos isolados.

A revisão adversarial verificou rejeição de Host/Origin externos, token inválido inclusive Unicode, JSON malformado e alterações de vínculo que deixariam o histórico inconsistente. Uma falha de I/O no COMMIT foi simulada em ensaio isolado: retornou erro genérico e rollback completo. Esse ensaio não equivale a testar falha física de disco.

## Limites da evidência

Não houve publicação, validação multiusuário, teste de carga corporativa, integração com ERP/WhatsApp oficial ou homologação com dados reais da distribuidora. Dados de catálogo e aplicação são declarados pelo operador. A cópia de segurança exige uma rotina do operador para guardar backups fora da máquina; nenhum envio automático externo foi configurado.
