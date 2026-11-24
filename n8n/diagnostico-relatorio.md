# Autodiagnóstico: workflow N8N e textos do relatório

Esta pasta **não é publicada no site** (está no `.dockerignore`). Os textos completos do relatório ficam aqui e no N8N, nunca no JavaScript do site, porque é isso que sustenta a troca "relatório completo por contato".

## 1. Workflow no N8N

Webhook de entrada: `POST https://webhook.whatchat.app.br/webhook/diagnostico-whatchat`
(o caminho é a constante `WEBHOOK_URL` em `diagnostico.js`).

1. **Webhook** (POST, resposta "Immediately" com status 200). Habilite CORS para `https://whatchat.com.br` (o site faz `fetch` do navegador).
2. **Validação** (IF/Code): `email` válido, `consentimentos.politica_privacidade === true`, `resultado.estagio` entre `manual | isolado | pontual | integrado`. Se falhar, responda 400.
3. **Salvar o lead** (Google Sheets, CRM ou banco): contato, estágio, pontuação, áreas, perfil, `consentimentos.contato_comercial`, `versao_textos`, `data_hora`, `utm`. Guarde o consentimento como está: ele é a sua prova de autorização.
4. **Avisar você** no WhatsApp ou e-mail com nome, estágio, empresa, tamanho e se autorizou contato comercial.
5. **Montar o relatório** (Code node) com os textos da seção 3 e **enviar pelo Resend**.
6. Se `contato_comercial` for `false`, o lead **só recebe o relatório**. Não entre em contato comercial com ele.

### Envio pelo Resend

- Verifique o domínio no Resend e envie de um endereço dele (por exemplo `Carlos da Whatchat <relatorio@whatchat.com.br>`). Sem domínio verificado, o Resend só entrega para o e-mail da própria conta.
- Guarde a chave da API (`re_...`) **somente nas credenciais do N8N**. Nunca no site.
- Nó **HTTP Request** (ou o nó Resend, se a sua versão do N8N tiver):
  - `POST https://api.resend.com/emails`
  - Header `Authorization: Bearer <chave>`
  - Body JSON: `from`, `to` (`[email]`), `subject`, `html`, `reply_to` (seu e-mail).
- Assunto sugerido: `Seu relatório de automação: estágio {{estagio_nome}}`.

## 2. Formato recebido (resumo)

```json
{
  "origem": "autodiagnostico",
  "versao_textos": "2026-11-24-v1",
  "data_hora": "2026-11-24T15:04:18.000Z",
  "nome": "", "email": "", "whatsapp": "", "empresa": "",
  "consentimentos": { "politica_privacidade": true, "contato_comercial": false },
  "resultado": {
    "pontuacao": 14, "maximo": 24,
    "estagio": "pontual", "estagio_nome": "Automação pontual",
    "areas": { "atendimento": { "nome": "", "pontos": 4, "maximo": 6, "nivel": "Em evolução" } }
  },
  "perfil": { "tamanho": "2 a 10 pessoas", "ferramentas": ["WhatsApp", "CRM"] },
  "respostas": [ { "id": "atendimento_entrada", "pergunta": "", "resposta": "", "valor": 2 } ],
  "utm": {}
}
```

Faixas de estágio (pontuação de 0 a 24): `manual` 0–6, `isolado` 7–13, `pontual` 14–19, `integrado` 20–24.
Níveis por área: `Inicial`, `Em evolução`, `Avançado`.

## 3. Textos do relatório

Voz: primeira pessoa (Carlos). Sem números de economia prometidos: o relatório dá diretriz, não garantia.

### Abertura (por estágio)

- **manual**: "Hoje a sua operação depende de pessoas copiando, lembrando e conferindo. Isso não é falha de ninguém: é onde quase toda empresa começa. A boa notícia é que, nesse estágio, uma primeira automação bem escolhida costuma ter o retorno mais visível."
- **isolado**: "Você já tem boas ferramentas, mas cada uma trabalha sozinha. O custo aparece em retrabalho: o mesmo dado digitado mais de uma vez e informação que chega atrasada de um sistema para o outro. Conectar o que você já tem costuma render mais do que trocar de sistema."
- **pontual**: "Você já automatizou parte da operação, e isso é o mais difícil. O desafio agora é a solidez: fluxos que quebram sem aviso, que dependem de uma pessoa e que não cobrem o processo inteiro. O foco é dar confiabilidade antes de ampliar."
- **integrado**: "Seus sistemas conversam e você já tem monitoramento. O trabalho agora é refinar: eliminar os gargalos que sobraram e colocar decisões repetitivas nas mãos de agentes de IA supervisionados."

