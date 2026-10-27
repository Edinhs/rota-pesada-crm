# Briefing — Rota Pesada CRM

Data: 27/10/2026. Escopo confirmado: distribuição de peças de caminhão; piloto local, para uma empresa. O pedido inicial usou “destruição”, posteriormente esclarecido como distribuição.

## Problema e público

Vendedores precisam acompanhar clientes, identificar a necessidade, preparar orçamentos e lembrar o próximo contato. O gestor precisa enxergar oportunidades e perdas. A hipótese de problema deriva do segmento e deve ser confirmada com atendimentos reais; não houve entrevista com operadores da empresa.

## Objetivo e entrega

Entregar um CRM local que permita cadastrar cliente e peça, abrir oportunidade, registrar atividade, preparar e imprimir orçamento, marcar envio, revisar condições e converter em pedido comercial interno. Os dados devem persistir após reiniciar e ser recuperáveis por backup.

O piloto contém clientes e contatos, catálogo comercial, funil, agenda/histórico, orçamentos, pedidos e painel. A primeira execução operacional começa sem clientes e produtos fictícios. A demonstração usa base separada e identificação visível.

## Limites

Não é ERP: não emite nota fiscal, não controla movimentação ou reserva de estoque, pagamentos, tributação ou crédito. Disponibilidade é informação manual, com data de atualização. Referência OEM e aplicação são cadastros informados; não comprovam intercambiabilidade. A confirmação técnica cabe ao vendedor.

O piloto atende um operador neste computador, via loopback. Acesso por equipe na internet exige outra arquitetura de autenticação, autorização, banco compartilhado e operação. WhatsApp abre uma conversa para revisão manual; não envia mensagens automaticamente.

## Como demonstrar valor

Executar o roteiro de aceite com um atendimento representativo, conferir proposta e valores, reencontrar histórico após reinício e restaurar cópia em base de teste. Não há promessa de aumento percentual de vendas nem prazo de adoção validado.

Responsável técnico: implementação e integração do projeto. Aprovador do processo comercial: usuário. Requisitos adicionais serão priorizados após observar o piloto, sem transformar toda função de concorrente em obrigação.
