/* =============================================================
   PAINEL DO VENDEDOR
   Mostra só dados comerciais (nome, WhatsApp, plano, datas).
   Treino, dieta, saúde e financeiro pessoal ficam no admin.
============================================================= */
const BACKEND_URL = 'https://' + 'consultoria-backend-kbqi.onrender.com';
const SITE = 'https://' + 'jhonataconsultoria.com.br';
const CHAVE_TOKEN = 'vendedor_token';
const DIAS_RENOVACAO = 15;  // mostra renovações com até 15 dias para vencer
const DIAS_MENSALIDADE = 5; // mostra mensalidades do recorrente com até 5 dias
const DIA = 864e5;

let painel = null;
let abaAtual = 'cobrancas';
let alunoConfirmando = null;

/* ---------------- utilitários ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const reais = (v) => (typeof formatarReais === 'function' ? formatarReais(Number(v) || 0) : 'R$ ' + (Number(v) || 0).toFixed(2));
function lerToken() { try { return localStorage.getItem(CHAVE_TOKEN) || ''; } catch (e) { return ''; } }
function gravarToken(t) { try { t ? localStorage.setItem(CHAVE_TOKEN, t) : localStorage.removeItem(CHAVE_TOKEN); } catch (e) {} }
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
async function api(metodo, caminho, corpo) {
  const res = await fetch(BACKEND_URL + caminho, {
    method: metodo, cache: 'no-cache',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lerToken() },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const dados = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) { sair(); throw new Error(dados.error || 'Faça login novamente.'); }
  if (!res.ok) throw new Error(dados.error || 'Erro de conexão.');
  return dados;
}
function dataBR(v) {
  if (!v) return '—';
  const d = new Date(String(v).split('T')[0] + 'T12:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
}
function diasAte(v) {
  if (!v) return null;
  const alvo = new Date(String(v).split('T')[0] + 'T12:00:00'); const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  return Math.round((alvo - hoje) / DIA);
}
function diasDesde(v) { const d = diasAte(v); return d === null ? null : -d; }
function textoDias(n) {
  if (n === null) return '';
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}
function fone(a) {
  const n = String(a.telefone || a.whatsapp || '').replace(/\D/g, '');
  return n.length === 10 || n.length === 11 ? '55' + n : n;
}
function whats(numero, msg) { return 'https://' + 'wa.me/' + numero + '?text=' + encodeURIComponent(msg); }
function primeiro(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function nomePlano(id) {
  if (typeof PLANOS !== 'undefined' && PLANOS[id]) return PLANOS[id].nome;
  if (!id) return 'Plano não informado';
  const tipo = /^TREINO/i.test(id) ? 'Treino' : 'Completa';
  return `${tipo} — plano antigo (mensalidade)`;
}
const NOMES_FORMA = { pix: '⚡ PIX à vista', cartao: '💳 Cartão parcelado', recorrente: '🔁 Recorrente' };

/* ---------------- login ---------------- */
$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('loginErro').textContent = '';
  $('btnEntrar').disabled = true; $('btnEntrar').textContent = 'Entrando...';
  try {
    const res = await fetch(BACKEND_URL + '/api/vendedor/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: $('loginUser').value.trim(), pass: $('loginPass').value })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Não foi possível entrar.');
    gravarToken(d.token);
    iniciar();
  } catch (err) {
    $('loginErro').textContent = err.message;
  } finally {
    $('btnEntrar').disabled = false; $('btnEntrar').textContent = 'Entrar';
  }
});
function sair() { gravarToken(''); $('telaPainel').classList.add('hidden'); $('telaLogin').classList.remove('hidden'); }
$('btnSair').onclick = sair;
$('btnAtualizar').onclick = () => carregar();

/* ---------------- dados ---------------- */
function montarMeses() {
  const sel = $('selMes'); sel.innerHTML = '';
  const hoje = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const o = document.createElement('option'); o.value = v;
    o.textContent = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    sel.appendChild(o);
  }
  sel.onchange = () => carregar();
}

