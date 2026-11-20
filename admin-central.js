/* =============================================================
   ADMIN-CENTRAL.js — Central da Semana, feedback em 1 clique,
   atalhos do editor de treino, navegação entre alunos e links.
   Tudo aqui é extra: para desligar, basta remover o <script>
   deste arquivo no admin.html.
============================================================= */
(function () {
  // ---------------- AJUSTES (mude aqui se quiser) ----------------
  const DIAS_SUMIDO = 5;        // sem treinar há X dias = aluno sumido
  const DIAS_FOTOS = 30;        // pedir fotos a cada X dias
  const DIAS_FEEDBACK = 7;      // feedback semanal
  const DIAS_VENCIMENTO = 7;    // avisar renovação X dias antes
  const DIAS_OCULTAR_FEITO = 3; // depois de agir, some da lista por X dias

  const DIA_MS = 24 * 60 * 60 * 1000;
  const SITE = 'https://' + 'jhonataconsultoria.com.br';

  /* ---------------- UTILITÁRIOS ---------------- */
  const agora = () => Date.now();
  const esc = (v) => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? ''));

  function dataValida(v) {
    if (!v) return null;
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  }
  function maisRecente(...valores) {
    const ts = valores.map(dataValida).filter(Boolean);
    return ts.length ? Math.max(...ts) : null;
  }
  function diasDesde(ts) { return ts ? Math.floor((agora() - ts) / DIA_MS) : null; }
  function textoHaDias(d) {
    if (d === null) return 'nunca';
    if (d <= 0) return 'hoje';
    if (d === 1) return 'ontem';
    return `há ${d} dias`;
  }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || 'tudo bem'; }

  function dadosDoAluno(a) {
    // A listagem traz campos resumidos + "payload" com os dados completos
    return Object.assign({}, a.payload || {}, a);
  }

  function telefoneDoAluno(d) {
    const bruto = String((d.dadosAnamnese && (d.dadosAnamnese.telefone || d.dadosAnamnese.whatsapp)) || d.telefone || d.whatsapp || '').replace(/\D/g, '');
    if (!bruto) return '';
    return (bruto.length === 10 || bruto.length === 11) ? '55' + bruto : bruto;
  }
  function linkWhats(fone, msg) {
    return 'https://' + 'wa.me/' + (fone || '') + '?text=' + encodeURIComponent(msg);
  }

  function ehIsento(d) {
    const st = String(d.status_pagamento || '').toLowerCase();
    return d.isento === true || d.isento === 'true' || st === 'isento' || st === 'vip';
  }
  function temTreino(d) {
    return Array.isArray(d.days) && d.days.some(x => x && Array.isArray(x.exercicios) && x.exercicios.length > 0);
  }
  function msgTemFotos(f) {
    return (Array.isArray(f.fotos) && f.fotos.length > 0) || f.qtdFotos > 0 || /Fotos no Drive|foto\(s\) anexada|drive\.google\.com/i.test(String(f.mensagem || ''));
  }
  function ehDoPersonal(f) { return /^(PERSONAL|TREINADOR)$/i.test(String(f.autor || '')); }

  function sessoesRecentes(d, dias) {
    const limite = agora() - dias * DIA_MS;
    return (d.historico_sessoes || []).filter(s => (dataValida(s.data) || 0) >= limite);
  }

  // Evoluções de carga: compara o último registro com o anterior em cada exercício
  function evolucoesDeCarga(d) {
    const nomes = {};
    (d.days || []).forEach(day => (day.exercicios || []).forEach(ex => {
      if (ex && ex.nome && typeof sanitizeExKey === 'function') nomes[sanitizeExKey(ex.nome)] = ex.nome;
    }));
    const lista = [];
    Object.entries(d.weekly_logs || {}).forEach(([chave, hist]) => {
      if (/^\d+_\d+$/.test(chave) || !Array.isArray(hist) || hist.length < 2) return;
      const ult = hist[hist.length - 1], ant = hist[hist.length - 2];
      const c1 = parseFloat(ult.cargaMax), c0 = parseFloat(ant.cargaMax);
      const r1 = parseFloat(ult.repsMed), r0 = parseFloat(ant.repsMed);
      const nome = nomes[chave] || chave;
      if (!isNaN(c1) && !isNaN(c0) && c1 > c0) lista.push({ nome, texto: `+${+(c1 - c0).toFixed(1)} kg (${c0} → ${c1} kg)` });
      else if (!isNaN(c1) && c1 === c0 && !isNaN(r1) && !isNaN(r0) && r1 > r0) lista.push({ nome, texto: `+${r1 - r0} reps com ${c1} kg` });
    });
    return lista;
  }

  /* ---------------- MENSAGENS NÃO LIDAS ---------------- */
  // Não lida = a última mensagem é do aluno e chegou depois do "marcar como lido"
  function mensagemNaoLida(d) {
    const fbs = Array.isArray(d.feedbacks) ? d.feedbacks : [];
    const ultima = fbs[fbs.length - 1];
    if (!ultima || ehDoPersonal(ultima)) return null;
    const lido = dataValida(d.feedback_lido_em);
    if (lido && (dataValida(ultima.data) || 0) <= lido) return null;
    return ultima;
  }

  // Substitui a regra do aviso vermelho do admin: some ao responder OU ao marcar como lido
  window.alunoTemFeedbackPendente = function (aluno) {
    if (!aluno) return false;
    const d = dadosDoAluno(aluno);
    if (mensagemNaoLida(d)) return true;
    const lido = dataValida(d.feedback_lido_em);
    return d.solicitarFeedback === true && !(lido && agora() - lido < DIAS_FEEDBACK * DIA_MS);
  };

  async function marcarComoLido(codigo) {
    const res = await fetch(`${BACKEND_URL}/api/feedback/lido`, {
      method: 'POST', headers: authHeaders(), cache: 'no-cache', body: JSON.stringify({ codigo })
    });
    if (!res.ok) throw new Error('falha');
    const { feedback_lido_em } = await res.json();
    const a = (allStudentsList || []).find(x => x.codigo === codigo);
    if (a) { a.feedback_lido_em = feedback_lido_em; if (a.payload) a.payload.feedback_lido_em = feedback_lido_em; }
    if (currentStudentData && currentStudentCode === codigo) currentStudentData.feedback_lido_em = feedback_lido_em;
    if (typeof renderStudentsList === 'function') renderStudentsList(allStudentsList);
    const badge = document.getElementById('tabFeedbackBadge');
    if (badge && currentStudentCode === codigo) badge.classList.toggle('hidden', !window.alunoTemFeedbackPendente(currentStudentData));
    renderCentralSemana();
    renderBarraFeedback();
  }

  /* ---------------- EVOLUÇÃO EM % POR EXERCÍCIO ---------------- */
  // Usa "força estimada" (carga x reps, fórmula de Epley) para contar também ganho de repetições
  function forcaEstimada(reg) {
    const c = parseFloat(reg && reg.cargaMax), r = parseFloat(reg && reg.repsMed);
    if (isNaN(c) || c <= 0) return null;
    return isNaN(r) || r <= 0 ? c : c * (1 + r / 30);
  }
  function evolucaoExercicio(d, nome) {
    if (!d || !nome || typeof sanitizeExKey !== 'function') return null;
    const hist = (d.weekly_logs || {})[sanitizeExKey(nome)];
    if (!Array.isArray(hist) || hist.length < 2) return null;
    const ini = hist[0], fim = hist[hist.length - 1];
    const a = forcaEstimada(ini), b = forcaEstimada(fim);
    if (!a || !b) return null;
    return { pct: ((b - a) / a) * 100, de: `${ini.cargaMax}kg × ${ini.repsMed}`, para: `${fim.cargaMax}kg × ${fim.repsMed}`, n: hist.length };
  }
  function badgeEvolucao(ev) {
    if (!ev) return `<span class="evo-badge evo-sem" title="Precisa de pelo menos 2 treinos registrados">sem dados</span>`;
    const p = Math.round(ev.pct);
    const cls = p > 0 ? 'evo-up' : p < 0 ? 'evo-down' : 'evo-flat';
    const txt = p > 0 ? `▲ ${p}%` : p < 0 ? `▼ ${Math.abs(p)}%` : '= 0%';
    return `<span class="evo-badge ${cls}" title="${esc(ev.de)} → ${esc(ev.para)} (últimos ${ev.n} registros)">${txt}</span>`;
  }
  function aplicarBadgesEvolucao(container, d) {
    if (!container || !d) return;
    container.querySelectorAll('[onclick^="verEvolucaoSemanal"]').forEach(row => {
      if (row.querySelector('.evo-badge')) return;
      const nomeEl = row.querySelector('b');
      if (!nomeEl) return;
      const alvo = row.lastElementChild || row;
      alvo.insertAdjacentHTML('afterbegin', badgeEvolucao(evolucaoExercicio(d, nomeEl.textContent.trim())) + ' ');
    });
  }
  function resumoEvolucaoGeral(d) {
    const vistos = new Set(); const lista = [];
    (d.days || []).forEach(day => (day.exercicios || []).forEach(ex => {
      const k = ex && ex.nome && sanitizeExKey(ex.nome);
      if (!k || vistos.has(k)) return; vistos.add(k);
      const ev = evolucaoExercicio(d, ex.nome);
      if (ev) lista.push({ nome: ex.nome, ...ev });
    }));
    if (!lista.length) return '';
    const media = lista.reduce((s, x) => s + x.pct, 0) / lista.length;
    const subindo = lista.filter(x => Math.round(x.pct) > 0).sort((a, b) => b.pct - a.pct);
    const parados = lista.filter(x => Math.round(x.pct) <= 0).sort((a, b) => a.pct - b.pct);
    const m = Math.round(media);
    return `<div class="evo-geral">
      <div class="evo-geral-topo">
        <div><span>Evolução média de força</span><b class="${m > 0 ? 'evo-up-t' : m < 0 ? 'evo-down-t' : ''}">${m > 0 ? '+' : ''}${m}%</b></div>
        <div><span>Exercícios evoluindo</span><b>${subindo.length}/${lista.length}</b></div>
      </div>
      ${subindo.length ? `<div class="evo-geral-lista"><small>🔥 Mais evoluíram</small>${subindo.slice(0, 3).map(x => `<div>${esc(x.nome)} ${badgeEvolucao(x)}</div>`).join('')}</div>` : ''}
      ${parados.length ? `<div class="evo-geral-lista"><small>⚠️ Parados ou caindo — revisar</small>${parados.slice(0, 3).map(x => `<div>${esc(x.nome)} ${badgeEvolucao(x)}</div>`).join('')}</div>` : ''}
      <p class="evo-nota">Compara o primeiro e o último dos registros guardados de cada exercício, contando carga e repetições.</p>
    </div>`;
  }

  /* ---------------- "JÁ FIZ" (some da lista por alguns dias) ---------------- */
  function chaveFeito(lista, codigo) { return `central_feito_${lista}_${codigo}`; }
  function marcarFeito(lista, codigo) {
    try { localStorage.setItem(chaveFeito(lista, codigo), String(agora())); } catch (e) {}
  }
  function estaFeito(lista, codigo) {
    try {
      const t = parseInt(localStorage.getItem(chaveFeito(lista, codigo)) || '0', 10);
      return t && agora() - t < DIAS_OCULTAR_FEITO * DIA_MS;
    } catch (e) { return false; }
  }

  /* ---------------- MONTA AS LISTAS ---------------- */
  function montarListas() {
    const listas = { mensagens: [], feedback: [], sumidos: [], fotos: [], vencimento: [], semTreino: [] };
    (allStudentsList || []).forEach(a => {
      const d = dadosDoAluno(a);
      const codigo = a.codigo;
      const nome = d.clientName || d.nome || codigo;
      const isento = ehIsento(d);
      const venc = calcularDiasRestantes(d.data_expiracao, d.dia_vencimento, isento, d.status_pagamento);
      const ativo = isento || venc.dias > 0;
      const comTreino = temTreino(d);
      const inicio = dataValida(d.data_inicio || d.created_at);

      const ultimaSessao = maisRecente(...(d.historico_sessoes || []).map(s => s.data));
      const feedbacks = Array.isArray(d.feedbacks) ? d.feedbacks : [];
      const ultimoFeedback = maisRecente(d.ultimo_feedback_personal_em, ...feedbacks.filter(ehDoPersonal).map(f => f.data));
      const ultimasFotos = maisRecente(d.ultimas_fotos_em, ...feedbacks.filter(f => !ehDoPersonal(f) && msgTemFotos(f)).map(f => f.data));
      const treinosSemana = sessoesRecentes(d, DIAS_FEEDBACK).length;
      const base = { codigo, nome, fone: telefoneDoAluno(d) };

      const naoLida = mensagemNaoLida(d);
      if (naoLida) {
        const txt = String(naoLida.mensagem || '').replace(/\s+/g, ' ').trim();
        listas.mensagens.push({ ...base, ordem: -(dataValida(naoLida.data) || 0),
          detalhe: `${textoHaDias(diasDesde(dataValida(naoLida.data)))}: “${txt.length > 140 ? txt.slice(0, 140) + '…' : txt}”` });
      }

      if (!comTreino) {
        if (ativo) listas.semTreino.push({ ...base, detalhe: inicio ? `Cadastrado ${textoHaDias(diasDesde(inicio))}` : 'Treino ainda não montado' });
        return;
      }

      if (ativo && ultimaSessao && agora() - ultimaSessao <= DIAS_FEEDBACK * DIA_MS &&
          (!ultimoFeedback || agora() - ultimoFeedback > DIAS_FEEDBACK * DIA_MS)) {
        listas.feedback.push({ ...base, ordem: -treinosSemana, detalhe: `${treinosSemana} treino${treinosSemana !== 1 ? 's' : ''} nos últimos 7 dias • seu último feedback: ${textoHaDias(diasDesde(ultimoFeedback))}` });
      }

      const refSumido = ultimaSessao || inicio;
      if (ativo && refSumido && agora() - refSumido > DIAS_SUMIDO * DIA_MS && !estaFeito('sumidos', codigo)) {
        listas.sumidos.push({ ...base, ordem: -diasDesde(refSumido), detalhe: ultimaSessao ? `Último treino ${textoHaDias(diasDesde(ultimaSessao))}` : 'Nenhum treino registrado ainda' });
      }

      const refFotos = ultimasFotos || inicio;
      if (ativo && (!refFotos || agora() - refFotos > DIAS_FOTOS * DIA_MS) && !estaFeito('fotos', codigo)) {
        listas.fotos.push({ ...base, ordem: -(diasDesde(refFotos) || 9999), detalhe: ultimasFotos ? `Últimas fotos ${textoHaDias(diasDesde(ultimasFotos))}` : 'Nenhuma foto recebida ainda' });
      }

      if (!isento && venc.dias <= DIAS_VENCIMENTO && venc.dias > -30 && !estaFeito('vencimento', codigo)) {
        listas.vencimento.push({ ...base, ordem: venc.dias, dias: venc.dias, data: venc.dataFormatada,
          detalhe: venc.dias > 0 ? `Vence em ${venc.dias} dia${venc.dias !== 1 ? 's' : ''} (${venc.dataFormatada})` : `Venceu em ${venc.dataFormatada}` });
      }
    });
    Object.values(listas).forEach(l => l.sort((x, y) => (x.ordem || 0) - (y.ordem || 0)));
    return listas;
  }

  /* ---------------- MENSAGENS PRONTAS ---------------- */
  const MSG = {
    sumido: (n) => `Fala ${primeiroNome(n)}, tudo certo? Vi que você não registrou treino nos últimos dias. Aconteceu alguma coisa? Me conta pra gente ajustar o que for preciso — o resultado vem da constância! 💪`,
    fotos: (n) => `Fala ${primeiroNome(n)}! 📸 Chegou a hora de atualizar suas fotos pra eu avaliar sua evolução. Manda pelo app, na aba Feedback: frente, costas e lado, com a mesma luz e de preferência pela manhã.`,
    vencimento: (n, it) => it.dias > 0
      ? `Fala ${primeiroNome(n)}! Passando pra avisar que seu plano vence em ${it.dias} dia${it.dias !== 1 ? 's' : ''} (${it.data}). Bora renovar pra não perder o ritmo? Te mando as opções por aqui. 💪`
      : `Fala ${primeiroNome(n)}! Seu plano venceu em ${it.data}. Quer renovar pra gente continuar sua evolução? Te mando as opções por aqui. 💪`
  };

  /* ---------------- TELA: CENTRAL DA SEMANA ---------------- */
  function garantirSecaoCentral() {
    if (document.getElementById('secCentral')) return;
    const main = document.querySelector('main.admin-content');
    const nav = document.querySelector('nav.admin-tabs');
    if (!main || !nav) return;

    const sec = document.createElement('section');
    sec.id = 'secCentral';
    sec.className = 'tab-section panel-card hidden';
    nav.insertAdjacentElement('afterend', sec);

    const btn = document.createElement('button');
    btn.id = 'tabCentral';
    btn.className = 'tab-btn';
    btn.type = 'button';
    btn.innerHTML = '🏠 Central da Semana';
    btn.onclick = () => switchTab('central');
    nav.insertBefore(btn, nav.firstChild);

    // Atalho também na barra lateral
    const ferramentas = [...document.querySelectorAll('#sidebarConsultoria .panel-title')].find(el => /Ferramentas/.test(el.textContent));
    if (ferramentas) {
      const b2 = document.createElement('button');
      b2.className = 'btn btn-md full-width central-sidebar-btn';
      b2.innerHTML = '🏠 Central da Semana';
      b2.onclick = () => switchTab('central');
      ferramentas.insertAdjacentElement('afterend', b2);
    }
  }

  function cardItem(lista, it, acoes) {
    return `<div class="central-item" data-lista="${lista}" data-codigo="${esc(it.codigo)}">
      <div class="central-item-info"><b>${esc(it.nome)}</b><small>${esc(it.detalhe)}</small></div>
      <div class="central-item-acoes">${acoes}</div>
    </div>`;
  }

  function bloco(id, icone, titulo, descricao, itens, renderAcoes, vazio) {
    const corpo = itens.length
      ? itens.map(it => cardItem(id, it, renderAcoes(it))).join('')
      : `<div class="central-vazio">${vazio}</div>`;
    return `<div class="central-bloco" id="central_${id}">
      <div class="central-bloco-topo"><span>${icone} ${titulo}</span><b class="${itens.length ? 'tem' : ''}">${itens.length}</b></div>
      <p class="central-desc">${descricao}</p>
      ${corpo}
    </div>`;
  }

  function renderCentralSemana() {
    garantirSecaoCentral();
    const sec = document.getElementById('secCentral');
    if (!sec) return;
    const L = montarListas();
    const total = L.mensagens.length + L.feedback.length + L.sumidos.length + L.fotos.length + L.vencimento.length + L.semTreino.length;
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

    const bAbrir = (it, aba, rotulo) => `<button type="button" class="btn btn-soft sm" data-acao="abrir" data-aba="${aba}">${rotulo}</button>`;
    const bWhats = (it, tipo, rotulo) => `<a class="btn btn-wpp sm" data-acao="whats" data-tipo="${tipo}" target="_blank" rel="noopener" href="${linkWhats(it.fone, MSG[tipo](it.nome, it))}">${rotulo}</a>`;

    sec.innerHTML = `
      <div class="panel-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <span>🏠 Central da Semana</span>
        <button type="button" class="btn btn-soft sm" onclick="fetchAlunos()">🔄 Atualizar</button>
      </div>
      <p class="central-hoje">${esc(hoje.charAt(0).toUpperCase() + hoje.slice(1))} • ${total ? `<b>${total}</b> ${total === 1 ? 'tarefa' : 'tarefas'} para hoje` : 'Tudo em dia! 🎉'}</p>
      <div class="central-resumo">
        <a href="#central_mensagens"><b>${L.mensagens.length}</b><span>Mensagens</span></a>
        <a href="#central_feedback"><b>${L.feedback.length}</b><span>Feedbacks</span></a>
        <a href="#central_sumidos"><b>${L.sumidos.length}</b><span>Sumidos</span></a>
        <a href="#central_fotos"><b>${L.fotos.length}</b><span>Fotos</span></a>
        <a href="#central_vencimento"><b>${L.vencimento.length}</b><span>Renovações</span></a>
        <a href="#central_semTreino"><b>${L.semTreino.length}</b><span>Sem treino</span></a>
      </div>
      <div class="central-grid">
        ${bloco('mensagens', '📨', 'Mensagens não lidas', 'O que os alunos te escreveram e você ainda não viu.', L.mensagens,
          it => `<button type="button" class="btn btn-gold sm" data-acao="abrir" data-aba="feedbackAdmin">Responder</button><button type="button" class="btn btn-soft sm" data-acao="lido">✓ Lido</button>`, 'Nenhuma mensagem nova. ✅')}
        ${bloco('feedback', '💬', 'Feedback pendente', `Treinaram nos últimos ${DIAS_FEEDBACK} dias e ainda não receberam seu feedback.`, L.feedback,
          it => bAbrir(it, 'feedbackAdmin', '💬 Dar feedback'), 'Nenhum feedback pendente.')}
        ${bloco('sumidos', '👻', 'Alunos sumidos', `Sem registrar treino há mais de ${DIAS_SUMIDO} dias.`, L.sumidos,
          it => bWhats(it, 'sumido', '📲 Cobrar') + bAbrir(it, 'resumo', 'Abrir'), 'Ninguém sumido. 💪')}
        ${bloco('fotos', '📸', 'Hora das fotos', `Sem enviar fotos há mais de ${DIAS_FOTOS} dias.`, L.fotos,
          it => bWhats(it, 'fotos', '📲 Pedir no WhatsApp') + `<button type="button" class="btn btn-soft sm" data-acao="fotosApp">📱 Pedir no app</button>`, 'Fotos em dia.')}
        ${bloco('vencimento', '📅', 'Renovações', `Vencem nos próximos ${DIAS_VENCIMENTO} dias ou já venceram.`, L.vencimento,
          it => bWhats(it, 'vencimento', '📲 Mandar renovação') + bAbrir(it, 'cadastro', 'Abrir'), 'Nenhuma renovação próxima.')}
        ${bloco('semTreino', '🆕', 'Sem treino montado', 'Alunos ativos com o treino ainda vazio.', L.semTreino,
          it => bAbrir(it, 'treino', '🏋️ Montar treino'), 'Todos com treino. ✅')}
      </div>
      <p class="central-rodape">Depois que você age (WhatsApp ou app), o aluno sai da lista por ${DIAS_OCULTAR_FEITO} dias. Feedbacks saem sozinhos quando você responde.</p>
    `;
  }

  // Cliques nas ações da Central
  document.addEventListener('click', async (e) => {
    const alvo = e.target.closest('#secCentral [data-acao]');
    if (!alvo) return;
    const item = alvo.closest('.central-item');
    if (!item) return;
    const codigo = item.dataset.codigo;
    const lista = item.dataset.lista;
    const acao = alvo.dataset.acao;

    if (acao === 'abrir') {
      e.preventDefault();
      await carregarAluno(codigo);
      switchTab(alvo.dataset.aba || 'resumo');
      return;
    }
    if (acao === 'lido') {
      e.preventDefault();
      alvo.disabled = true;
      try { await marcarComoLido(codigo); showToast('Marcado como lido.', 'success'); }
      catch (err) { alvo.disabled = false; showToast('Não foi possível marcar como lido.', 'error'); }
      return;
    }
    if (acao === 'whats') {
      marcarFeito(lista, codigo);
      setTimeout(renderCentralSemana, 300);
      return;
    }
    if (acao === 'fotosApp') {
      e.preventDefault();
      const aluno = (allStudentsList || []).find(a => a.codigo === codigo);
      const nome = aluno ? (aluno.clientName || aluno.nome) : codigo;
      alvo.disabled = true;
      try {
        const res = await fetch(`${BACKEND_URL}/api/feedback/enviar`, {
          method: 'POST', headers: authHeaders(), cache: 'no-cache',
          body: JSON.stringify({ codigo, autor: 'PERSONAL', mensagem: MSG.fotos(nome) })
        });
        if (!res.ok) throw new Error('falha');
        marcarFeito('fotos', codigo);
        showToast(`Pedido de fotos enviado para ${primeiroNome(nome)} no app.`, 'success');
        renderCentralSemana();
      } catch (err) {
        alvo.disabled = false;
        showToast('Não foi possível enviar pelo app. Tente pelo WhatsApp.', 'error');
      }
    }
  });

  /* ---------------- FEEDBACK EM 1 CLIQUE ---------------- */
  function resumoSemanaAluno(d) {
    const sessoes = sessoesRecentes(d, DIAS_FEEDBACK);
    const minutos = sessoes.map(s => parseInt(s.duracaoMinutos, 10)).filter(n => n > 0);
    const media = minutos.length ? Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length) : null;
    const obs = sessoes.flatMap(s => (s.observacoes || []).map(o => `${new Date(s.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: ${o}`));
    return { n: sessoes.length, media, evolucoes: evolucoesDeCarga(d), obs, titulos: sessoes.map(s => s.treinoTitulo) };
  }

  const MODELOS_FEEDBACK = {
    parabens: (d, r) => {
      let t = `Fala ${primeiroNome(d.clientName)}! 💪 Feedback da semana:\n\n✅ ${r.n} treino${r.n !== 1 ? 's' : ''} registrado${r.n !== 1 ? 's' : ''} nos últimos 7 dias`;
      if (r.evolucoes.length) t += `\n\n📈 Evoluções:\n${r.evolucoes.slice(0, 6).map(e => `• ${e.nome}: ${e.texto}`).join('\n')}`;
      t += `\n\nMandou muito bem! Segue nesse ritmo que o resultado aparece. Qualquer coisa me chama.`;
      return t;
    },
    cobranca: (d, r) => `Fala ${primeiroNome(d.clientName)}, tudo certo? ${r.n === 0 ? 'Essa semana não teve nenhum treino registrado no app' : `Essa semana teve só ${r.n} treino registrado no app`}. O que aconteceu? Me conta pra gente ajustar o que for preciso — sem constância não tem resultado, e eu quero ver você evoluindo! 💪`,
    fotos: (d) => MSG.fotos(d.clientName),
    ajuste: (d) => `Fala ${primeiroNome(d.clientName)}! Fiz alguns ajustes no seu treino com base na sua evolução. Dá uma olhada no app e me conta como foi no primeiro treino com as mudanças. 💪`
  };

  function garantirFerramentasFeedback() {
    const sec = document.getElementById('secFeedbackAdmin');
    const input = document.getElementById('adminFeedbackInput');
    if (!sec || !input || document.getElementById('feedbackRapido')) return;
    const box = document.createElement('div');
    box.id = 'feedbackRapido';
    box.innerHTML = `
      <div id="feedbackBarra" class="feedback-barra"></div>
      <div id="feedbackAnaliseIA" class="feedback-ia hidden"></div>
      <div id="feedbackResumoSemana" class="feedback-resumo"></div>
      <div class="feedback-chips">
        <span>Mensagens prontas:</span>
        <button type="button" data-modelo="parabens">🏆 Parabéns + evolução</button>
        <button type="button" data-modelo="cobranca">⚠️ Cobrança</button>
        <button type="button" data-modelo="fotos">📸 Pedir fotos</button>
        <button type="button" data-modelo="ajuste">🔧 Avisar ajuste no treino</button>
      </div>`;
    input.parentElement.insertBefore(box, input);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-modelo]');
      if (!b || !currentStudentData) return;
      const d = currentStudentData;
      input.value = MODELOS_FEEDBACK[b.dataset.modelo](d, resumoSemanaAluno(d));
      input.focus();
      showToast('Mensagem pronta! Revise e clique em ENVIAR RESPOSTA.', 'info');
    });
  }

  function renderBarraFeedback() {
    const bar = document.getElementById('feedbackBarra');
    if (!bar || !currentStudentData) return;
    const naoLida = mensagemNaoLida(currentStudentData);
    bar.innerHTML = `
      <span class="${naoLida ? 'fb-status-novo' : 'fb-status-ok'}">${naoLida ? '🔴 Mensagem nova do aluno' : '✅ Nada pendente para ler'}</span>
      <div class="feedback-barra-botoes">
        ${naoLida ? '<button type="button" class="btn btn-soft sm" id="btnMarcarLido">✓ Marcar como lido</button>' : ''}
        <button type="button" class="btn btn-gold sm" id="btnAnalisarIA">🧠 Analisar feedback com IA</button>
      </div>`;
    const bl = document.getElementById('btnMarcarLido');
    if (bl) bl.onclick = async () => {
      bl.disabled = true;
      try { await marcarComoLido(currentStudentCode); showToast('Marcado como lido.', 'success'); }
      catch (err) { bl.disabled = false; showToast('Não foi possível marcar como lido.', 'error'); }
    };
    document.getElementById('btnAnalisarIA').onclick = analisarFeedbackIA;
  }

  const ROTULO_PONTO = { dor: '🩹 Dor', duvida: '❓ Dúvida', pedido: '🙋 Pedido', dificuldade: '😓 Dificuldade', elogio: '🙌 Elogio', outro: '💬 Outro' };

  async function analisarFeedbackIA() {
    const box = document.getElementById('feedbackAnaliseIA');
    const btn = document.getElementById('btnAnalisarIA');
    if (!box || !currentStudentCode) return;
    const codigoAnalisado = currentStudentCode;
    box.classList.remove('hidden');
    box.innerHTML = '<div class="feedback-ia-carregando">🧠 Lendo as mensagens e as observações dos treinos...</div>';
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/analisar-feedback-ia`, {
        method: 'POST', headers: authHeaders(), cache: 'no-cache', body: JSON.stringify({ codigo: codigoAnalisado })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.analise) throw new Error(data.error || 'Falha na análise.');
      if (codigoAnalisado !== currentStudentCode) return;
      const a = data.analise;
      box.innerHTML = `
        <div class="feedback-ia-topo">
          <b>🧠 Análise do feedback</b>
          <span class="ia-humor ia-${esc(a.humor)}">${a.urgente ? '🚨 Atenção' : a.humor === 'positivo' ? '😀 Positivo' : a.humor === 'preocupante' ? '⚠️ Preocupante' : '😐 Neutro'}</span>
        </div>
        <p class="feedback-ia-resumo">${esc(a.resumo)}</p>
        ${a.pontos.length ? `<div class="feedback-ia-pontos">${a.pontos.map(p => `
          <div class="ia-ponto"><span class="ia-tipo">${ROTULO_PONTO[p.tipo] || ROTULO_PONTO.outro}</span>
          <div><div>${esc(p.texto)}</div>${p.acao ? `<small>👉 ${esc(p.acao)}</small>` : ''}</div></div>`).join('')}</div>` : ''}
        ${a.resposta_sugerida ? `<div class="feedback-ia-resposta"><small>Resposta sugerida</small><div>${esc(a.resposta_sugerida).replace(/\n/g, '<br>')}</div>
          <button type="button" class="btn btn-gold sm" id="btnUsarRespostaIA">✍️ Usar essa resposta</button></div>` : ''}
        ${a.ajustes_treino.length ? `<div class="feedback-ia-ajustes"><small>Ajustes sugeridos no treino</small>${a.ajustes_treino.map((t, i) => `
          <div class="ia-ajuste"><span>${esc(t)}</span><button type="button" class="btn btn-soft sm" data-ajuste="${i}">🏋️ Levar para o treino</button></div>`).join('')}</div>` : ''}
        <p class="evo-nota">Sugestões da IA: revise antes de enviar ou aplicar.</p>`;
      const usar = document.getElementById('btnUsarRespostaIA');
      if (usar) usar.onclick = () => {
        const input = document.getElementById('adminFeedbackInput');
        input.value = a.resposta_sugerida; input.focus();
        showToast('Resposta colocada no campo. Revise e clique em ENVIAR RESPOSTA.', 'info');
      };
      box.querySelectorAll('[data-ajuste]').forEach(b => b.onclick = () => {
        switchTab('treino');
        const cmd = document.getElementById('aiWorkoutCommand');
        if (cmd) { cmd.value = a.ajustes_treino[parseInt(b.dataset.ajuste, 10)]; cmd.focus(); cmd.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        showToast('Ajuste colocado no "Comando para a ficha". Confira e clique em APLICAR VIA AUXILIAR.', 'info');
      });
    } catch (err) {
      box.innerHTML = `<div class="feedback-ia-carregando">❌ ${esc(err.message || 'Não foi possível analisar agora.')}</div>`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderResumoFeedback() {
    garantirFerramentasFeedback();
    renderBarraFeedback();
    const ia = document.getElementById('feedbackAnaliseIA');
    if (ia && ia.dataset.aluno !== currentStudentCode) { ia.classList.add('hidden'); ia.innerHTML = ''; ia.dataset.aluno = currentStudentCode; }
    const box = document.getElementById('feedbackResumoSemana');
    if (!box || !currentStudentData) return;
    const r = resumoSemanaAluno(currentStudentData);
    box.innerHTML = `
      <div class="feedback-resumo-topo">📊 Últimos 7 dias</div>
      <div class="feedback-resumo-nums">
        <div><b>${r.n}</b><span>treinos</span></div>
        <div><b>${r.media ? r.media + ' min' : '—'}</b><span>duração média</span></div>
        <div><b>${r.evolucoes.length}</b><span>evoluções</span></div>
      </div>
      ${r.evolucoes.length ? `<div class="feedback-resumo-lista">${r.evolucoes.slice(0, 6).map(e => `📈 <b>${esc(e.nome)}</b>: ${esc(e.texto)}`).join('<br>')}</div>` : ''}
      ${r.obs.length ? `<div class="feedback-resumo-lista">${r.obs.slice(-4).map(o => `📝 ${esc(o)}`).join('<br>')}</div>` : ''}`;
  }

  /* ---------------- EDITOR DE TREINO: COPIAR E MODELOS ---------------- */
  const CHAVE_MODELOS = 'modelos_treino_admin';
  function lerModelos() { try { return JSON.parse(localStorage.getItem(CHAVE_MODELOS) || '[]'); } catch (e) { return []; } }
  function gravarModelos(l) { try { localStorage.setItem(CHAVE_MODELOS, JSON.stringify(l)); } catch (e) {} }

  function textoDosDias(days) {
    return (days || []).map(day => {
      const linhas = (day.exercicios || []).map(ex => (typeof linhaTextoExercicio === 'function' ? linhaTextoExercicio(ex, day.isDescanso) : ex.nome));
      return [day.title, ...linhas].join('\n');
    }).join('\n\n');
  }

  function colocarNoEditor(texto) {
    const tx = document.getElementById('liveWorkoutText');
    if (!tx) return;
    if (tx.value.trim() && !confirm('Isso vai substituir o texto atual do editor. Continuar?')) return;
    tx.value = texto;
    tx.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof atualizarPreviewAoVivo === 'function') atualizarPreviewAoVivo();
    showToast('Treino colocado no editor. Ajuste e clique em salvar.', 'info');
  }

  function garantirFerramentasTreino() {
    const tx = document.getElementById('liveWorkoutText');
    if (!tx || document.getElementById('treinoAtalhos')) return;
    const box = document.createElement('div');
    box.id = 'treinoAtalhos';
    box.className = 'treino-atalhos';
    box.innerHTML = `
      <div class="treino-atalho-linha">
        <select id="copiarTreinoDe"><option value="">📋 Copiar treino de outro aluno...</option></select>
        <button type="button" class="btn btn-soft sm" id="btnCopiarTreino">Copiar</button>
      </div>
      <div class="treino-atalho-linha">
        <select id="usarModeloTreino"><option value="">📂 Usar um modelo de treino...</option></select>
        <button type="button" class="btn btn-soft sm" id="btnUsarModelo">Usar</button>
        <button type="button" class="btn btn-soft sm" id="btnApagarModelo" title="Apagar modelo">🗑</button>
        <button type="button" class="btn btn-gold sm" id="btnSalvarModelo">💾 Salvar como modelo</button>
      </div>`;
    const label = tx.previousElementSibling && tx.previousElementSibling.tagName === 'LABEL' ? tx.previousElementSibling : tx;
    label.parentElement.insertBefore(box, label);

    document.getElementById('btnCopiarTreino').onclick = () => {
      const cod = document.getElementById('copiarTreinoDe').value;
      const a = (allStudentsList || []).find(x => x.codigo === cod);
      if (!a) return showToast('Escolha um aluno.', 'error');
      const d = dadosDoAluno(a);
      if (!temTreino(d)) return showToast('Esse aluno ainda não tem treino.', 'error');
      colocarNoEditor(textoDosDias(d.days));
    };
    document.getElementById('btnSalvarModelo').onclick = () => {
      const texto = tx.value.trim();
      if (!texto) return showToast('O editor está vazio.', 'error');
      const nome = (prompt('Nome do modelo (ex.: Hipertrofia ABC iniciante):') || '').trim();
      if (!nome) return;
      const modelos = lerModelos().filter(m => m.nome !== nome);
      modelos.push({ nome, texto, criado: new Date().toISOString() });
      gravarModelos(modelos);
      atualizarSelectsTreino();
      showToast(`Modelo "${nome}" salvo.`, 'success');
    };
    document.getElementById('btnUsarModelo').onclick = () => {
      const m = lerModelos().find(x => x.nome === document.getElementById('usarModeloTreino').value);
      if (!m) return showToast('Escolha um modelo.', 'error');
      colocarNoEditor(m.texto);
    };
    document.getElementById('btnApagarModelo').onclick = () => {
      const nome = document.getElementById('usarModeloTreino').value;
      if (!nome || !confirm(`Apagar o modelo "${nome}"?`)) return;
      gravarModelos(lerModelos().filter(m => m.nome !== nome));
      atualizarSelectsTreino();
    };
    atualizarSelectsTreino();
  }

  function atualizarSelectsTreino() {
    const selAluno = document.getElementById('copiarTreinoDe');
    const selModelo = document.getElementById('usarModeloTreino');
    if (selAluno) {
      const outros = (allStudentsList || []).filter(a => a.codigo !== currentStudentCode && temTreino(dadosDoAluno(a)))
        .sort((x, y) => String(x.clientName || '').localeCompare(String(y.clientName || ''), 'pt-BR'));
      selAluno.innerHTML = '<option value="">📋 Copiar treino de outro aluno...</option>' +
        outros.map(a => `<option value="${esc(a.codigo)}">${esc(a.clientName || a.codigo)}</option>`).join('');
    }
    if (selModelo) {
      const modelos = lerModelos();
      selModelo.innerHTML = `<option value="">📂 ${modelos.length ? 'Usar um modelo de treino...' : 'Nenhum modelo salvo ainda'}</option>` +
        modelos.map(m => `<option value="${esc(m.nome)}">${esc(m.nome)}</option>`).join('');
    }
  }

  /* ---------------- PRÓXIMO / ANTERIOR ALUNO ---------------- */
  let ultimaAbaAluno = 'resumo';
  const ABAS_DE_ALUNO = ['resumo', 'treino', 'dieta', 'corrida', 'ergogenicos', 'anamnese', 'feedbackAdmin', 'cadastro'];

  function listaOrdenada() {
    return [...(allStudentsList || [])].sort((x, y) => String(x.clientName || x.codigo).localeCompare(String(y.clientName || y.codigo), 'pt-BR'));
  }

  function garantirNavegacaoAlunos() {
    const nav = document.querySelector('nav.admin-tabs');
    if (!nav || document.getElementById('navAlunos')) return;
    const bar = document.createElement('div');
    bar.id = 'navAlunos';
    bar.className = 'nav-alunos hidden';
    bar.innerHTML = `
      <button type="button" id="btnAlunoAnterior" title="Aluno anterior">◀</button>
      <span id="navAlunoNome"></span>
      <button type="button" id="btnAlunoProximo" title="Próximo aluno">▶</button>`;
    nav.insertAdjacentElement('beforebegin', bar);
    const ir = async (passo) => {
      const l = listaOrdenada();
      if (!l.length) return;
      let i = l.findIndex(a => a.codigo === currentStudentCode);
      i = (i + passo + l.length) % l.length;
      await carregarAluno(l[i].codigo);
      switchTab(ultimaAbaAluno);
    };
    document.getElementById('btnAlunoAnterior').onclick = () => ir(-1);
    document.getElementById('btnAlunoProximo').onclick = () => ir(1);
  }

  function atualizarNavegacaoAlunos() {
    garantirNavegacaoAlunos();
    const bar = document.getElementById('navAlunos');
    if (!bar) return;
    const l = listaOrdenada();
    const i = l.findIndex(a => a.codigo === currentStudentCode);
    if (i === -1) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    document.getElementById('navAlunoNome').textContent = `${l[i].clientName || l[i].codigo}  (${i + 1}/${l.length})`;
  }

  /* ---------------- LINKS DE VENDA (a partir de planos.js) ---------------- */
  function atualizarLinksVenda() {
    const box = document.getElementById('conteudoLinksAdmin');
    if (!box || typeof PLANOS === 'undefined') return;
    const linhas = Object.entries(PLANOS).map(([id, p]) => {
      const link = `${SITE}/app.html?modo=anamnese${p.tipo === 'treino' ? '&tipo=treino' : ''}&plano=${id}`;
      return `<div class="link-item-row"><span class="link-nome">${esc(p.nome)}</span><button class="btn-link-copy" data-link="${esc(link)}">📋 Copiar</button></div>`;
    }).join('');
    const extras = [
      ['Página de vendas (site)', `${SITE}/`],
      ['Amigos — Treino (valor a combinar)', LINKS_ANAMNESE_GERADOR.amigos_treino],
      ['Amigos — Completa (valor a combinar)', LINKS_ANAMNESE_GERADOR.amigos_completa],
      ['2ª pessoa da dupla — Treino', LINKS_ANAMNESE_GERADOR.dupla_treino],
      ['2ª pessoa da dupla — Completa', LINKS_ANAMNESE_GERADOR.dupla_completa]
    ].map(([nome, link]) => `<div class="link-item-row"><span class="link-nome">${esc(nome)}</span><button class="btn-link-copy" data-link="${esc(link)}">📋 Copiar</button></div>`).join('');
    box.innerHTML = `
      <small style="color:var(--muted); font-size:11px; display:block; margin-bottom:8px;">Avaliação já com o plano travado (a pessoa vai direto para o pagamento certo):</small>
      ${linhas}
      <div style="margin-top:8px; border-top:1px dashed var(--border); padding-top:8px;"></div>
      ${extras}`;
    box.onclick = (e) => {
      const b = e.target.closest('[data-link]');
      if (b) copiarLinkVenda(b.dataset.link);
    };
  }

  /* ---------------- LIGAÇÃO COM O ADMIN EXISTENTE ---------------- */
  const switchTabOriginal = window.switchTab;
  window.switchTab = function (tab) {
    const sec = document.getElementById('secCentral');
    if (tab === 'central') {
      switchTabOriginal('central'); // esconde as outras seções
      garantirSecaoCentral();
      renderCentralSemana();
      document.getElementById('secCentral').classList.remove('hidden');
      const b = document.getElementById('tabCentral');
      if (b) b.classList.add('active');
      return;
    }
    if (sec) sec.classList.add('hidden');
    switchTabOriginal(tab);
    if (ABAS_DE_ALUNO.includes(tab)) ultimaAbaAluno = tab;
    if (tab === 'feedbackAdmin') renderResumoFeedback();
    if (tab === 'treino') { garantirFerramentasTreino(); atualizarSelectsTreino(); }
  };

  /* ---------------- BUSCA AUTOMÁTICA DE FOTOS COM IA ---------------- */
  // Exercícios que o catálogo não reconheceu são procurados pela IA no banco completo (876)
  const tentadosIA = new Set();
  let timerBuscaIA = null, buscandoIA = false, statusIA = null;

  function mostrarStatusIA() {
    const prev = document.getElementById('liveWorkoutPreview');
    if (!prev || !statusIA || agora() - statusIA.quando > 15000) return;
    let el = document.getElementById('iaBuscaStatus');
    if (!el) { el = document.createElement('div'); el.id = 'iaBuscaStatus'; prev.insertBefore(el, prev.firstChild); }
    el.className = `ia-busca-status ${statusIA.tipo}`;
    el.textContent = statusIA.texto;
  }
  function definirStatusIA(texto, tipo) { statusIA = { texto, tipo, quando: agora() }; mostrarStatusIA(); }

  function agendarBuscaIA() {
    clearTimeout(timerBuscaIA);
    timerBuscaIA = setTimeout(buscarFaltantesIA, 1500);
  }

  async function buscarFaltantesIA() {
    if (buscandoIA) return agendarBuscaIA();
    const prev = document.getElementById('liveWorkoutPreview');
    if (!prev) return;
    const nomes = [];
    prev.querySelectorAll('button[data-ex]').forEach(b => {
      if (b.querySelector('img, video')) return;
      const nome = (b.dataset.ex || '').trim();
      const k = nome && sanitizeExKey(nome);
      if (!k || tentadosIA.has(k) || nomes.some(n => sanitizeExKey(n) === k)) return;
      nomes.push(nome);
    });
    if (!nomes.length) return;
    const lote = nomes.slice(0, 25);
    lote.forEach(n => tentadosIA.add(sanitizeExKey(n)));
    buscandoIA = true;
    definirStatusIA(`🔎 Procurando foto para ${lote.length} exercício${lote.length > 1 ? 's' : ''} com IA...`, 'buscando');
    try {
      const res = await fetch(`${BACKEND_URL}/api/exercicios/buscar-ia`, {
        method: 'POST', headers: authHeaders(), cache: 'no-cache', body: JSON.stringify({ nomes: lote })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'falha');
      const achados = (data.resultados || []).filter(r => r.url);
      achados.forEach(r => {
        gifsDatabase = [{ nome: r.nome, url: r.url }, ...gifsDatabase.filter(g => sanitizeExKey(g.nome) !== sanitizeExKey(r.nome))];
      });
      const faltou = lote.length - achados.length;
      definirStatusIA(achados.length
        ? `🧠 IA encontrou foto para ${achados.length} de ${lote.length}.${faltou ? ` Para ${faltou === 1 ? 'o outro' : `os outros ${faltou}`}, use o ➕.` : ''}`
        : `A IA não achou foto parecida para ${lote.length === 1 ? 'esse exercício' : 'esses exercícios'}. Use o ➕ para escolher ou enviar uma.`, achados.length ? 'ok' : 'aviso');
      if (achados.length && typeof atualizarPreviewAoVivo === 'function') atualizarPreviewAoVivo();
      if (nomes.length > lote.length) agendarBuscaIA();
    } catch (err) {
      lote.forEach(n => tentadosIA.delete(sanitizeExKey(n)));
      definirStatusIA('Não foi possível buscar com IA agora. Tente de novo em instantes ou use o ➕.', 'aviso');
    } finally {
      buscandoIA = false;
    }
  }

  // Botão "Buscar com IA" dentro da janela do ➕
  function garantirBotaoIAModal() {
    const auto = document.querySelector('#midiaModal [onclick="midiaAutomaticaExercicio()"]');
    if (!auto || document.getElementById('btnMidiaIA')) return;
    const b = document.createElement('button');
    b.id = 'btnMidiaIA'; b.type = 'button'; b.className = 'btn btn-gold btn-md'; b.style.flex = '1';
    b.textContent = '🧠 Buscar com IA';
    auto.parentElement.insertBefore(b, auto);
    b.onclick = async () => {
      if (!midiaModalExNome) return;
      b.disabled = true; const txt = b.textContent; b.textContent = '🔎 Buscando...';
      try {
        const res = await fetch(`${BACKEND_URL}/api/exercicios/buscar-ia`, {
          method: 'POST', headers: authHeaders(), cache: 'no-cache', body: JSON.stringify({ nomes: [midiaModalExNome], forcar: true })
        });
        const data = await res.json().catch(() => ({}));
        const r = (data.resultados || [])[0];
        if (!res.ok || !r) throw new Error('falha');
        if (r.url) { aplicarMidiaExercicio(r.url); showToast('A IA encontrou uma foto. Confira na prévia.', 'success'); }
        else showToast('A IA não achou nada parecido. Cole um link ou envie uma foto.', 'error');
      } catch (err) {
        showToast('Não foi possível buscar com IA agora.', 'error');
      } finally { b.disabled = false; b.textContent = txt; }
    };
  }

  if (typeof window.atualizarPreviewAoVivo === 'function') {
    const previewOriginal = window.atualizarPreviewAoVivo;
    window.atualizarPreviewAoVivo = function (...args) {
      const r = previewOriginal.apply(this, args);
      aplicarBadgesEvolucao(document.getElementById('liveWorkoutPreview'), currentStudentData);
      mostrarStatusIA();
      agendarBuscaIA();
      return r;
    };
  }
  if (typeof window.renderResumoVisaoGeral === 'function') {
    const resumoOriginal = window.renderResumoVisaoGeral;
    window.renderResumoVisaoGeral = function (...args) {
      const r = resumoOriginal.apply(this, args);
      const c = document.getElementById('summaryOverviewContainer');
      if (c && currentStudentData) {
        aplicarBadgesEvolucao(c, currentStudentData);
        const geral = resumoEvolucaoGeral(currentStudentData);
        if (geral) c.insertAdjacentHTML('afterbegin', geral);
      }
      return r;
    };
  }

  let primeiraCarga = true;
  const fetchAlunosOriginal = window.fetchAlunos;
  window.fetchAlunos = async function (...args) {
    const r = await fetchAlunosOriginal.apply(this, args);
    renderCentralSemana();
    atualizarNavegacaoAlunos();
    atualizarSelectsTreino();
    if (primeiraCarga) { primeiraCarga = false; switchTab('central'); }
    return r;
  };

  const carregarAlunoOriginal = window.carregarAluno;
  window.carregarAluno = async function (...args) {
    const r = await carregarAlunoOriginal.apply(this, args);
    atualizarNavegacaoAlunos();
    atualizarSelectsTreino();
    const fb = document.getElementById('secFeedbackAdmin');
    if (fb && !fb.classList.contains('hidden')) renderResumoFeedback();
    return r;
  };

  document.addEventListener('DOMContentLoaded', () => {
    garantirSecaoCentral();
    garantirNavegacaoAlunos();
    garantirFerramentasFeedback();
    garantirFerramentasTreino();
    atualizarLinksVenda();
    garantirBotaoIAModal();
  });

  window.renderCentralSemana = renderCentralSemana;
})();
