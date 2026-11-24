/* Autodiagnóstico de automação
 * Fluxo: entrada → 10 perguntas → resultado parcial → contato + consentimento → envio ao webhook.
 * O relatório completo NÃO está neste arquivo: ele é gerado e enviado por e-mail pelo N8N.
 */
(function () {
  'use strict';

  // Webhook do N8N que recebe o diagnóstico (crie o workflow com este caminho)
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

  // Cada resposta vale de 0 a 3 pontos, na ordem das opções
  const QUESTIONS = [
    {
      id: 'atendimento_entrada', area: 'atendimento',
      text: 'Quando um novo lead ou cliente entra em contato (WhatsApp, e-mail ou formulário), o que acontece?',
      options: [
        'Alguém da equipe vê, responde e anota o contato à mão',
        'A equipe responde à mão, mas os contatos ficam registrados em um CRM ou planilha compartilhada',
        'Há uma resposta automática e o contato entra sozinho no CRM',
        'O contato é qualificado e direcionado automaticamente, com regras ou IA',
      ],
    },
    {
      id: 'atendimento_followup', area: 'atendimento',
      text: 'Como é feito o acompanhamento de leads e clientes depois do primeiro contato?',
      options: [
        'Depende de alguém lembrar ou de anotações soltas',
        'Temos lembretes no CRM ou na agenda, mas disparados manualmente',
        'Alguns follow-ups saem automaticamente por e-mail ou WhatsApp',
        'Há sequências automáticas por perfil, com alerta ao time quando o cliente responde',
      ],
    },
    {
      id: 'dados_pedido', area: 'dados',
      text: 'Quando uma venda ou pedido acontece, como a informação chega ao estoque, ao financeiro e a outros sistemas?',
      options: [
        'Alguém digita ou copia o dado em cada sistema',
        'Exportamos e importamos planilhas de tempos em tempos',
        'Alguns sistemas se conectam sozinhos, outros ainda não',
        'Tudo é sincronizado automaticamente entre os sistemas',
      ],
    },
    {
      id: 'dados_retrabalho', area: 'dados',
      text: 'Com que frequência sua equipe digita o mesmo dado em mais de um lugar?',
      options: ['O tempo todo', 'Várias vezes por semana', 'De vez em quando', 'Quase nunca'],
    },
    {
      id: 'tarefas_tempo', area: 'tarefas',
      text: 'Quanto do tempo da equipe vai para tarefas repetitivas, como copiar dados, enviar lembretes, montar relatórios e conferir planilhas?',
      options: [
        'Boa parte da semana',
        'Algumas horas por dia',
        'Algumas horas por semana',
        'Quase nada, já automatizamos a maioria',
      ],
    },
    {
      id: 'monitoramento_numeros', area: 'monitoramento',
      text: 'Como você acompanha os números do negócio (vendas, atendimento, financeiro)?',
      options: [
        'Só quando alguém levanta os dados à mão',
        'Em planilhas atualizadas manualmente',
        'Relatórios que se atualizam sozinhos, mas só em parte dos casos',
        'Dashboards em tempo real com dados de todos os sistemas',
      ],
    },
    {
      id: 'monitoramento_falhas', area: 'monitoramento',
      text: 'Se um processo falha (um pedido não sincroniza, um lead some), como você fica sabendo?',
      options: [
        'Só quando o cliente reclama',
        'Quando alguém percebe por acaso',
        'Conferimos periodicamente',
        'Recebemos um alerta automático na hora',
      ],
    },
    {
      id: 'ia_uso', area: 'ia',
      text: 'Como a IA é usada na operação hoje?',
      options: [
        'Não usamos',
        'Algumas pessoas usam por conta própria (como o ChatGPT), fora dos processos',
        'Usamos em alguns processos, com apoio manual (por exemplo, gerar respostas e revisar)',
        'Está integrada aos fluxos, como atendimento, triagem e classificação, com supervisão',
      ],
    },
  ];

  // Perguntas de perfil: não entram na pontuação
  const PROFILE = [
    {
      id: 'tamanho', type: 'single', label: 'Sobre você',
      text: 'Qual o tamanho da sua empresa?',
      options: ['Só eu', '2 a 10 pessoas', '11 a 50 pessoas', 'Mais de 50 pessoas'],
    },
    {
      id: 'ferramentas', type: 'multi', label: 'Sobre você',
      text: 'Quais ferramentas você já usa?',
      hint: 'Marque todas que se aplicam',
      options: [
        'WhatsApp', 'E-mail', 'Planilhas (Excel ou Google Sheets)', 'CRM',
        'ERP', 'E-commerce', 'Sistema próprio', 'Nenhuma ainda',
      ],
      exclusive: 'Nenhuma ainda',
    },
  ];

  const STEPS = QUESTIONS.map((q) => Object.assign({ type: 'single', scored: true }, q)).concat(PROFILE);

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

  const $ = (id) => document.getElementById(id);
  const screens = { intro: $('dxIntro'), quiz: $('dxQuiz'), result: $('dxResult'), done: $('dxDone') };

  let step = 0;
  const answers = {};   // id -> índice (única) ou lista de textos (múltipla)
  let result = null;

  function show(name) {
    Object.keys(screens).forEach((key) => { screens[key].hidden = key !== name; });
    window.scrollTo(0, 0);
    const heading = screens[name].querySelector('[tabindex="-1"]');
    if (heading) heading.focus({ preventScroll: true });
  }

  // ── Perguntas ──
  function isAnswered(q) {
    if (q.type === 'multi') return true; // pode seguir sem marcar nada
    return answers[q.id] !== undefined;
  }

  function renderStep() {
    const q = STEPS[step];
    const total = STEPS.length;
    $('dxCount').textContent = 'Pergunta ' + (step + 1) + ' de ' + total;
    $('dxArea').textContent = q.scored ? AREAS.find((a) => a.id === q.area).name : q.label;
    $('dxBar').style.width = ((step + 1) / total * 100) + '%';
    $('dxBar').parentElement.setAttribute('aria-valuenow', String(step + 1));
    $('dxNext').textContent = step === total - 1 ? 'Ver meu resultado' : 'Continuar';

    const box = $('dxQuestion');
    box.textContent = '';
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'dx-fieldset';
    const legend = document.createElement('legend');
    legend.className = 'dx-question';
    legend.tabIndex = -1;
    legend.textContent = q.text;
    fieldset.appendChild(legend);
    if (q.hint) {
      const hint = document.createElement('p');
      hint.className = 'dx-hint';
      hint.textContent = q.hint;
      fieldset.appendChild(hint);
    }

    const list = document.createElement('div');
    list.className = 'dx-options' + (q.type === 'multi' ? ' dx-options--chips' : '');
    q.options.forEach((text, index) => {
      const label = document.createElement('label');
      label.className = 'dx-option' + (q.type === 'multi' ? ' dx-option--multi' : '');
      const input = document.createElement('input');
      input.type = q.type === 'multi' ? 'checkbox' : 'radio';
      input.name = 'dx-' + q.id;
      input.value = String(index);
      if (q.type === 'multi') input.checked = (answers[q.id] || []).indexOf(text) !== -1;
      else input.checked = answers[q.id] === index;
      const dot = document.createElement('span');
      dot.className = 'dx-option__dot';
      const span = document.createElement('span');
      span.textContent = text;
      label.append(input, dot, span);
      list.appendChild(label);

      input.addEventListener('change', () => onChoose(q, index, text, list));
    });
    fieldset.appendChild(list);
    box.appendChild(fieldset);

    $('dxNext').disabled = !isAnswered(q);
    legend.focus({ preventScroll: true });
  }

  let advanceTimer = null;
  function onChoose(q, index, text, list) {
    if (q.type === 'multi') {
      const inputs = Array.from(list.querySelectorAll('input'));
      const picked = [];
      inputs.forEach((input, i) => {
        const optionText = q.options[i];
        if (!input.checked) return;
        if (q.exclusive && text === q.exclusive && optionText !== q.exclusive) { input.checked = false; return; }
        if (q.exclusive && text !== q.exclusive && optionText === q.exclusive) { input.checked = false; return; }
        picked.push(optionText);
      });
      answers[q.id] = picked;
      return;
    }
    answers[q.id] = index;
    $('dxNext').disabled = false;
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(goNext, 260); // avança sozinho; "Voltar" corrige
  }

  function goNext() {
    clearTimeout(advanceTimer);
    if (!isAnswered(STEPS[step])) return;
    if (step < STEPS.length - 1) { step += 1; renderStep(); return; }
    showResult();
  }

  function goBack() {
    clearTimeout(advanceTimer);
    if (step === 0) { show('intro'); return; }
    step -= 1;
    renderStep();
  }

  // ── Resultado ──
  function compute() {
    const points = {};
    AREAS.forEach((a) => { points[a.id] = 0; });
    QUESTIONS.forEach((q) => { points[q.area] += answers[q.id]; });
    const total = AREAS.reduce((sum, a) => sum + points[a.id], 0);
    const stage = STAGES.find((s) => total <= s.max);
    const areas = AREAS.map((a) => {
      const p = points[a.id];
      const level = p <= a.max / 3 + 1e-9 ? 1 : p <= (2 * a.max) / 3 + 1e-9 ? 2 : 3;
      return { id: a.id, name: a.name, points: p, max: a.max, level: level };
    });
    return { total: total, maxTotal: 24, stage: stage, areas: areas };
  }

  function showResult() {
    result = compute();
    const stageIndex = STAGES.indexOf(result.stage);
    $('dxStageName').textContent = result.stage.name;
    $('dxScore').textContent = 'Estágio ' + (stageIndex + 1) + ' de 4 · ' + result.total + ' de ' + result.maxTotal + ' pontos';
    $('dxStageText').textContent = result.stage.text;
    $('dxTip').textContent = result.stage.tip;

    const track = $('dxTrack');
    track.textContent = '';
    STAGES.forEach((s, i) => {
      const li = document.createElement('li');
      if (i < stageIndex) li.className = 'is-done';
      if (i === stageIndex) { li.className = 'is-current'; li.setAttribute('aria-current', 'step'); }
      li.textContent = s.short;
      track.appendChild(li);
    });

    const areas = $('dxAreas');
    areas.textContent = '';
    result.areas.forEach((a) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'dx-areas__name';
      name.textContent = a.name;
      const level = document.createElement('span');
      level.className = 'dx-areas__level';
      level.textContent = LEVELS[a.level - 1];
      const seg = document.createElement('span');
      seg.className = 'dx-seg';
      seg.setAttribute('aria-hidden', 'true');
      for (let i = 1; i <= 3; i++) {
        const s = document.createElement('i');
        if (i <= a.level) s.className = 'on';
        seg.appendChild(s);
      }
      li.append(name, level, seg);
      areas.appendChild(li);
    });

    show('result');
  }

  // ── Envio ──
  function utmParams() {
    const out = {};
    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (key.indexOf('utm_') === 0) out[key] = value.slice(0, 200);
    });
    return out;
  }

  function buildPayload(contact, contactConsent) {
    const respostas = STEPS.map((q) => {
      const a = answers[q.id];
      const base = { id: q.id, pergunta: q.text };
      if (q.type === 'multi') return Object.assign(base, { resposta: a || [] });
      return Object.assign(base, { resposta: q.options[a], valor: q.scored ? a : null });
    });
    const areas = {};
    result.areas.forEach((a) => {
      areas[a.id] = { nome: a.name, pontos: a.points, maximo: a.max, nivel: LEVELS[a.level - 1] };
    });
    return {
      origem: 'autodiagnostico',
      versao_textos: TEXT_VERSION,
      data_hora: new Date().toISOString(),
      pagina: window.location.origin + window.location.pathname,
      utm: utmParams(),
      nome: contact.nome,
      email: contact.email,
      whatsapp: contact.whatsapp,
      empresa: contact.empresa,
      consentimentos: {
        politica_privacidade: true,
        contato_comercial: contactConsent,
      },
      resultado: {
        pontuacao: result.total,
        maximo: result.maxTotal,
        estagio: result.stage.id,
        estagio_nome: result.stage.name,
        areas: areas,
      },
      perfil: {
        tamanho: PROFILE[0].options[answers.tamanho],
        ferramentas: answers.ferramentas || [],
      },
      respostas: respostas,
    };
  }

  function showFormError(message) {
    const el = $('dxFormError');
    el.textContent = message;
    el.hidden = !message;
  }

  async function onSubmit(event) {
    event.preventDefault();
    showFormError('');

    // Campo isca preenchido: provável robô, finge sucesso sem enviar
    if ($('dxWebsite').value) { $('dxDoneEmail').textContent = $('dxEmail').value; show('done'); return; }

    const contact = {
      nome: $('dxName').value.trim(),
      email: $('dxEmail').value.trim(),
      whatsapp: $('dxPhone').value.trim(),
      empresa: $('dxCompany').value.trim(),
    };
    if (!contact.nome) { showFormError('Informe seu nome.'); $('dxName').focus(); return; }
    if (!$('dxEmail').checkValidity() || !contact.email) { showFormError('Informe um e-mail válido.'); $('dxEmail').focus(); return; }
    const digits = contact.whatsapp.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) { showFormError('Informe um WhatsApp válido, com DDD.'); $('dxPhone').focus(); return; }
    if (!$('dxConsentPolicy').checked) { showFormError('Para receber o relatório, aceite a Política de Privacidade.'); $('dxConsentPolicy').focus(); return; }

    const button = $('dxSubmit');
    button.disabled = true;
    button.textContent = 'Enviando…';

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(contact, $('dxConsentContact').checked)),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      $('dxDoneEmail').textContent = contact.email;
      show('done');
    } catch (err) {
      showFormError('Não consegui enviar agora. Tente de novo em instantes ou fale comigo pelo WhatsApp.');
      button.disabled = false;
      button.textContent = 'Receber relatório completo';
    }
  }

  // ── Eventos ──
  $('dxStart').addEventListener('click', () => { step = 0; show('quiz'); renderStep(); });
  $('dxNext').addEventListener('click', goNext);
  $('dxBack').addEventListener('click', goBack);
  $('dxForm').addEventListener('submit', onSubmit);
  $('dxRestart').addEventListener('click', () => {
    Object.keys(answers).forEach((k) => { delete answers[k]; });
    result = null; step = 0;
    show('intro');
  });
})();