async function carregar() {
  $('atualizadoEm').textContent = 'Carregando...';
  try {
    painel = await api('GET', '/api/equipe/painel?mes=' + $('selMes').value);
    $('olaVendedor').textContent = painel.vendedor ? `Olá, ${primeiro(painel.vendedor.nome)}!` : 'Painel de vendas';
    $('atualizadoEm').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    render();
  } catch (err) {
    $('atualizadoEm').textContent = err.message;
  }
}

function listas() {
  const alunos = (painel.alunos || []).filter(a => !a.isento);
  const pendentes = alunos.filter(a => a.aguardando).sort((x, y) => String(y.criado_em).localeCompare(String(x.criado_em)));
  // Cobranças: renovações (até 15 dias), mensalidades do recorrente (até 5 dias) e atrasados (até 60 dias)
  const cobrancas = [];
  alunos.filter(a => !a.aguardando && a.status !== 'isento').forEach(a => {
    let tipo = null, ref = null;
    const fimContrato = a.forma_pagamento === 'recorrente' ? diasAte(a.fim_contrato) : null;
    if (a.forma_pagamento === 'recorrente' && fimContrato !== null && fimContrato <= DIAS_RENOVACAO) { tipo = 'renovacao'; ref = a.fim_contrato; }
    else if (a.forma_pagamento === 'recorrente' && a.proxima_cobranca && diasAte(a.proxima_cobranca) <= DIAS_MENSALIDADE) { tipo = 'mensalidade'; ref = a.proxima_cobranca; }
    else if (a.forma_pagamento !== 'recorrente' && a.data_expiracao && diasAte(a.data_expiracao) <= DIAS_RENOVACAO) { tipo = 'renovacao'; ref = a.data_expiracao; }
    if (!tipo) return;
    const d = diasAte(ref);
    if (d < -60) return;
    cobrancas.push({ ...a, tipoCobranca: tipo, ref, dias: d });
  });
  // Atrasados primeiro (o mais recente antes), depois os que vencem antes
  cobrancas.sort((x, y) => (x.dias < 0) !== (y.dias < 0) ? (x.dias < 0 ? -1 : 1) : (x.dias < 0 ? y.dias - x.dias : x.dias - y.dias));
  const novos = alunos.filter(a => !a.aguardando && a.status === 'pago' && diasDesde(a.data_inicio) !== null && diasDesde(a.data_inicio) <= 30)
    .sort((x, y) => String(y.data_inicio).localeCompare(String(x.data_inicio)));
  const leads = (painel.leads || []).filter(l => l.status !== 'fechou' && l.status !== 'perdido');
  return { pendentes, cobrancas, novos, leads };
}

/* ---------------- telas ---------------- */
function renderComissao() {
  const c = painel.comissao || (painel.comissoes && Object.values(painel.comissoes)[0]) || { vendas: 0, pct: 10, total: 0, comissao: 0, faltam_para_15: 6 };
  const pctBarra = Math.min(100, Math.round((c.vendas / 6) * 100));
  $('boxComissao').innerHTML = `
    <div class="com-nums">
      <div><span>Vendas no mês</span><b>${c.vendas}</b></div>
      <div><span>Faixa de comissão</span><b class="gold">${c.pct}%</b></div>
      <div><span>Total vendido</span><b>${reais(c.total)}</b></div>
      <div><span>Sua comissão</span><b class="gold">${reais(c.comissao)}</b></div>
    </div>
    <div class="faixa"><div style="width:${pctBarra}%"></div></div>
    <div class="faixa-txt">${c.faltam_para_15 > 0
      ? `Faltam <b>${c.faltam_para_15} venda${c.faltam_para_15 > 1 ? 's' : ''}</b> para subir para <b>15% em tudo</b> o que você vendeu no mês.`
      : `🔥 Você está na faixa de <b>15%</b>: vale para todas as vendas do mês.`}
      Mensalidades do recorrente entram no total, mas não contam como venda nova.</div>`;
}

