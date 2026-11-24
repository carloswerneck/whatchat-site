/* Autodiagnóstico de automação, em tela cheia (uma pergunta por vez)
 * Fluxo: entrada → 10 perguntas → resultado parcial → contato + consentimento → envio ao webhook.
 * O relatório completo NÃO está neste arquivo: ele é gerado e enviado por e-mail pelo N8N.
 */
(function () {
  'use strict';

  // Webhook do N8N que recebe o diagnóstico (workflow "Autodiagnóstico Whatchat")
  const WEBHOOK_URL = 'https://webhook.whatchat.app.br/webhook/diagnostico-whatchat';
  // Versão dos textos de consentimento exibidos. Mude ao alterar os textos da tela.
  const TEXT_VERSION = '2026-11-24-v1';

  const AREAS = [
    { id: 'atendimento', name: 'Atendimento e leads', max: 6 },
    { id: 'dados', name: 'Dados entre sistemas', max: 6 },
    { id: 'tarefas', name: 'Tarefas repetitivas', max: 3 },
    { id: 'monitoramento', name: 'Relatórios e monitoramento', max: 6 },
    { id: 'ia', name: 'Uso de IA', max: 3 },
  ];
  const LEVELS = ['Inicial', 'Em evolução', 'Avançado'];

  // Perguntas pontuadas: cada resposta vale de 0 a 3, na ordem das opções.
  // "em" é o trecho do título que recebe destaque.
  const QUIZ = [
    {
      id: 'atendimento_entrada', area: 'atendimento', kind: 'choice', scored: true,
      text: 'Quando um novo lead ou cliente entra em contato (WhatsApp, e-mail ou formulário), o que acontece?',
      em: 'entra em contato',
      options: [
        'Alguém da equipe vê, responde e anota o contato à mão',
        'A equipe responde à mão, mas os contatos ficam registrados em um CRM ou planilha compartilhada',
        'Há uma resposta automática e o contato entra sozinho no CRM',
        'O contato é qualificado e direcionado automaticamente, com regras ou IA',
      ],
    },
    {
      id: 'atendimento_followup', area: 'atendimento', kind: 'choice', scored: true,
      text: 'Como é feito o acompanhamento de leads e clientes depois do primeiro contato?',
      em: 'acompanhamento',
      options: [
        'Depende de alguém lembrar ou de anotações soltas',
        'Temos lembretes no CRM ou na agenda, mas disparados manualmente',
        'Alguns follow-ups saem automaticamente por e-mail ou WhatsApp',
        'Há sequências automáticas por perfil, com alerta ao time quando o cliente responde',
      ],
    },
    {
      id: 'dados_pedido', area: 'dados', kind: 'choice', scored: true,
      text: 'Quando uma venda ou pedido acontece, como a informação chega ao estoque, ao financeiro e a outros sistemas?',
      em: 'a informação chega',
      options: [
        'Alguém digita ou copia o dado em cada sistema',
        'Exportamos e importamos planilhas de tempos em tempos',
        'Alguns sistemas se conectam sozinhos, outros ainda não',
        'Tudo é sincronizado automaticamente entre os sistemas',
      ],
    },
    {
      id: 'dados_retrabalho', area: 'dados', kind: 'choice', scored: true,
      text: 'Com que frequência sua equipe digita o mesmo dado em mais de um lugar?',
      em: 'mesmo dado',
      options: ['O tempo todo', 'Várias vezes por semana', 'De vez em quando', 'Quase nunca'],
    },
    {
      id: 'tarefas_tempo', area: 'tarefas', kind: 'choice', scored: true,
      text: 'Quanto do tempo da equipe vai para tarefas repetitivas, como copiar dados, enviar lembretes, montar relatórios e conferir planilhas?',
      em: 'tarefas repetitivas',
      options: [
        'Boa parte da semana',
        'Algumas horas por dia',
        'Algumas horas por semana',
        'Quase nada, já automatizamos a maioria',
      ],
    },
    {
      id: 'monitoramento_numeros', area: 'monitoramento', kind: 'choice', scored: true,
      text: 'Como você acompanha os números do negócio (vendas, atendimento, financeiro)?',
      em: 'acompanha os números',
      options: [
        'Só quando alguém levanta os dados à mão',
        'Em planilhas atualizadas manualmente',
        'Relatórios que se atualizam sozinhos, mas só em parte dos casos',
        'Dashboards em tempo real com dados de todos os sistemas',
      ],
    },
    {
      id: 'monitoramento_falhas', area: 'monitoramento', kind: 'choice', scored: true,
      text: 'Se um processo falha (um pedido não sincroniza, um lead some), como você fica sabendo?',
      em: 'fica sabendo',
      options: [
        'Só quando o cliente reclama',
        'Quando alguém percebe por acaso',
        'Conferimos periodicamente',
        'Recebemos um alerta automático na hora',
      ],
    },
    {
      id: 'ia_uso', area: 'ia', kind: 'choice', scored: true,
      text: 'Como a IA é usada na operação hoje?',
      em: 'IA',
      options: [
        'Não usamos',
        'Algumas pessoas usam por conta própria (como o ChatGPT), fora dos processos',
        'Usamos em alguns processos, com apoio manual (por exemplo, gerar respostas e revisar)',
        'Está integrada aos fluxos, como atendimento, triagem e classificação, com supervisão',
      ],
    },
    // Perguntas de perfil: não entram na pontuação
    {
      id: 'tamanho', kind: 'choice', label: 'Sobre você',
      text: 'Qual o tamanho da sua empresa?', em: 'tamanho',
      options: ['Só eu', '2 a 10 pessoas', '11 a 50 pessoas', 'Mais de 50 pessoas'],
    },
    {
      id: 'ferramentas', kind: 'multi', label: 'Sobre você', grid: true,
      text: 'Quais ferramentas você já usa?', em: 'ferramentas',
      hint: 'Pode marcar quantas quiser.',
      options: [
        'WhatsApp', 'E-mail', 'Planilhas (Excel ou Google Sheets)', 'CRM',
        'ERP', 'E-commerce', 'Sistema próprio', 'Nenhuma ainda',
      ],
      exclusive: 'Nenhuma ainda',
    },
  ];

  // Telas de contato, depois do resultado parcial
  const GATE_LABEL = 'Relatório completo';
  const GATE = [
    {
      id: 'nome', kind: 'text', mask: 'nome', autocomplete: 'name', required: true, label: GATE_LABEL,
      title: 'Para receber o relatório completo, qual o seu <em>nome</em>?', placeholder: 'Seu nome',
    },
    {
      id: 'email', kind: 'email', mask: 'email', autocomplete: 'email', required: true, label: GATE_LABEL,
      title: 'Qual o seu melhor <em>e-mail</em>?', placeholder: 'voce@empresa.com.br',
      hint: 'É por aqui que enviamos o seu relatório.',
    },
    {
      id: 'whatsapp', kind: 'tel', mask: 'telefone', autocomplete: 'tel', required: true, label: GATE_LABEL,
      title: 'E o seu <em>WhatsApp</em>?', placeholder: '(21) 99999-9999',
      hint: 'Com DDD. Só usamos para contato se você autorizar na próxima tela.',
    },
    {
      id: 'empresa', kind: 'text', mask: 'empresa', autocomplete: 'organization', required: false, label: GATE_LABEL,
      title: 'Qual o nome da sua <em>empresa</em>?', placeholder: 'Nome da empresa',
      hint: 'Opcional. Pode seguir sem preencher.',
    },
    {
      id: 'consent', kind: 'consent', label: GATE_LABEL,
      title: 'Para finalizar, <em>autorize</em> o envio',
      hintHtml: 'Leia a <a href="/privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>. A segunda opção é opcional.',
      options: [
        { key: 'politica', required: true, text: 'Li e aceito a Política de Privacidade e autorizo o uso dos meus dados para gerar e enviar o relatório.' },
        { key: 'contato', required: false, text: 'Aceito receber contato da Whatchat por WhatsApp ou e-mail sobre propostas e serviços de automação. Posso revogar quando quiser.' },
      ],
    },
  ];

  const STAGES = [
    {
      id: 'manual', max: 6, name: 'Manual', short: 'Manual',
      text: 'Hoje a operação depende de pessoas copiando, lembrando e conferindo. É um ponto de partida comum, e a primeira automação bem escolhida costuma ter o retorno mais visível.',
      tip: 'Comece pelo ponto de entrada: faça cada novo contato entrar sozinho em um CRM ou planilha compartilhada, com uma resposta automática. É o ganho mais rápido e a base para automatizar o resto.',
    },
    {
      id: 'isolado', max: 13, name: 'Ferramentas isoladas', short: 'Isolado',
      text: 'Você já tem ferramentas, mas cada uma trabalha sozinha. O custo aparece em retrabalho: dados digitados mais de uma vez e informação que chega atrasada de um sistema para o outro.',
      tip: 'Escolha o dado que é digitado em mais de um lugar com mais frequência (um pedido, um cadastro de cliente) e conecte esses dois sistemas primeiro. Um fluxo só já mostra o retorno antes de ampliar.',
    },
    {
      id: 'pontual', max: 19, name: 'Automação pontual', short: 'Pontual',
      text: 'Já existem automações rodando, mas de forma pontual: dependem de poucas pessoas, quebram sem aviso e não cobrem o processo inteiro. O foco agora é dar solidez e ampliar com critério.',
      tip: 'Antes de criar novos fluxos, coloque alertas de falha nos que já existem e documente quem cuida de cada um. Automação sem monitoramento vira risco.',
    },
    {
      id: 'integrado', max: 24, name: 'Integrado e inteligente', short: 'Integrado',
      text: 'Seus sistemas conversam, há monitoramento e a IA já tem espaço. O trabalho agora é refinar: tirar os gargalos que sobraram e colocar decisões repetitivas nas mãos de agentes supervisionados.',
      tip: 'O próximo salto é usar IA onde há decisão repetitiva (triagem, classificação, respostas), sempre com supervisão e regras claras de quando passar o caso para uma pessoa.',
    },
  ];

  // Ordem das telas. Os ids de pergunta e de contato são as próprias chaves das respostas.
  const ORDER = ['intro']
    .concat(QUIZ.map((q) => q.id), ['result'], GATE.map((g) => g.id), ['done']);
  const byId = {};
  QUIZ.concat(GATE).forEach((q) => { byId[q.id] = q; });

  const $ = (id) => document.getElementById(id);
  const stage = $('dxStage');
  const bar = $('dxBar');
  const progress = $('dxProgress');
  const actions = $('dxActions');
  const nextBtn = $('dxNext');
  const nextLabel = $('dxNextLabel');
  const backBtn = $('dxBack');
  const enterHint = $('dxEnter');

  const answers = { consent: {} };
  const history = [];
  let view = 'intro';
  let result = null;
  let sending = false;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function titleHtml(q) {
    if (q.title) return q.title;
    const safe = esc(q.text);
    return q.em ? safe.replace(esc(q.em), '<em>' + esc(q.em) + '</em>') : safe;
  }

  // ── Máscaras e validação ──
  const MASKS = {
    nome: (v) => v.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'’\- ]/g, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, 80),
    empresa: (v) => v.replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, 80),
    email: (v) => v.replace(/\s/g, '').toLowerCase().slice(0, 120),
    telefone: (v) => {
      const d = v.replace(/\D/g, '').slice(0, 11);
      if (!d.length) return '';
      if (d.length <= 2) return '(' + d;
      if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    },
  };

  function validate(q) {
    if (q.kind === 'choice') return answers[q.id] === undefined ? 'Escolha uma opção para continuar.' : null;
    if (q.kind === 'multi') return null; // pode seguir sem marcar nada
    if (q.kind === 'consent') {
      return answers.consent.politica ? null : 'Para receber o relatório, aceite a Política de Privacidade.';
    }
    const v = String(answers[q.id] || '').trim();
    if (!v) return q.required ? 'Este campo é obrigatório.' : null;
    if (q.mask === 'nome' && v.length < 2) return 'Digite o seu nome.';
    if (q.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)) return 'Digite um e-mail válido.';
    if (q.kind === 'tel') {
      const d = v.replace(/\D/g, '');
      if (d.length < 10) return 'Digite o número completo com DDD.';
      if (d.length === 11 && d[2] !== '9') return 'Verifique o número: celular começa com 9 depois do DDD.';
    }
    return null;
  }

  function showError(message) {
    const el = $('dxErr');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('on', Boolean(message));
  }

  // ── Resultado ──
  function compute() {
    const points = {};
    AREAS.forEach((a) => { points[a.id] = 0; });
    QUIZ.filter((q) => q.scored).forEach((q) => { points[q.area] += answers[q.id]; });
    const total = AREAS.reduce((sum, a) => sum + points[a.id], 0);
    const stageInfo = STAGES.find((s) => total <= s.max);
    const areas = AREAS.map((a) => {
      const p = points[a.id];
      const level = p <= a.max / 3 + 1e-9 ? 1 : p <= (2 * a.max) / 3 + 1e-9 ? 2 : 3;
      return { id: a.id, name: a.name, points: p, max: a.max, level: level };
    });
    return { total: total, maxTotal: 24, stage: stageInfo, areas: areas };
  }

  // ── Origem do acesso (só o que veio na URL e o domínio de referência) ──
  function attribution() {
    const utm = {};
    const params = new URLSearchParams(window.location.search);
    params.forEach((value, key) => { if (key.indexOf('utm_') === 0) utm[key] = value.slice(0, 200); });
    let referrer = null;
    try {
      if (document.referrer) {
        const host = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (host !== window.location.hostname.replace(/^www\./, '')) referrer = host;
      }
    } catch (e) { /* referrer inválido: ignora */ }
    return { utm: utm, referrer_dominio: referrer };
  }

  function buildPayload() {
    const respostas = QUIZ.map((q) => {
      const a = answers[q.id];
      const base = { id: q.id, pergunta: q.text };
      if (q.kind === 'multi') return Object.assign(base, { resposta: a || [] });
      return Object.assign(base, { resposta: q.options[a], valor: q.scored ? a : null });
    });
    const areas = {};
    result.areas.forEach((a) => {
      areas[a.id] = { nome: a.name, pontos: a.points, maximo: a.max, nivel: LEVELS[a.level - 1] };
    });
    const origin = attribution();
    return {
      origem: 'autodiagnostico',
      versao_textos: TEXT_VERSION,
      data_hora: new Date().toISOString(),
      pagina: window.location.origin + window.location.pathname,
      utm: origin.utm,
      referrer_dominio: origin.referrer_dominio,
      nome: String(answers.nome || '').trim(),
      email: String(answers.email || '').trim(),
      whatsapp: String(answers.whatsapp || '').trim(),
      empresa: String(answers.empresa || '').trim(),
      consentimentos: {
        politica_privacidade: answers.consent.politica === true,
        contato_comercial: answers.consent.contato === true,
      },
      resultado: {
        pontuacao: result.total,
        maximo: result.maxTotal,
        estagio: result.stage.id,
        estagio_nome: result.stage.name,
        areas: areas,
      },
      perfil: {
        tamanho: byId.tamanho.options[answers.tamanho],
        ferramentas: answers.ferramentas || [],
      },
      respostas: respostas,
    };
  }

  async function send() {
    if ($('dxWebsite').value) return true; // campo isca preenchido: provável robô, finge sucesso
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    });
    return response.ok;
  }

  // ── Renderização ──
  function eyebrowHtml(text) { return '<div class="anim dx-eyebrow">' + esc(text) + '</div>'; }

  function renderIntro() {
    return eyebrowHtml('Autodiagnóstico · cerca de 3 minutos') +
      '<h1 class="anim dx-title dx-title--xl" tabindex="-1">Em que estágio da <em>automação</em> sua empresa está?</h1>' +
      '<p class="anim dx-lead">Responda 10 perguntas rápidas e veja seu estágio na hora, com uma primeira diretriz prática. O relatório completo, com prioridades e próximos passos, chega no seu e-mail.</p>';
  }

  function renderChoice(q, index, total) {
    const multi = q.kind === 'multi';
    const selected = multi ? (answers[q.id] || []) : [q.options[answers[q.id]]];
    const label = q.scored ? AREAS.find((a) => a.id === q.area).name : q.label;
    return '<div class="anim dx-qnum">Pergunta ' + String(index).padStart(2, '0') + ' de ' + total + ' · ' + esc(label) + '</div>' +
      '<h2 class="anim dx-title" tabindex="-1">' + titleHtml(q) + '</h2>' +
      (q.hint ? '<p class="anim dx-hint">' + esc(q.hint) + '</p>' : '') +
      '<div class="anim dx-options' + (q.grid ? ' dx-options--grid' : '') + '" role="' + (multi ? 'group' : 'radiogroup') + '">' +
      q.options.map((text, n) =>
        '<button type="button" class="dx-opt' + (selected.indexOf(text) !== -1 ? ' is-selected' : '') + '" data-i="' + n + '"' +
        ' role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + (selected.indexOf(text) !== -1) + '">' +
        '<span class="dx-key">' + String.fromCharCode(65 + n) + '</span><span>' + esc(text) + '</span></button>').join('') +
      '</div><div class="dx-err" id="dxErr" role="alert"></div>';
  }

  function renderField(q, step, total) {
    return '<div class="anim dx-qnum">' + esc(q.label) + ' · ' + step + ' de ' + total + '</div>' +
      '<h2 class="anim dx-title" tabindex="-1">' + q.title + '</h2>' +
      (q.hint ? '<p class="anim dx-hint">' + esc(q.hint) + '</p>' : '') +
      '<div class="anim dx-field"><input id="dxInp" type="' + (q.kind === 'tel' ? 'tel' : q.kind === 'email' ? 'email' : 'text') + '"' +
      ' autocomplete="' + q.autocomplete + '" autocapitalize="' + (q.kind === 'email' ? 'off' : 'words') + '"' +
      (q.kind === 'tel' ? ' inputmode="tel"' : '') + ' spellcheck="false" aria-label="' + esc(q.placeholder) + '"' +
      ' placeholder="' + esc(q.placeholder) + '" value="' + esc(answers[q.id] || '') + '"><span class="dx-field__line"></span></div>' +
      '<div class="dx-err" id="dxErr" role="alert"></div>';
  }

  function renderConsent(q, step, total) {
    return '<div class="anim dx-qnum">' + esc(q.label) + ' · ' + step + ' de ' + total + '</div>' +
      '<h2 class="anim dx-title" tabindex="-1">' + q.title + '</h2>' +
      '<p class="anim dx-hint">' + q.hintHtml + '</p>' +
      '<div class="anim dx-options" role="group">' +
      q.options.map((o, n) =>
        '<button type="button" class="dx-opt' + (answers.consent[o.key] ? ' is-selected' : '') + '" data-key="' + o.key + '"' +
        ' role="checkbox" aria-checked="' + Boolean(answers.consent[o.key]) + '">' +
        '<span class="dx-key">' + String.fromCharCode(65 + n) + '</span><span>' + esc(o.text) + '</span></button>').join('') +
      '</div><div class="dx-err" id="dxErr" role="alert"></div>';
  }

  function renderResult() {
    const stageIndex = STAGES.indexOf(result.stage);
    const track = STAGES.map((s, i) =>
      '<li class="' + (i < stageIndex ? 'is-done' : i === stageIndex ? 'is-current' : '') + '"' +
      (i === stageIndex ? ' aria-current="step"' : '') + '>' + esc(s.short) + '</li>').join('');
    const areas = result.areas.map((a) =>
      '<li><span class="dx-areas__name">' + esc(a.name) + '</span><span class="dx-areas__level">' + LEVELS[a.level - 1] + '</span>' +
      '<span class="dx-seg" aria-hidden="true">' + [1, 2, 3].map((n) => '<i' + (n <= a.level ? ' class="on"' : '') + '></i>').join('') + '</span></li>').join('');
    return eyebrowHtml('Seu resultado') +
      '<h1 class="anim dx-title dx-title--xl" tabindex="-1">' + esc(result.stage.name) + '</h1>' +
      '<p class="anim dx-score">Estágio ' + (stageIndex + 1) + ' de 4 · ' + result.total + ' de ' + result.maxTotal + ' pontos</p>' +
      '<div class="anim"><ol class="dx-track" aria-label="Estágios de automação">' + track + '</ol>' +
      '<p class="dx-lead">' + esc(result.stage.text) + '</p>' +
      '<h2 class="dx-h3">Como você está em cada área</h2>' +
      '<ul class="dx-areas">' + areas + '</ul>' +
      '<div class="dx-tip"><p class="dx-tip__label">Primeiro passo recomendado</p><p>' + esc(result.stage.tip) + '</p></div>' +
      '<p class="dx-teaser">No relatório completo: nota detalhada por área, as três automações que eu priorizaria para o seu perfil e um roteiro de próximos passos.</p></div>';
  }

  function renderDone() {
    const first = String(answers.nome || '').trim().split(' ')[0];
    return eyebrowHtml('Relatório enviado') +
      '<h1 class="anim dx-title dx-title--xl" tabindex="-1">Seu relatório está a caminho' + (first ? ', <em>' + esc(first) + '</em>' : '') + '.</h1>' +
      '<p class="anim dx-lead">Enviei para <strong>' + esc(answers.email) + '</strong>. Se não aparecer em alguns minutos, confira a caixa de spam.</p>' +
      '<p class="anim dx-lead">Quer ir além do relatório? No diagnóstico gratuito, olhamos juntos os seus processos e eu aponto por onde começar.</p>' +
      '<div class="anim dx-done__btns"><a href="https://wa.me/5521995132305" class="btn btn--primary btn--lg" target="_blank" rel="noopener">Falar no WhatsApp</a>' +
      '<a href="/#contato" class="btn btn--ghost btn--lg">Solicitar diagnóstico gratuito</a></div>';
  }

  function render() {
    stage.textContent = '';
    stage.scrollTop = 0;
    const section = document.createElement('section');
    section.className = 'dx-screen';
    const pos = ORDER.indexOf(view);
    const quizIndex = QUIZ.findIndex((q) => q.id === view);
    const gateIndex = GATE.findIndex((g) => g.id === view);
    let q = null;

    if (view === 'intro') {
      section.innerHTML = renderIntro();
      nextLabel.textContent = 'Começar';
    } else if (view === 'result') {
      section.innerHTML = renderResult();
      nextLabel.textContent = 'Receber relatório';
    } else if (view === 'done') {
      section.innerHTML = renderDone();
    } else if (quizIndex >= 0) {
      q = QUIZ[quizIndex];
      section.innerHTML = renderChoice(q, quizIndex + 1, QUIZ.length);
      nextLabel.textContent = quizIndex === QUIZ.length - 1 ? 'Ver meu resultado' : 'Continuar';
    } else {
      q = GATE[gateIndex];
      section.innerHTML = q.kind === 'consent' ? renderConsent(q, gateIndex + 1, GATE.length) : renderField(q, gateIndex + 1, GATE.length);
      nextLabel.textContent = q.kind === 'consent' ? 'Enviar relatório' : 'Continuar';
    }

    stage.appendChild(section);
    const pct = Math.round((pos / (ORDER.length - 1)) * 100);
    bar.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(pct));
    actions.hidden = view === 'done';
    backBtn.hidden = view === 'intro';
    enterHint.hidden = !(q && (q.kind === 'text' || q.kind === 'email' || q.kind === 'tel'));
    nextBtn.disabled = false;

    if (q && (q.kind === 'text' || q.kind === 'email' || q.kind === 'tel')) bindField(q);
    else if (q && q.kind === 'choice') bindChoice(q);
    else if (q && q.kind === 'multi') bindMulti(q);
    else if (q && q.kind === 'consent') bindConsent(q);
    else { const h = section.querySelector('[tabindex="-1"]'); if (h) h.focus({ preventScroll: true }); }
  }

  // ── Interação ──
  function bindField(q) {
    const input = $('dxInp');
    requestAnimationFrame(() => { try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } });
    input.addEventListener('input', () => {
      const masked = MASKS[q.mask](input.value);
      if (masked !== input.value) input.value = masked;
      answers[q.id] = input.value;
      showError('');
    });
    input.addEventListener('blur', () => { input.value = input.value.trim(); answers[q.id] = input.value; });
  }

  let advanceTimer = null;
  function bindChoice(q) {
    const buttons = stage.querySelectorAll('.dx-opt');
    buttons.forEach((button) => button.addEventListener('click', () => {
      answers[q.id] = Number(button.dataset.i);
      buttons.forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
      button.classList.add('is-selected');
      button.setAttribute('aria-checked', 'true');
      showError('');
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(advance, 240); // avança sozinho; "Voltar" corrige
    }));
  }

  function bindMulti(q) {
    const buttons = stage.querySelectorAll('.dx-opt');
    buttons.forEach((button) => button.addEventListener('click', () => {
      const text = q.options[Number(button.dataset.i)];
      let picked = answers[q.id] || [];
      if (text === q.exclusive) picked = picked.indexOf(text) !== -1 ? [] : [text];
      else {
        picked = picked.filter((t) => t !== q.exclusive);
        picked = picked.indexOf(text) !== -1 ? picked.filter((t) => t !== text) : picked.concat(text);
      }
      answers[q.id] = picked;
      buttons.forEach((b) => {
        const on = picked.indexOf(q.options[Number(b.dataset.i)]) !== -1;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', String(on));
      });
    }));
  }

  function bindConsent() {
    const buttons = stage.querySelectorAll('.dx-opt');
    buttons.forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.key;
      answers.consent[key] = !answers.consent[key];
      button.classList.toggle('is-selected', answers.consent[key]);
      button.setAttribute('aria-checked', String(answers.consent[key]));
      showError('');
    }));
  }

  function leave(then) {
    const screen = stage.querySelector('.dx-screen');
    if (screen) screen.classList.add('is-leaving');
    setTimeout(then, 200);
  }

  async function advance() {
    clearTimeout(advanceTimer);
    if (sending) return;

    if (view === 'intro' || view === 'result') {
      leave(() => { history.push(view); view = ORDER[ORDER.indexOf(view) + 1]; render(); });
      return;
    }
    const q = byId[view];
    const error = validate(q);
    if (error) { showError(error); return; }

    // Última pergunta: calcula o resultado antes de mostrar
    if (view === QUIZ[QUIZ.length - 1].id) result = compute();

    if (view === 'consent') {
      sending = true;
      nextBtn.disabled = true;
      nextLabel.textContent = 'Enviando…';
      try {
        const ok = await send();
        if (!ok) throw new Error('webhook');
        sending = false;
        leave(() => { history.push(view); view = 'done'; render(); });
      } catch (err) {
        sending = false;
        nextBtn.disabled = false;
        nextLabel.textContent = 'Enviar relatório';
        showError('Não consegui enviar agora. Tente de novo em instantes ou fale comigo pelo WhatsApp.');
      }
      return;
    }
    leave(() => { history.push(view); view = ORDER[ORDER.indexOf(view) + 1]; render(); });
  }

  function back() {
    clearTimeout(advanceTimer);
    if (sending || !history.length) return;
    leave(() => { view = history.pop(); render(); });
  }

  nextBtn.addEventListener('click', advance);
  backBtn.addEventListener('click', back);

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (view === 'done') return;
    const input = $('dxInp');

    if (e.key === 'Enter') {
      if (e.target && e.target.closest && e.target.closest('a')) return;
      e.preventDefault();
      advance();
      return;
    }
    if (input) {
      // se o foco escapou do campo, a primeira tecla o traz de volta
      if (document.activeElement !== input && e.key.length === 1) input.focus({ preventScroll: true });
      return;
    }
    // atalhos A, B, C… nas telas de escolha
    const buttons = stage.querySelectorAll('.dx-opt');
    const index = e.key.length === 1 ? e.key.toUpperCase().charCodeAt(0) - 65 : -1;
    if (index >= 0 && index < buttons.length) { e.preventDefault(); buttons[index].click(); }
  });

  render();
})();
