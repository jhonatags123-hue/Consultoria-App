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
    // O app salva o histórico pelo nome sem o que está entre parênteses/colchetes
    const k = sanitizeExKey(String(nome).replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim());
    const hist = (d.weekly_logs || {})[k];
    if (!Array.isArray(hist) || !hist.length) return null;
    const ini = (d.logs_iniciais || {})[k] || hist[0], fim = hist[hist.length - 1];
    if (ini === fim) return null;
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
    const listas = { aguardando: [], mensagens: [], feedback: [], sumidos: [], fotos: [], vencimento: [], semTreino: [] };
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

      if (d.aguardando_primeiro_pagamento === true) {
        const formaTxt = { pix: 'PIX', cartao: 'cartão parcelado', recorrente: 'recorrente' }[d.forma_escolhida];
        listas.aguardando.push({ ...base, ordem: -(dataValida(d.created_at || d.data_inicio) || 0),
          detalhe: `${(typeof PLANOS !== 'undefined' && PLANOS[d.tipoConsultoria]) ? PLANOS[d.tipoConsultoria].nome : (d.tipoConsultoria || 'plano não informado')} • ${formaTxt ? 'escolheu ' + formaTxt : 'forma ainda não escolhida'}${d.vendedor ? ' • vendedor: ' + d.vendedor : ''}` });
        return; // ainda não é aluno ativo: não entra nas outras listas
      }

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
    const total = L.aguardando.length + L.mensagens.length + L.feedback.length + L.sumidos.length + L.fotos.length + L.vencimento.length + L.semTreino.length;
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
        <a href="#central_aguardando"><b>${L.aguardando.length}</b><span>A confirmar</span></a>
        <a href="#central_mensagens"><b>${L.mensagens.length}</b><span>Mensagens</span></a>
        <a href="#central_feedback"><b>${L.feedback.length}</b><span>Feedbacks</span></a>
        <a href="#central_sumidos"><b>${L.sumidos.length}</b><span>Sumidos</span></a>
        <a href="#central_fotos"><b>${L.fotos.length}</b><span>Fotos</span></a>
        <a href="#central_vencimento"><b>${L.vencimento.length}</b><span>Renovações</span></a>
        <a href="#central_semTreino"><b>${L.semTreino.length}</b><span>Sem treino</span></a>
      </div>
      <div class="central-grid">
        ${bloco('aguardando', '⏳', 'Aguardando pagamento', 'Preencheram a avaliação e ainda não tiveram o pagamento confirmado (Asaas ou comprovante do PIX).', L.aguardando,
          it => `<button type="button" class="btn btn-gold sm" data-acao="confirmarPag">💳 Confirmar pagamento</button>`, 'Ninguém aguardando confirmação.')}
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
    if (acao === 'confirmarPag') {
      e.preventDefault();
      abrirConfirmarPagamento(codigo);
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

  /* ---------------- VENDAS: CONFIRMAR PAGAMENTO, COMISSÃO E VENDEDOR ---------------- */
  const NOMES_FORMA = { pix: '⚡ PIX à vista', cartao: '💳 Cartão parcelado', recorrente: '🔁 Recorrente' };
  let vendedoresCache = null;

  async function carregarVendedores() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/vendedores`, { headers: authHeaders(), cache: 'no-cache' });
      vendedoresCache = r.ok ? await r.json() : [];
    } catch (e) { vendedoresCache = []; }
    return vendedoresCache;
  }

  function garantirModalPagamento() {
    if (document.getElementById('modalPagamento')) return;
    const m = document.createElement('div');
    m.id = 'modalPagamento';
    m.className = 'modal-overlay hidden';
    m.innerHTML = `
      <div class="modal-chart" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h3 style="color:var(--gold); font-size:16px;">💳 Confirmar pagamento</h3>
          <button type="button" id="mpFechar" style="background:none; border:none; color:var(--accent); font-size:18px; font-weight:800; cursor:pointer;">✕</button>
        </div>
        <p id="mpAluno" style="font-size:13px; color:var(--text); margin-bottom:8px;"></p>
        <div class="mp-campos">
          <label for="mpPlano">Plano</label><select id="mpPlano"></select>
          <label for="mpForma">Forma de pagamento</label><select id="mpForma"></select>
          <label for="mpValor">Valor recebido (R$)</label><input id="mpValor" type="number" min="0" step="0.01">
          <label for="mpVendedor">Vendedor (comissão)</label><select id="mpVendedor"></select>
          <label for="mpObs">Comprovante / observação</label><input id="mpObs" placeholder="Ex.: pago no Asaas / comprovante PIX">
        </div>
        <p style="font-size:11.5px; color:var(--muted); margin-top:8px;">PIX à vista e cartão parcelado liberam o período inteiro do plano. Recorrente libera mês a mês.</p>
        <button type="button" class="btn btn-gold btn-lg full-width" id="mpConfirmar" style="margin-top:12px;">✅ Confirmar e liberar acesso</button>
      </div>`;
    document.body.appendChild(m);
    const fechar = () => m.classList.add('hidden');
    document.getElementById('mpFechar').onclick = fechar;
    m.addEventListener('click', (e) => { if (e.target === m) fechar(); });
    document.getElementById('mpPlano').onchange = preencherFormasPag;
    document.getElementById('mpForma').onchange = preencherValorPag;
    document.getElementById('mpConfirmar').onclick = confirmarPagamento;
  }

  function preencherFormasPag() {
    const p = PLANOS[document.getElementById('mpPlano').value];
    const sel = document.getElementById('mpForma');
    const atual = sel.value;
    const formas = p ? formasPagamentoPlano(p) : [];
    sel.innerHTML = formas.map(f => `<option value="${f.id}">${f.icone} ${esc(f.titulo)}</option>`).join('');
    if (formas.some(f => f.id === atual)) sel.value = atual;
    preencherValorPag();
  }
  function preencherValorPag() {
    const p = PLANOS[document.getElementById('mpPlano').value];
    const f = document.getElementById('mpForma').value;
    if (p) document.getElementById('mpValor').value = f === 'pix' ? p.pix : f === 'cartao' ? p.cartao.total : f === 'recorrente' ? p.recorrente : '';
  }

  let codigoPagamento = null;
  async function abrirConfirmarPagamento(codigo) {
    if (typeof PLANOS === 'undefined') return showToast('planos.js não carregou.', 'error');
    garantirModalPagamento();
    codigoPagamento = codigo;
    const a = (allStudentsList || []).find(x => x.codigo === codigo);
    const d = a ? dadosDoAluno(a) : (currentStudentCode === codigo ? currentStudentData : {}) || {};
    document.getElementById('mpAluno').textContent = `${d.clientName || codigo} (@${codigo})`;
    const selPlano = document.getElementById('mpPlano');
    selPlano.innerHTML = Object.entries(PLANOS).map(([id, p]) => `<option value="${id}">${esc(p.nome)}</option>`).join('');
    if (PLANOS[d.tipoConsultoria]) selPlano.value = d.tipoConsultoria;
    document.getElementById('mpForma').innerHTML = '';
    preencherFormasPag();
    const forma = d.aguardando_primeiro_pagamento ? d.forma_escolhida : d.forma_pagamento;
    if (forma && [...document.getElementById('mpForma').options].some(o => o.value === forma)) { document.getElementById('mpForma').value = forma; preencherValorPag(); }
    const vends = vendedoresCache || await carregarVendedores();
    const selV = document.getElementById('mpVendedor');
    selV.innerHTML = '<option value="">Sem vendedor (venda sua)</option>' + vends.map(v => `<option value="${esc(v.codigo)}">${esc(v.nome)}</option>`).join('');
    selV.value = d.vendedor || '';
    document.getElementById('mpObs').value = '';
    document.getElementById('modalPagamento').classList.remove('hidden');
  }
  window.abrirConfirmarPagamento = abrirConfirmarPagamento;

  async function confirmarPagamento() {
    const b = document.getElementById('mpConfirmar');
    b.disabled = true;
    try {
      const res = await fetch(`${BACKEND_URL}/api/equipe/pagamentos/confirmar`, {
        method: 'POST', headers: authHeaders(), cache: 'no-cache',
        body: JSON.stringify({
          codigo: codigoPagamento, plano: document.getElementById('mpPlano').value, forma: document.getElementById('mpForma').value,
          valor: parseFloat(document.getElementById('mpValor').value) || 0, vendedor: document.getElementById('mpVendedor').value,
          observacao: document.getElementById('mpObs').value
        })
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Erro ao confirmar.');
      document.getElementById('modalPagamento').classList.add('hidden');
      const tipos = { nova: 'Venda confirmada', renovacao: 'Renovação confirmada', mensalidade: 'Mensalidade confirmada' };
      showToast(`${tipos[r.tipo] || 'Pagamento confirmado'}! Acesso liberado até ${new Date(r.data_expiracao + 'T12:00:00').toLocaleDateString('pt-BR')}.`, 'success');
      await fetchAlunos();
      if (currentStudentCode === codigoPagamento) await carregarAluno(codigoPagamento);
      const sec = document.getElementById('secVendas');
      if (sec && !sec.classList.contains('hidden')) renderVendas();
    } catch (err) {
      showToast(err.message, 'error');
    } finally { b.disabled = false; }
  }

  // Forma de pagamento e botão de confirmar no topo do aluno
  function atualizarTopoPagamento() {
    const dias = document.getElementById('studentDaysPill');
    if (!dias || !currentStudentData) return;
    let pill = document.getElementById('studentFormaPill');
    if (!pill) {
      pill = document.createElement('button'); pill.id = 'studentFormaPill'; pill.type = 'button'; pill.className = 'btn-badge status-info';
      dias.insertAdjacentElement('afterend', pill);
      const btn = document.createElement('button'); btn.id = 'studentConfirmarPag'; btn.type = 'button'; btn.className = 'btn-badge status-alerta';
      btn.textContent = '💳 Confirmar pagamento';
      btn.onclick = () => abrirConfirmarPagamento(currentStudentCode);
      pill.insertAdjacentElement('afterend', btn);
    }
    const d = currentStudentData;
    const forma = d.forma_pagamento;
    let txt = forma ? NOMES_FORMA[forma] : (d.aguardando_primeiro_pagamento ? `⏳ Aguardando${d.forma_escolhida ? ' • escolheu ' + NOMES_FORMA[d.forma_escolhida].replace(/^\S+ /, '') : ''}` : '💳 Forma não registrada');
    if (forma === 'recorrente' && d.proxima_cobranca) txt += ` • próx. ${new Date(d.proxima_cobranca + 'T12:00:00').toLocaleDateString('pt-BR')}`;
    if (d.vendedor) txt += ` • vend.: ${d.vendedor}`;
    pill.textContent = txt;
    const btn = document.getElementById('studentConfirmarPag');
    btn.textContent = d.aguardando_primeiro_pagamento ? '💳 Confirmar pagamento' : (forma === 'recorrente' ? '💳 Registrar mensalidade/renovação' : '💳 Registrar renovação');
  }

  // Aba Vendas
  function garantirSecaoVendas() {
    if (document.getElementById('secVendas')) return;
    const central = document.getElementById('secCentral');
    if (!central) return;
    const sec = document.createElement('section');
    sec.id = 'secVendas';
    sec.className = 'tab-section panel-card hidden';
    central.insertAdjacentElement('afterend', sec);
    const ferramentas = document.querySelector('.central-sidebar-btn');
    if (ferramentas) {
      const b = document.createElement('button');
      b.className = 'btn btn-md full-width central-sidebar-btn'; b.style.background = 'linear-gradient(135deg,#a87a14,#dcaa3a)'; b.style.color = '#1a0b02';
      b.innerHTML = '💼 Vendas & Vendedor';
      b.onclick = () => switchTab('vendas');
      ferramentas.insertAdjacentElement('afterend', b);
    }
  }

  function atualizarBadgeSaques(dados) {
    const pend = dados ? (dados.saques || []).filter(x => x.status === 'pendente').length : 0;
    document.querySelectorAll('.central-sidebar-btn').forEach(b => {
      if (/Vendas & Vendedor/.test(b.textContent)) b.innerHTML = `💼 Vendas & Vendedor${pend ? ` <span class="badge-saque">${pend} resgate${pend > 1 ? 's' : ''}</span>` : ''}`;
    });
  }
  async function verificarSaquesPendentes() {
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/saques`, { headers: authHeaders(), cache: 'no-cache' });
      if (r.ok) atualizarBadgeSaques(await r.json());
    } catch (e) {}
  }

  function blocoSaques(dados) {
    if (!dados) return '';
    const pend = (dados.saques || []).filter(x => x.status === 'pendente');
    const resolvidos = (dados.saques || []).filter(x => x.status !== 'pendente').slice(0, 8);
    const saldos = Object.entries(dados.saldos || {});
    return `<div class="central-bloco" style="margin-top:12px;">
      <div class="central-bloco-topo"><span>🏦 Resgates de comissão</span><b class="${pend.length ? 'tem' : ''}">${pend.length}</b></div>
      <p class="central-desc">O vendedor pede o resgate pelo painel dele. Faça o PIX para a chave informada e marque como pago.</p>
      ${saldos.map(([cod, sd]) => `<div class="central-item"><div class="central-item-info"><b>${esc(sd.nome || cod)}</b><small>comissão acumulada ${formatarReais(sd.ganho)} • já pago ${formatarReais(sd.pago)} • em análise ${formatarReais(sd.pendente)}</small></div><div class="central-item-acoes"><b style="color:var(--gold);">saldo ${formatarReais(sd.disponivel)}</b></div></div>`).join('')}
      ${pend.map(x => `<div class="central-item" style="flex-wrap:wrap; border-color:var(--gold);">
        <div class="central-item-info"><b>${esc(x.vendedor_nome || x.vendedor)} pediu ${formatarReais(parseFloat(x.valor) || 0)}</b>
          <small>${new Date(x.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} • PIX: <b>${esc(x.chave_pix || '')}</b>${x.observacao ? ' • ' + esc(x.observacao) : ''}</small></div>
        <div class="central-item-acoes" style="flex-wrap:wrap;">
          <button type="button" class="btn btn-soft sm" data-copiar-pix="${esc(x.chave_pix || '')}">📋 Copiar chave</button>
          <input data-saque-resp="${x.id}" placeholder="Recado (opcional)" style="max-width:180px; background:var(--card-inner); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:6px 8px; font-size:12px;">
          <button type="button" class="btn btn-gold sm" data-saque="${x.id}" data-status="pago">✅ Marcar como pago</button>
          <button type="button" class="btn btn-soft sm" data-saque="${x.id}" data-status="recusado">Recusar</button>
        </div></div>`).join('')}
      ${resolvidos.length ? `<details style="margin-top:6px;"><summary style="font-size:12px; color:var(--muted); cursor:pointer;">Histórico de resgates</summary>${resolvidos.map(x => `<div class="central-item"><div class="central-item-info"><b>${esc(x.vendedor_nome || x.vendedor)} • ${formatarReais(parseFloat(x.valor) || 0)}</b><small>${x.status === 'pago' ? '✅ pago' : '✖ recusado'} em ${x.resolvido_em ? new Date(x.resolvido_em).toLocaleDateString('pt-BR') : '—'}${x.resposta ? ' • ' + esc(x.resposta) : ''}</small></div></div>`).join('')}</details>` : ''}
      ${!pend.length && !saldos.length ? '<div class="central-vazio">Nenhum vendedor cadastrado ainda.</div>' : (!pend.length ? '<div class="central-vazio">Nenhum resgate esperando.</div>' : '')}
    </div>`;
  }

  function blocoIndicacoes(r) {
    const nomes = Object.fromEntries((r.alunos || []).map(a => [a.codigo, a.nome]));
    const pend = (r.creditos || []).filter(c => c.status === 'pendente');
    const indicados = (r.leads || []).filter(l => l.indicado_por);
    const fecharam = (r.alunos || []).filter(a => a.indicado_por && !a.aguardando).length;
    return `<div class="central-bloco" style="margin-top:12px;">
      <div class="central-bloco-topo"><span>🤝 Indicações</span><b class="${pend.length ? 'tem' : ''}">${pend.length}</b></div>
      <p class="central-desc">${indicados.length} contato${indicados.length !== 1 ? 's' : ''} indicado${indicados.length !== 1 ? 's' : ''} por alunos • ${fecharam} fecharam. Quem indica ganha R$ 20 e o indicado R$ 10 de desconto quando fecha.</p>
      ${pend.length ? pend.map(c => `<div class="central-item"><div class="central-item-info"><b>${esc(nomes[c.aluno_codigo] || c.aluno_codigo)} — ${formatarReais(parseFloat(c.valor) || 0)} de desconto</b><small>${esc(c.motivo || '')} • ${new Date(c.criado_em).toLocaleDateString('pt-BR')}</small></div><div class="central-item-acoes"><button type="button" class="btn btn-soft sm" data-credito="${c.id}">✓ Desconto aplicado</button></div></div>`).join('') : '<div class="central-vazio">Nenhum desconto de indicação a aplicar.</div>'}
    </div>`;
  }

  function blocoAsaas(asaas, alunos) {
    if (!asaas) return `<div class="central-bloco" style="margin-top:12px;"><div class="central-bloco-topo"><span>💳 Asaas automático</span></div><p class="central-desc">Não foi possível verificar a integração (servidor ainda não atualizado?).</p></div>`;
    const c = asaas.configurado || {};
    const ativo = c.apiKey && c.webhookToken;
    const motivos = { sem_aluno: 'Nenhum aluno com esse CPF, e-mail ou telefone', ambiguo: 'Mais de um aluno possível', erro: 'Erro ao confirmar' };
    const ordenados = [...alunos].sort((x, y) => (Number(y.aguardando) - Number(x.aguardando)) || String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
    const opcoes = '<option value="">Escolha o aluno...</option>' + ordenados.map(a => `<option value="${esc(a.codigo)}">${a.aguardando ? '⏳ ' : ''}${esc(a.nome)} (@${esc(a.codigo)})</option>`).join('');
    const lista = (asaas.pagamentos || []).map(p => `
      <div class="central-item" style="flex-wrap:wrap;">
        <div class="central-item-info"><b>${esc(p.cliente_nome || 'Cliente sem nome')} — ${formatarReais(parseFloat(p.valor) || 0)} (${NOMES_FORMA[p.forma] || p.forma})</b>
          <small>${new Date(p.criado_em).toLocaleDateString('pt-BR')} • ${esc(motivos[p.status] || p.status)}${p.cliente_cpf ? ' • CPF ' + esc(p.cliente_cpf) : ''}${p.cliente_email ? ' • ' + esc(p.cliente_email) : ''}${p.cliente_telefone ? ' • ' + esc(p.cliente_telefone) : ''}</small></div>
        <div class="central-item-acoes" style="flex-wrap:wrap;">
          <select data-asaas-aluno="${esc(p.payment_id)}" style="max-width:220px; background:var(--card-inner); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:6px;">${opcoes}</select>
          <button type="button" class="btn btn-gold sm" data-asaas-ligar="${esc(p.payment_id)}">Ligar e liberar</button>
          <button type="button" class="btn btn-soft sm" data-asaas-ignorar="${esc(p.payment_id)}">Ignorar</button>
        </div>
      </div>`).join('');
    return `<div class="central-bloco" style="margin-top:12px;">
      <div class="central-bloco-topo"><span>💳 Asaas automático</span><b class="${(asaas.pagamentos || []).length ? 'tem' : ''}">${(asaas.pagamentos || []).length}</b></div>
      <p class="central-desc">${ativo
        ? '✅ Integração ativa: pagamentos aprovados no Asaas liberam o aluno sozinhos. Abaixo, os que o sistema não conseguiu identificar.'
        : `⚠️ Falta configurar no Render: ${[!c.apiKey && 'ASAAS_API_KEY', !c.webhookToken && 'ASAAS_WEBHOOK_TOKEN'].filter(Boolean).join(' e ')}.`}</p>
      ${lista || (ativo ? '<div class="central-vazio">Nenhum pagamento para resolver. 🎉</div>' : '')}
    </div>`;
  }

  async function renderVendas() {
    garantirSecaoVendas();
    const sec = document.getElementById('secVendas');
    sec.innerHTML = '<div class="panel-title">💼 Vendas & Vendedor</div><p class="central-hoje">Carregando...</p>';
    try {
      const mesSel = sec.dataset.mes || new Date().toISOString().slice(0, 7);
      const [r, vends, asaas, saques] = await Promise.all([
        fetch(`${BACKEND_URL}/api/equipe/painel?mes=${mesSel}`, { headers: authHeaders(), cache: 'no-cache' }).then(x => x.json()),
        carregarVendedores(),
        fetch(`${BACKEND_URL}/api/admin/asaas/pendentes`, { headers: authHeaders(), cache: 'no-cache' }).then(x => x.ok ? x.json() : null).catch(() => null),
        fetch(`${BACKEND_URL}/api/admin/saques`, { headers: authHeaders(), cache: 'no-cache' }).then(x => x.ok ? x.json() : null).catch(() => null)
      ]);
      atualizarBadgeSaques(saques);
      const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
      const tipos = { nova: 'Venda nova', renovacao: 'Renovação', mensalidade: 'Mensalidade' };
      const reais = (v) => formatarReais(Number(v) || 0);
      const aguardando = (r.alunos || []).filter(a => a.aguardando);
      const comissoes = Object.entries(r.comissoes || {});
      sec.innerHTML = `
        <div class="panel-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <span>💼 Vendas & Vendedor</span>
          <select id="vendasMes" style="width:auto;">${meses.map(m => `<option value="${m}" ${m === mesSel ? 'selected' : ''}>${new Date(m + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</option>`).join('')}</select>
        </div>
        <div class="central-grid">
          <div class="central-bloco">
            <div class="central-bloco-topo"><span>🏆 Comissão do mês</span></div>
            <p class="central-desc">Até 5 vendas: 10%. A partir da 6ª: 15% em tudo. Mensalidades entram no total, mas não contam como venda nova.</p>
            ${comissoes.length ? comissoes.map(([cod, c]) => `<div class="central-item"><div class="central-item-info"><b>${esc((vends.find(v => v.codigo === cod) || {}).nome || cod)}</b><small>${c.vendas} venda${c.vendas !== 1 ? 's' : ''} • faixa ${c.pct}% • vendido ${reais(c.total)}</small></div><div class="central-item-acoes"><b style="color:var(--gold); font-size:15px;">${reais(c.comissao)}</b></div></div>`).join('') : '<div class="central-vazio">Nenhuma venda com vendedor neste mês.</div>'}
          </div>
          <div class="central-bloco">
            <div class="central-bloco-topo"><span>⏳ Aguardando pagamento</span><b class="${aguardando.length ? 'tem' : ''}">${aguardando.length}</b></div>
            <p class="central-desc">Confirme quando o Asaas aprovar ou o comprovante do PIX chegar.</p>
            ${aguardando.length ? aguardando.map(a => `<div class="central-item"><div class="central-item-info"><b>${esc(a.nome)}</b><small>${esc((PLANOS[a.plano] || {}).nome || a.plano || '')}${a.forma_escolhida ? ' • escolheu ' + NOMES_FORMA[a.forma_escolhida] : ''}${a.vendedor ? ' • ' + esc(a.vendedor) : ''}</small></div><div class="central-item-acoes"><button type="button" class="btn btn-gold sm" data-pag="${esc(a.codigo)}">💳 Confirmar</button></div></div>`).join('') : '<div class="central-vazio">Ninguém aguardando.</div>'}
          </div>
        </div>
        ${blocoSaques(saques)}
        ${blocoIndicacoes(r)}
        ${blocoAsaas(asaas, r.alunos || [])}
        <div class="central-bloco" style="margin-top:12px;">
          <div class="central-bloco-topo"><span>🧾 Pagamentos confirmados no mês</span><b>${(r.vendas || []).length}</b></div>
          ${(r.vendas || []).length ? r.vendas.map(v => `<div class="central-item"><div class="central-item-info"><b>${esc(v.aluno_nome)}</b><small>${new Date(v.criado_em).toLocaleDateString('pt-BR')} • ${tipos[v.tipo] || v.tipo} • ${NOMES_FORMA[v.forma] || v.forma} • ${v.vendedor ? 'vend.: ' + esc(v.vendedor) : 'sem vendedor'} • por ${esc(String(v.confirmado_por || '').replace('vendedor:', ''))}${v.observacao ? ' • ' + esc(v.observacao) : ''}</small></div><div class="central-item-acoes"><b>${reais(v.valor)}</b></div></div>`).join('') : '<div class="central-vazio">Nenhum pagamento confirmado neste mês.</div>'}
        </div>
        <div class="central-bloco" style="margin-top:12px;">
          <div class="central-bloco-topo"><span>👤 Acesso do vendedor</span></div>
          <p class="central-desc">Painel do vendedor: <a href="${SITE}/vendedor.html" target="_blank" rel="noopener" style="color:var(--gold);">${SITE.replace('https://', '')}/vendedor.html</a>. Ele vê só nome, WhatsApp, plano e datas dos alunos (nada de treino, dieta ou saúde).</p>
          ${vends.map(v => `<div class="central-item"><div class="central-item-info"><b>${esc(v.nome)}</b><small>usuário: ${esc(v.codigo)} • ${v.ativo ? 'ativo' : 'desativado'}</small></div></div>`).join('')}
          <div class="vend-form">
            <input id="vendCodigo" placeholder="Usuário (ex.: misael)" value="${vends[0] ? esc(vends[0].codigo) : 'misael'}">
            <input id="vendNome" placeholder="Nome" value="${vends[0] ? esc(vends[0].nome) : 'Misael'}">
            <input id="vendSenha" type="password" placeholder="${vends.length ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 6 caracteres)'}" autocomplete="new-password">
            <button type="button" class="btn btn-gold sm" id="vendSalvar">${vends.length ? 'Salvar alterações' : 'Criar acesso'}</button>
          </div>
        </div>`;
      sec.dataset.mes = mesSel;
      document.getElementById('vendasMes').onchange = (e) => { sec.dataset.mes = e.target.value; renderVendas(); };
      sec.querySelectorAll('[data-pag]').forEach(b => b.onclick = () => abrirConfirmarPagamento(b.dataset.pag));
      sec.querySelectorAll('[data-saque]').forEach(b => b.onclick = async () => {
        const id = b.dataset.saque; const status = b.dataset.status;
        const resposta = (sec.querySelector(`[data-saque-resp="${id}"]`) || {}).value || '';
        if (status === 'recusado' && !resposta.trim()) return showToast('Escreva o motivo da recusa para o vendedor.', 'error');
        b.disabled = true;
        const res = await fetch(`${BACKEND_URL}/api/admin/saques/${id}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ status, resposta }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { b.disabled = false; return showToast(j.error || 'Erro ao atualizar resgate.', 'error'); }
        showToast(status === 'pago' ? 'Resgate marcado como pago.' : 'Resgate recusado.', 'success');
        renderVendas();
      });
      sec.querySelectorAll('[data-copiar-pix]').forEach(b => b.onclick = () => copiarLinkVenda(b.dataset.copiarPix));
      sec.querySelectorAll('[data-credito]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        const res = await fetch(`${BACKEND_URL}/api/equipe/creditos/${b.dataset.credito}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ status: 'usado' }) });
        if (!res.ok) { b.disabled = false; return showToast('Erro ao dar baixa.', 'error'); }
        showToast('Desconto marcado como aplicado.', 'success'); renderVendas();
      });
      sec.querySelectorAll('[data-asaas-ligar]').forEach(b => b.onclick = async () => {
        const id = b.dataset.asaasLigar;
        const cod = sec.querySelector(`[data-asaas-aluno="${id}"]`).value;
        if (!cod) return showToast('Escolha o aluno desse pagamento.', 'error');
        const pg = (asaas.pagamentos || []).find(x => x.payment_id === id);
        b.disabled = true;
        const res = await fetch(`${BACKEND_URL}/api/equipe/pagamentos/confirmar`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ codigo: cod, forma: pg.forma, valor: parseFloat(pg.valor) || 0, asaasPagamentoId: id, observacao: `Asaas ${id} (ligado pelo admin)` }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { b.disabled = false; return showToast(j.error || 'Erro ao confirmar.', 'error'); }
        showToast('Pagamento ligado ao aluno e acesso liberado.', 'success');
        await fetchAlunos(); renderVendas();
      });
      sec.querySelectorAll('[data-asaas-ignorar]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        await fetch(`${BACKEND_URL}/api/admin/asaas/ignorar`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ paymentId: b.dataset.asaasIgnorar }) });
        renderVendas();
      });
      document.getElementById('vendSalvar').onclick = async () => {
        const corpo = { codigo: document.getElementById('vendCodigo').value, nome: document.getElementById('vendNome').value, senha: document.getElementById('vendSenha').value };
        const res = await fetch(`${BACKEND_URL}/api/admin/vendedores`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(corpo) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return showToast(j.error || 'Erro ao salvar vendedor.', 'error');
        showToast('Acesso do vendedor salvo.', 'success');
        vendedoresCache = null; renderVendas();
      };
    } catch (err) {
      sec.innerHTML = '<div class="panel-title">💼 Vendas & Vendedor</div><p class="central-hoje">Não foi possível carregar. Verifique se o servidor foi atualizado.</p>';
    }
  }

  /* ---------------- LIGAÇÃO COM O ADMIN EXISTENTE ---------------- */
  const switchTabOriginal = window.switchTab;
  window.switchTab = function (tab) {
    const sec = document.getElementById('secCentral');
    const secV = document.getElementById('secVendas');
    if (secV) secV.classList.add('hidden');
    if (tab === 'vendas') {
      switchTabOriginal('vendas');
      if (sec) sec.classList.add('hidden');
      garantirSecaoVendas();
      document.getElementById('secVendas').classList.remove('hidden');
      renderVendas();
      return;
    }
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
    if (primeiraCarga) { primeiraCarga = false; switchTab('central'); verificarSaquesPendentes(); }
    return r;
  };

  const carregarAlunoOriginal = window.carregarAluno;
  window.carregarAluno = async function (...args) {
    const r = await carregarAlunoOriginal.apply(this, args);
    atualizarNavegacaoAlunos();
    atualizarTopoPagamento();
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
    garantirSecaoVendas();
  });

  window.renderCentralSemana = renderCentralSemana;
})();