const ABAS = [
  ['pendentes', '⏳ Aguardando pagamento'],
  ['cobrancas', '💸 Cobranças'],
  ['novos', '✅ Novos alunos'],
  ['leads', '🆕 Contatos do site'],
  ['vendas', '💰 Minhas vendas'],
  ['links', '🔗 Meus links']
];

function render() {
  renderComissao();
  const L = listas();
  const contagem = { pendentes: L.pendentes.length, cobrancas: L.cobrancas.length, novos: L.novos.length, leads: L.leads.length, vendas: (painel.vendas || []).length, links: null };
  $('abas').innerHTML = ABAS.map(([id, nome]) => `<button type="button" role="tab" class="aba ${abaAtual === id ? 'on' : ''} ${contagem[id] ? 'tem' : ''}" data-aba="${id}" aria-selected="${abaAtual === id}">${nome}${contagem[id] !== null ? ` <b>${contagem[id]}</b>` : ''}</button>`).join('');
  $('abas').querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { abaAtual = b.dataset.aba; render(); });

  const telas = { pendentes: telaPendentes, cobrancas: telaCobrancas, novos: telaNovos, leads: telaLeads, vendas: telaVendas, links: telaLinks };
  $('conteudo').innerHTML = telas[abaAtual](L);
  ligarAcoes();
}

function item(info, acoes) { return `<div class="item"><div class="info">${info}</div><div class="acoes">${acoes}</div></div>`; }
function botaoWhats(a, msg, rotulo = '📲 WhatsApp') {
  const n = fone(a);
  return n ? `<a class="btn btn-wpp" target="_blank" rel="noopener" href="${whats(n, msg)}">${rotulo}</a>` : `<span class="pill">sem WhatsApp</span>`;
}
function botaoConfirmar(a, rotulo = '✅ Confirmar pagamento') { return `<button type="button" class="btn btn-gold" data-confirmar="${esc(a.codigo)}">${rotulo}</button>`; }
function painelHtml(titulo, desc, itens, vazio) {
  return `<div class="painel"><h2>${titulo}</h2><p class="desc">${desc}</p>${itens.length ? itens.join('') : `<div class="vazio">${vazio}</div>`}</div>`;
}

function telaPendentes(L) {
  return painelHtml('⏳ Aguardando pagamento', 'Preencheram a avaliação e ainda não tiveram o pagamento confirmado. Cobre com carinho e confirme quando o Asaas aprovar ou o comprovante chegar.',
    L.pendentes.map(a => item(
      `<b>${esc(a.nome)}</b><small>${esc(nomePlano(a.plano))} • avaliação ${textoDias(-diasDesde(a.criado_em)) || '—'}</small>
       <small>${a.forma_escolhida ? `<span class="pill gold">escolheu ${NOMES_FORMA[a.forma_escolhida]}</span>` : '<span class="pill">ainda não escolheu a forma</span>'}${a.vendedor ? `<span class="pill">link de ${esc(a.vendedor)}</span>` : ''}</small>`,
      botaoWhats(a, `Oi ${primeiro(a.nome)}, tudo bem? Aqui é da equipe do Jhonata! Vi que você preencheu sua avaliação do plano ${nomePlano(a.plano)} 💪 Conseguiu finalizar o pagamento? Se já pagou no PIX, me manda o comprovante que eu libero seu acesso agora.`, '📲 Cobrar') + botaoConfirmar(a)
    )), 'Ninguém aguardando pagamento agora. 🎉');
}

function valorCobranca(a) {
  const p = PLANOS[a.plano];
  if (p) {
    if (a.tipoCobranca === 'mensalidade' && p.recorrente) return reais(p.recorrente) + '/mês';
    if (a.forma_pagamento === 'cartao' && p.cartao) return `${p.cartao.parcelas}x de ${reais(valorParcela(p))}`;
    if (a.forma_pagamento === 'recorrente' && p.recorrente) return reais(p.recorrente) + '/mês';
    return reais(p.pix) + ' no PIX';
  }
  return a.valor_mensalidade ? reais(a.valor_mensalidade) : 'valor a combinar';
}

