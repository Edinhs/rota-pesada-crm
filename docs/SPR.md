# SPR — Especificação do Produto e Requisitos

Versão 0.1, piloto local, 27/10/2026. “SPR” identifica neste projeto o documento solicitado de especificação e requisitos; ERS/SRS também são denominações usuais. Interface em português brasileiro, valores BRL e datas operacionais em America/Sao_Paulo.

## Requisitos funcionais

| ID   | Requisito verificável                                                                                 | Critério de aceite                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| RF01 | Manter clientes PF/PJ, contatos e observações.                                                        | Criar, editar, buscar e arquivar sem apagar histórico referenciado.                                      |
| RF02 | Manter catálogo com SKU, fabricante, referências, aplicação, preço e disponibilidade manual.          | Buscar por descrição/SKU/referência; impedir SKU duplicado e preço inválido.                             |
| RF03 | Buscar clientes por nome e peças por código, referência, fabricante e aplicação.                      | Filtragem encontra registros pelos termos cadastrados, sem inferir compatibilidade técnica.              |
| RF04 | Acompanhar oportunidades em seis etapas comerciais.                                                   | Movimentar negócio; perda exige motivo; ganho ocorre por conversão em pedido.                            |
| RF05 | Registrar necessidade/veículo, atividades e tarefas vinculadas ao cliente e opcionalmente ao negócio. | Exibir histórico e vencimento; permitir concluir tarefa.                                                 |
| RF06 | Preparar orçamento com itens e totais, validade, condições e observações.                             | Validar quantidade/preço/desconto/frete e calcular total no servidor.                                    |
| RF07 | Imprimir orçamento identificado e numerado; permitir salvar PDF pelo navegador.                       | Documento legível contém empresa, cliente, itens, validade, totais e condições.                          |
| RF08 | Registrar aceite e converter proposta vigente em pedido comercial interno com snapshot.               | Conversão atômica, uma venda por oportunidade e repetição sem duplicidade.                               |
| RF09 | Acompanhar situação de pedido e cancelamento.                                                         | Cancelamento exige justificativa e mantém registro.                                                      |
| RF10 | Apresentar indicadores comerciais e perdas no período.                                                | Negócios abertos e tarefas vencidas refletem estado atual; ganhos/perdas seguem período de encerramento. |
| RF11 | Abrir conversa WhatsApp para envio humano e permitir registrar interação manual.                      | Revisão e envio ficam com o operador; aplicação não afirma envio automático.                             |
| RF12 | Exportar clientes/produtos CSV e gerar backup/restaurar.                                              | CSV seguro para planilha e cópia recuperável; restauração recusa base aberta.                            |

Requisitos suplementares: RS01 registrar envio e preservar snapshots; RS02 revisar proposta com histórico de família, marcando a anterior substituída; RS03 configurar identificação comercial da distribuidora. Esses requisitos detalham o orçamento sem alterar os identificadores RF01–12 aprovados.

## Regras de negócio

- RN01: valores são inteiros em centavos; quantidades de peças são inteiros positivos. Total = soma dos itens − desconto + frete; desconto não supera a soma dos itens.
- RN02: catálogo é referência comercial. Disponibilidade manual não equivale a saldo, reserva ou baixa. OEM/aplicação não são garantia técnica.
- RN03: só rascunho pode ser editado. Envio preserva cliente e itens; posterior edição do cadastro não altera documento enviado.
- RN04: validade usa data YYYY-MM-DD em São Paulo. Proposta vencida não converte; revisar e informar validade adequada.
- RN05: conversão é idempotente por oportunidade, inclusive requisições concorrentes. Pedido mantém valores e snapshots aprovados.
- RN06: ganho é fechamento comercial, não faturamento ou recebimento. Pedido cancelado não conta como ganho ativo no painel; sua história permanece consultável.
- RN07: perda e cancelamento exigem motivo. Histórico de ações locais não prova identidade de múltiplos usuários.
- RN08: arquivamento preserva documentos e vínculos. Dados de demonstração usam diretório próprio.
- RN09: abertura de WhatsApp não confirma envio. Registro do contato e do envio de proposta é manual.

## Casos de uso

| Caso              | Fluxo principal                                                                                            | Alternativas/erros                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| UC01 Atendimento  | Cadastrar cliente → abrir oportunidade → registrar necessidade/veículo → agendar retorno.                  | Cliente já existe: reutilizar; formulário inválido: informar campo.            |
| UC02 Proposta     | Buscar peça → confirmar aplicação com cliente → montar orçamento → revisar impressão → registrar envio.    | Peça indisponível: indicar condição; valores inválidos: impedir salvamento.    |
| UC03 Negociação   | Registrar contato → revisar orçamento → enviar revisão → converter em pedido.                              | Proposta vencida: revisar; repetição de conversão: recuperar pedido existente. |
| UC04 Encerramento | Acompanhar pedido ou registrar perda com motivo.                                                           | Cancelar pedido com justificativa; não apagar histórico.                       |
| UC05 Continuidade | Encerrar aplicação → backup → iniciar → verificar dados; restaurar cópia de teste com aplicação encerrada. | Arquivo inválido ou lock ativo: recusar sem substituir a base.                 |

## Interfaces e qualidade

API local `/api`: sessão CSRF, estado, recursos comerciais, transições explícitas de orçamento/oportunidade/pedido, configuração, painel, CSV e backup. Escritas exigem token de sessão; regras comerciais não dependem da interface. O processo escuta somente loopback. Dados operacionais ficam fora da pasta OneDrive do projeto.

Estados da proposta: rascunho, enviada, aceita, substituída. Pedido: confirmado, em preparação, concluído, cancelado. Funil: novo atendimento, qualificação, orçamento enviado, negociação, ganho, perdido.

RNF01: persistência transacional após reinício e bases separadas para operação/demonstração. RNF02: mensagens claras, navegação por teclado, layout utilizável em tela estreita e impressão legível. RNF03: lock, backup verificado e instruções de recuperação. Não há autenticação multiusuário nem publicação incluídas.
