# Aceite e gates de entrega

Este documento não declara aceite do usuário. Evidência técnica em 27/10/2026: `npm test` passou **10/10 testes de integração**, incluindo execução dos comandos de backup/restauração em subprocessos. Os testes usam diretórios temporários e não alteram a base operacional.

Cobertura comprovada: persistência/reinício, valores inválidos, bloqueio CSRF/origem/host, JSON malformado, snapshots, revisão, passagem do tempo e validade, conversão concorrente sem duplicidade, perda/cancelamento/indicadores, CSV, backup/restauração, rejeição de base ativa ou corrompida, preservação da base anterior e separação da demonstração. Build e jornada completa no Chromium também passaram, incluindo impressão, teclado, formulários, larguras de 320/390/768/1440 pixels e restauração do backup baixado pela tela. Detalhes em [VALIDACAO.md](VALIDACAO.md).

## Roteiro de homologação

1. Iniciar operação e confirmar base vazia ou dados reais já cadastrados; abrir demonstração separadamente e confirmar identificação visível.
2. Cadastrar cliente e peça; buscar por referência e conferir que aplicação é informada manualmente.
3. Abrir oportunidade, registrar necessidade e agendar tarefa; conferir agenda e histórico.
4. Criar proposta com itens, desconto e frete; conferir cálculos e impressão.
5. Registrar envio; alterar cliente/catálogo e conferir que proposta enviada preserva dados. Tentar edição indevida e receber recusa.
6. Revisar, ajustar validade e converter; repetir conversão e confirmar pedido único.
7. Registrar perda em outro negócio e cancelar pedido com motivo; conferir indicadores e histórico.
8. Encerrar, reiniciar e conferir persistência. Gerar backup e restaurar em base de teste; tentar restauração com aplicação aberta e confirmar recusa.

## Situação dos 19 passos

| #   | Etapa           | Situação de evidência                                     | Responsável / saída                            |
| --- | --------------- | --------------------------------------------------------- | ---------------------------------------------- |
| 1   | Ideia           | Aprovada no escopo de piloto local                        | Usuário / atividade e modalidade confirmadas   |
| 2   | Pesquisa        | Concluída como pesquisa documental; hipóteses pendentes   | Research / fontes oficiais e limites           |
| 3   | Requisitos      | Especificados; homologação pendente                       | Produto / SPR RF01–12                          |
| 4   | Regras          | Especificadas; validação operacional pendente             | Produto / RN01–09                              |
| 5   | Casos de uso    | Especificados                                             | Produto / UC01–05                              |
| 6   | Modelagem       | Implementada; relações exercitadas em integração          | Engenharia / tipos e persistência              |
| 7   | Protótipo       | Interface funcional validada tecnicamente no navegador    | Interface / jornadas locais                    |
| 8   | Arquitetura     | Decidida para piloto                                      | Engenharia / ADR-001                           |
| 9   | Banco           | Validado em testes de integração                          | Engenharia / SQLite, lock e recuperação        |
| 10  | Planejamento    | Escopo de piloto definido                                 | Integração / divisão de trabalho               |
| 11  | Desenvolvimento | Incremento implementado e integrado para piloto           | Engenharia / incremento executável             |
| 12  | Testes          | Integração 10/10, build e jornada de navegador aprovados  | QA / VALIDACAO.md e evidências                 |
| 13  | Homologação     | Pendente do usuário                                       | Usuário / roteiro acima                        |
| 14  | Correções       | Achados técnicos corrigidos e retestados; aceite pendente | Engenharia / reteste                           |
| 15  | Deploy          | Instalação local executada; portas 3000/3001 em loopback  | Integração / inicialização e smoke             |
| 16  | Entrega         | Código, documentação e ambientes locais disponíveis       | Integração / README e demonstração             |
| 17  | Manutenção      | Não iniciada                                              | Responsável a combinar / registro de problemas |
| 18  | Monitoramento   | Local; sem serviço de alerta contratado                   | Operador / logs e rotina de backup             |
| 19  | Evolução        | Backlog candidato, sem validação de demanda               | Usuário / observações do piloto                |

Pesquisa documental não substitui entrevista; teste técnico não substitui homologação comercial. Recomendação de uso deve ser limitada ao piloto local enquanto o usuário não confirmar adequação do processo. Publicação em equipe requer outro gate.

**Recomendação técnica: go com restrições para o piloto local.** A implementação não apresenta bloqueador técnico conhecido nos cenários verificados. Homologação do usuário, dados reais e publicação compartilhada permanecem etapas próprias.