function quandoTexto(d, verbo = 'vence') {
  if (d === 0) return `${verbo} hoje`;
  if (d === 1) return `${verbo} amanhã`;
  if (d > 1) return `${verbo} em ${d} dias`;
  return verbo === 'vence' ? `venceu há ${-d} dia${d === -1 ? '' : 's'}` : `terminou há ${-d} dia${d === -1 ? '' : 's'}`;
}

function mensagemCobranca(a) {
  const nome = primeiro(a.nome);
  const data = dataBR(a.ref);
  const p = PLANOS[a.plano];
  const rodape = 'Qualquer dúvida, me chama aqui! 💪';

  if (a.tipoCobranca === 'mensalidade') {
    return a.dias >= 0
      ? `Oi ${nome}, tudo bem? Passando pra lembrar que a mensalidade da sua consultoria (${valorCobranca(a)}) ${quandoTexto(a.dias)} (${data}), no cartão recorrente. É só deixar o cartão com limite que a cobrança passa sozinha. ${rodape}`
      : `Oi ${nome}, tudo bem? A mensalidade da sua consultoria venceu em ${data} e não passou no cartão. Consegue verificar o cartão cadastrado? Seu acesso continua liberado até ${dataBR(a.data_expiracao)}. Se preferir, te mando outra forma de pagamento. ${rodape}`;
  }

  if (p) {
    const linhas = formasPagamentoPlano(p).filter(f => f.link).map(f => `${f.icone} ${f.titulo}\n${f.link}`).join('\n\n');
    const abertura = a.dias >= 0
      ? `Oi ${nome}, tudo bem? Seu plano ${p.nome} ${quandoTexto(a.dias, 'termina')} (${data}). Pra continuar evoluindo sem parar, é só renovar por um dos links:`
      : `Oi ${nome}, tudo bem? Seu plano ${p.nome} terminou em ${data}. Renova por um dos links e volta a treinar hoje mesmo:`;
    return `${abertura}\n\n${linhas}\n\nUse o mesmo CPF do seu cadastro que o acesso renova sozinho. ${rodape}`;
  }

  // Aluno antigo (mensalidade fora dos planos do site): cobrança por PIX
  const chave = typeof CHAVE_PIX !== 'undefined' ? CHAVE_PIX : '';
  return `Oi ${nome}, tudo bem? Sua mensalidade da consultoria ${a.dias >= 0 ? `${quandoTexto(a.dias)} (${data})` : `venceu em ${data}`}.\n\n💰 Valor: ${valorCobranca(a)}${chave ? `\n🔑 Chave PIX: ${chave}` : ''}\n\nDepois de pagar, me manda o comprovante por aqui que eu confirmo seu acesso. ${rodape}`;
}

function textoUltimaCobranca(a) {
  const c = a.ultima_cobranca;
  if (!c) return '<span class="pill">ainda não cobrado</span>';
  const dd = diasDesde(c.data);
  const quando = dd === 0 ? 'hoje' : dd === 1 ? 'ontem' : `há ${dd} dias`;
  const quem = c.por === 'admin' ? 'Jhonata' : c.por;
  return `<span class="pill ${dd === 0 ? 'ok' : ''}">cobrado ${quando} (${esc(quem)})${c.vezes > 1 ? ` • ${c.vezes}x` : ''}</span>`;
}