### Leitura por área (por nível)

**Atendimento e leads**
- Inicial: "Cada contato novo depende de alguém ver, responder e anotar. É aqui que mais se perdem oportunidades, principalmente fora do horário comercial."
- Em evolução: "Os contatos já ficam registrados, mas a resposta e o acompanhamento ainda são manuais. Dá para ganhar tempo sem mudar o seu CRM."
- Avançado: "Entrada, qualificação e follow-up já são automáticos. O ajuste fino agora é medir quais sequências convertem mais."

**Dados entre sistemas**
- Inicial: "Os dados são digitados em cada sistema. Isso gera erro e atraso, e o risco cresce com o volume."
- Em evolução: "Há trocas por planilha ou conexões parciais. Um fluxo no ponto de maior retrabalho já tira a maior dor."
- Avançado: "Os sistemas estão sincronizados. Vale revisar o que acontece quando um deles fica fora do ar."

**Tarefas repetitivas**
- Inicial: "Boa parte do tempo da equipe vai para tarefas que uma regra resolveria. Mapear as cinco mais frequentes é o primeiro passo."
- Em evolução: "Parte das tarefas já foi automatizada. Revise quais ainda consomem horas toda semana."
- Avançado: "As tarefas repetitivas estão sob controle. O ganho agora está em liberar o time para trabalho de maior valor."

**Relatórios e monitoramento**
- Inicial: "Os números dependem de alguém levantar e as falhas aparecem quando o cliente reclama. Alertas simples já mudam esse cenário."
- Em evolução: "Há relatórios e conferências, mas parte é manual ou periódica. Alertas automáticos reduzem o tempo entre a falha e a correção."
- Avançado: "Você enxerga os números e as falhas em tempo real. Mantenha a documentação em dia para não depender de uma pessoa só."

**Uso de IA**
- Inicial: "A IA ainda não faz parte da operação. Comece por um caso de baixo risco, como classificar mensagens ou sugerir respostas para revisão."
- Em evolução: "A IA é usada de forma individual ou com apoio manual. Integrá-la ao fluxo, com revisão humana, dá consistência."
- Avançado: "A IA já está nos fluxos. Defina com clareza quando o caso deve passar para uma pessoa e acompanhe a qualidade."

### Automações prioritárias

Escolha **3** automações, começando pelas áreas de menor nível (empate: ordem Atendimento, Dados, Monitoramento, Tarefas, IA).

- **Atendimento:** (a) resposta automática e registro do contato no CRM; (b) sequência de follow-up por WhatsApp ou e-mail; (c) qualificação do lead com IA e direcionamento ao time comercial.
- **Dados:** (a) pedido ou venda criando o lançamento no financeiro e a baixa no estoque; (b) cadastro único de cliente replicado nos sistemas; (c) sincronização periódica com conferência de divergências.
- **Tarefas:** (a) lembretes e cobranças automáticos; (b) geração e envio de documentos a partir de um formulário; (c) rotina de conferência que avisa só quando há exceção.
- **Monitoramento:** (a) alerta automático quando um fluxo ou integração falha; (b) relatório semanal enviado sozinho; (c) painel único com dados de vendas, atendimento e financeiro.
- **IA:** (a) triagem e classificação de mensagens; (b) rascunho de resposta para revisão humana; (c) resumo automático de conversas para o CRM.

### Roteiro de próximos passos (por estágio)

- **manual**: 1) liste as cinco tarefas repetitivas que mais consomem tempo; 2) automatize a entrada de contatos (resposta e registro); 3) escolha uma segunda automação a partir do que você mediu.
- **isolado**: 1) identifique o dado mais digitado em duplicidade; 2) conecte esses dois sistemas com um fluxo; 3) acrescente um alerta de falha antes de ampliar.
- **pontual**: 1) inventarie os fluxos existentes e quem cuida de cada um; 2) adicione alertas de falha e registro de execução; 3) priorize o processo ainda manual com maior impacto.
- **integrado**: 1) revise os gargalos que sobraram; 2) introduza IA em uma decisão repetitiva, com supervisão; 3) acompanhe a qualidade e ajuste as regras.

### Fechamento

"Se quiser ir além do relatório, no diagnóstico gratuito eu olho os seus processos com você e aponto por onde começar. É só responder este e-mail ou me chamar no WhatsApp: +55 21 99513-2305."

Rodapé obrigatório do e-mail: motivo do envio ("você pediu este relatório ao fazer o autodiagnóstico em whatchat.com.br"), link da Política de Privacidade e como revogar o consentimento (responder este e-mail).