function telaCobrancas(L) {
  const atrasados = L.cobrancas.filter(a => a.dias < 0).length;
  return painelHtml('💸 Cobranças', `Alunos com o plano terminando em até ${DIAS_RENOVACAO} dias, mensalidade do recorrente em até ${DIAS_MENSALIDADE} dias e quem está atrasado${atrasados ? ` (<b style="color:var(--bad)">${atrasados} atrasado${atrasados > 1 ? 's' : ''}</b>)` : ''}. A mensagem já vai com o link de pagamento.`,
    L.cobrancas.map(a => {
      const urg = a.dias < 0 ? 'bad' : a.dias <= 3 ? 'warn' : 'gold';
      const rotulo = a.tipoCobranca === 'mensalidade' ? 'mensalidade' : (PLANOS[a.plano] ? 'renovação' : 'mensalidade');
      const msg = mensagemCobranca(a);
      const n = fone(a);
      const acaoWhats = n
        ? `<a class="btn btn-wpp" target="_blank" rel="noopener" href="${whats(n, msg)}" data-cobrar="${esc(a.codigo)}" data-tipo="${a.dias < 0 ? 'atraso' : a.tipoCobranca}">📲 Cobrar</a>`
        : `<button type="button" class="btn" data-copiar="${esc(msg)}" data-cobrar="${esc(a.codigo)}" data-tipo="${a.dias < 0 ? 'atraso' : a.tipoCobranca}">📋 Copiar cobrança</button>`;
      return item(
        `<b>${esc(a.nome)}</b>
         <small><span class="pill ${urg}">${quandoTexto(a.dias, a.tipoCobranca === 'renovacao' && PLANOS[a.plano] ? 'termina' : 'vence')}</span> ${rotulo} • ${valorCobranca(a)} • ${dataBR(a.ref)}</small>
         <small>${esc(nomePlano(a.plano))}${a.forma_pagamento ? ' • ' + NOMES_FORMA[a.forma_pagamento] : ''}</small>
         <small>${textoUltimaCobranca(a)}${n ? '' : '<span class="pill bad">sem WhatsApp cadastrado</span>'}</small>`,
        acaoWhats + botaoConfirmar(a, '✅ Pagou'));
    }), 'Ninguém para cobrar agora. 🎉');
}

function telaNovos(L) {
  return painelHtml('✅ Novos alunos', 'Entraram nos últimos 30 dias. Dê as boas-vindas e acompanhe o começo.',
    L.novos.map(a => item(
      `<b>${esc(a.nome)}</b><small>${esc(nomePlano(a.plano))} • começou ${textoDias(-diasDesde(a.data_inicio))} (${dataBR(a.data_inicio)})</small>
       <small>${a.forma_pagamento ? `<span class="pill">${NOMES_FORMA[a.forma_pagamento]}</span>` : ''}<span class="pill ${a.tem_treino ? 'ok' : 'warn'}">${a.tem_treino ? 'treino liberado' : 'treino em montagem'}</span></small>`,
      botaoWhats(a, `Oi ${primeiro(a.nome)}! Seja muito bem-vindo(a) à consultoria do Jhonata! 💪 Qualquer dúvida sobre o app ou o plano, pode me chamar aqui.`, '📲 Boas-vindas')
    )), 'Nenhum aluno novo nos últimos 30 dias.');
}

function telaLeads(L) {
  const opcoes = [['novo', 'Novo'], ['contatado', 'Contatado'], ['negociando', 'Negociando'], ['fechou', 'Fechou ✅'], ['perdido', 'Não quis']];
  return painelHtml('🆕 Contatos do site', 'Pessoas que deixaram nome e WhatsApp no site. Chame rápido: quanto antes, maior a chance de fechar.',
    L.leads.map(l => `
      <div class="item" style="display:block">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <div class="info"><b>${esc(l.nome)}</b><small>${esc(l.objetivo || 'objetivo não informado')} • ${textoDias(-diasDesde(l.criado_em))}</small></div>
          <div class="acoes">${botaoWhats({ telefone: l.whatsapp }, `Oi ${primeiro(l.nome)}, tudo bem? Aqui é da equipe do Jhonata! Vi que você deixou seu contato no site${l.objetivo ? ` e que seu objetivo é ${l.objetivo.toLowerCase()}` : ''}. Posso te explicar como funciona a consultoria? 💪`, '📲 Chamar')}</div>
        </div>
        <div class="lead-ctrl">
          <select data-lead-status="${l.id}" aria-label="Situação do contato">${opcoes.map(([v, t]) => `<option value="${v}" ${l.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <input data-lead-nota="${l.id}" placeholder="Anotação (ex.: retornar sexta)" value="${esc(l.nota || '')}" aria-label="Anotação">
          <button type="button" class="btn" data-lead-salvar="${l.id}">Salvar</button>
        </div>
      </div>`), 'Nenhum contato novo do site.');
}

function telaVendas() {
  const tipos = { nova: 'Venda nova', renovacao: 'Renovação', mensalidade: 'Mensalidade' };
  const v = painel.vendas || [];
  return painelHtml('💰 Vendas do mês', 'Pagamentos confirmados no mês selecionado que contam para a sua comissão.',
    v.map(x => item(
      `<b>${esc(x.aluno_nome)}</b><small>${esc(nomePlano(x.plano))} • ${NOMES_FORMA[x.forma] || esc(x.forma)} • ${dataBR(x.criado_em)}</small>
       <small><span class="pill ${x.tipo === 'mensalidade' ? '' : 'gold'}">${tipos[x.tipo] || esc(x.tipo)}</span>${x.observacao ? esc(x.observacao) : ''}</small>`,
      `<b style="font-variant-numeric:tabular-nums">${reais(x.valor)}</b>`)), 'Nenhuma venda confirmada neste mês ainda.');
}

function telaLinks() {
  const cod = painel.vendedor ? painel.vendedor.codigo : '';
  const vend = cod ? `&vend=${encodeURIComponent(cod)}` : '';
  const linhas = (typeof PLANOS !== 'undefined' ? Object.entries(PLANOS) : []).map(([id, p]) => {
    const link = `${SITE}/app.html?modo=anamnese${p.tipo === 'treino' ? '&tipo=treino' : ''}&plano=${id}${vend}`;
    const formas = formasPagamentoPlano(p).map(f => `• ${f.titulo}`).join('\n');
    const msg = `Perfeito! Segue o link do seu plano *${p.nome}*:\n${link}\n\nÉ só preencher a avaliação com calma e, no final, escolher como pagar:\n${formas}\n\nDepois de pagar, me manda o comprovante que eu libero seu acesso! 💪`;
    return `<div class="link-row"><b>${esc(p.nome)}</b><small style="color:var(--muted)">${formasPagamentoPlano(p).map(f => esc(f.titulo)).join(' • ')}</small>
      <code>${esc(link)}</code>
      <div class="acoes"><button type="button" class="btn btn-gold" data-copiar="${esc(msg)}">Copiar mensagem</button><button type="button" class="btn" data-copiar="${esc(link)}">Copiar link</button></div></div>`;
  });
  const site = `${SITE}/?vend=${encodeURIComponent(cod)}`;
  linhas.push(`<div class="link-row"><b>Site com todos os planos</b><code>${esc(site)}</code><div class="acoes"><button type="button" class="btn" data-copiar="${esc(site)}">Copiar link</button></div></div>`);
  return painelHtml('🔗 Meus links', 'Seus links já levam o seu código: toda venda feita por eles entra na sua comissão automaticamente.', linhas, '');
}

/* ---------------- ações ---------------- */
async function registrarCobranca(codigo, tipo) {
  try {
    const r = await api('POST', '/api/equipe/cobranca', { codigo, tipo });
    const a = (painel.alunos || []).find(x => x.codigo === codigo);
    if (a) a.ultima_cobranca = { data: r.data, por: r.por, vezes: ((a.ultima_cobranca && a.ultima_cobranca.vezes) || 0) + 1 };
    setTimeout(render, 400);
  } catch (e) {}
}

function ligarAcoes() {
  document.querySelectorAll('[data-cobrar]').forEach(b => b.addEventListener('click', () => registrarCobranca(b.dataset.cobrar, b.dataset.tipo)));
  document.querySelectorAll('[data-confirmar]').forEach(b => b.onclick = () => abrirConfirmar(b.dataset.confirmar));
  document.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => copiar(b, b.dataset.copiar));
  document.querySelectorAll('[data-lead-salvar]').forEach(b => b.onclick = async () => {
    const id = b.dataset.leadSalvar;
    b.disabled = true;
    try {
      await api('POST', `/api/equipe/leads/${id}`, { status: document.querySelector(`[data-lead-status="${id}"]`).value, nota: document.querySelector(`[data-lead-nota="${id}"]`).value });
      toast('Contato atualizado.');
      await carregar();
    } catch (err) { toast(err.message); b.disabled = false; }
  });
}

function copiar(btn, texto) {
  const original = btn.textContent;
  const ok = () => { btn.textContent = '✓ Copiado'; setTimeout(() => { btn.textContent = original; }, 1500); };
  const plano_b = () => { const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Não foi possível copiar.'); } t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, plano_b); else plano_b();
}

function preencherFormas() {
  const p = PLANOS[$('mcPlano').value];
  const atual = $('mcForma').value;
  const formas = p ? formasPagamentoPlano(p) : [];
  $('mcForma').innerHTML = formas.map(f => `<option value="${f.id}">${f.icone} ${esc(f.titulo)}</option>`).join('');
  if (formas.some(f => f.id === atual)) $('mcForma').value = atual;
  preencherValor();
}
function preencherValor() {
  const p = PLANOS[$('mcPlano').value]; const f = $('mcForma').value;
  if (!p) return;
  $('mcValor').value = f === 'pix' ? p.pix : f === 'cartao' ? p.cartao.total : f === 'recorrente' ? p.recorrente : '';
}

function abrirConfirmar(codigo) {
  alunoConfirmando = (painel.alunos || []).find(a => a.codigo === codigo);
  if (!alunoConfirmando) return;
  const a = alunoConfirmando;
  $('mcAluno').textContent = `${a.nome}${a.telefone ? ' • ' + a.telefone : ''}`;
  $('mcPlano').innerHTML = Object.entries(PLANOS).map(([id, p]) => `<option value="${id}">${esc(p.nome)}</option>`).join('');
  if (PLANOS[a.plano]) $('mcPlano').value = a.plano;
  $('mcForma').innerHTML = '';
  preencherFormas();
  const formaPadrao = a.aguardando ? a.forma_escolhida : a.forma_pagamento;
  if (formaPadrao && [...$('mcForma').options].some(o => o.value === formaPadrao)) { $('mcForma').value = formaPadrao; preencherValor(); }
  $('mcObs').value = '';
  $('modalConfirmar').classList.remove('hidden');
}
$('mcPlano').onchange = preencherFormas;
$('mcForma').onchange = preencherValor;
$('mcCancelar').onclick = () => $('modalConfirmar').classList.add('hidden');
$('modalConfirmar').addEventListener('click', (e) => { if (e.target.id === 'modalConfirmar') $('modalConfirmar').classList.add('hidden'); });
$('mcConfirmar').onclick = async () => {
  if (!alunoConfirmando) return;
  const b = $('mcConfirmar'); b.disabled = true; b.textContent = 'Confirmando...';
  try {
    const r = await api('POST', '/api/equipe/pagamentos/confirmar', {
      codigo: alunoConfirmando.codigo, plano: $('mcPlano').value, forma: $('mcForma').value,
      valor: parseFloat($('mcValor').value) || 0, observacao: $('mcObs').value
    });
    $('modalConfirmar').classList.add('hidden');
    const tipos = { nova: 'Venda confirmada', renovacao: 'Renovação confirmada', mensalidade: 'Mensalidade confirmada' };
    toast(`${tipos[r.tipo] || 'Pagamento confirmado'}! Acesso liberado até ${dataBR(r.data_expiracao)}.`);
    await carregar();
  } catch (err) { toast(err.message); }
  finally { b.disabled = false; b.textContent = '✅ Confirmar e liberar acesso'; }
};

/* ---------------- início ---------------- */
function iniciar() {
  $('telaLogin').classList.add('hidden');
  $('telaPainel').classList.remove('hidden');
  montarMeses();
  carregar();
}
if (lerToken()) iniciar();
