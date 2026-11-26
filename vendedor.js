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
let mostrarTodosIndicacao = false;
const DESCONTO_INDICADOR = 20;
const DESCONTO_INDICADO = 10;

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
  // Indicações: quem fechou nos últimos 30 dias (momento de maior empolgação) e, opcionalmente, todos os ativos
  const ativos = alunos.filter(a => !a.aguardando && a.status === 'pago');
  const indicacao = (mostrarTodosIndicacao ? ativos : ativos.filter(a => diasDesde(a.data_inicio) !== null && diasDesde(a.data_inicio) <= 30))
    .sort((x, y) => String(y.data_inicio).localeCompare(String(x.data_inicio)));
  const creditosPend = (painel.creditos || []).filter(c => c.status === 'pendente');
  return { pendentes, cobrancas, novos, leads, indicacao, creditosPend };
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
      A comissão é só sobre as <b>suas vendas novas</b> (e as mensalidades do recorrente dos alunos que você vendeu). Renovações e alunos que já eram do Jhonata não geram comissão.</div>
    ${painel.saldo ? `<div class="saldo">
      <div><span>Saldo disponível para resgate</span><b>${reais(painel.saldo.disponivel)}</b>
        <small>${painel.saldo.pendente ? `${reais(painel.saldo.pendente)} em análise • ` : ''}${reais(painel.saldo.pago)} já recebido</small></div>
      <button type="button" class="btn btn-gold" id="btnResgatar" ${painel.saldo.disponivel >= 1 ? '' : 'disabled'}>💸 Solicitar resgate</button>
    </div>` : ''}`;
  const br = $('btnResgatar');
  if (br) br.onclick = abrirResgate;
}

const ABAS = [
  ['pendentes', '⏳ Aguardando pagamento'],
  ['cobrancas', '💸 Cobranças'],
  ['novos', '✅ Novos alunos'],
  ['indicacoes', '🤝 Indicações'],
  ['leads', '🆕 Contatos'],
  ['vendas', '💰 Minhas vendas'],
  ['resgates', '🏦 Resgates'],
  ['links', '🔗 Links e planos']
];

function render() {
  renderComissao();
  const L = listas();
  const contagem = { pendentes: L.pendentes.length, cobrancas: L.cobrancas.length, novos: L.novos.length, indicacoes: L.creditosPend.length || null, leads: L.leads.length, vendas: (painel.vendas || []).length, resgates: (painel.saques || []).filter(x => x.status === 'pendente').length, links: null };
  $('abas').innerHTML = ABAS.map(([id, nome]) => `<button type="button" role="tab" class="aba ${abaAtual === id ? 'on' : ''} ${contagem[id] ? 'tem' : ''}" data-aba="${id}" aria-selected="${abaAtual === id}">${nome}${contagem[id] !== null ? ` <b>${contagem[id]}</b>` : ''}</button>`).join('');
  $('abas').querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { abaAtual = b.dataset.aba; render(); });

  const telas = { pendentes: telaPendentes, cobrancas: telaCobrancas, novos: telaNovos, indicacoes: telaIndicacoes, leads: telaLeads, vendas: telaVendas, resgates: telaResgates, links: telaLinks };
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
    const desconto = (painel.creditos || []).filter(c => c.status === 'pendente' && c.aluno_codigo === a.codigo).reduce((t, c) => t + (parseFloat(c.valor) || 0), 0);
    if (desconto) {
      const inicio = a.dias >= 0
        ? `Oi ${nome}, tudo bem? Seu plano ${p.nome} ${quandoTexto(a.dias, 'termina')} (${data}).`
        : `Oi ${nome}, tudo bem? Seu plano ${p.nome} terminou em ${data}.`;
      return `${inicio}\n\n🎁 E tem novidade: você tem *${reais(desconto)} de desconto* pelas suas indicações! Me diz como prefere pagar (PIX, cartão parcelado ou mensal no cartão) que eu te mando o valor já com o desconto. ${rodape}`;
    }
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

function nomeAluno(codigo) {
  const a = (painel.alunos || []).find(x => x.codigo === codigo);
  return a ? a.nome : codigo;
}
function mensagemContato(l) {
  if (l.indicado_por) {
    const quem = primeiro(nomeAluno(l.indicado_por));
    return `Oi ${primeiro(l.nome)}, tudo bem? Aqui é da equipe do Jhonata! Quem me passou seu contato foi ${quem}, que treina com a gente e achou que você ia curtir treinar com acompanhamento de perto 💪\n\nPor ter vindo por indicação, você ganha R$ ${DESCONTO_INDICADO} de desconto pra começar. Posso te explicar como funciona a consultoria?`;
  }
  return `Oi ${primeiro(l.nome)}, tudo bem? Aqui é da equipe do Jhonata! Vi que você deixou seu contato no site${l.objetivo ? ` e que seu objetivo é ${l.objetivo.toLowerCase()}` : ''}. Posso te explicar como funciona a consultoria? 💪`;
}

function mensagemPedirIndicacao(a) {
  const cod = painel.vendedor ? painel.vendedor.codigo : '';
  const link = `${SITE}/?ind=${encodeURIComponent(a.codigo)}${cod ? `&vend=${encodeURIComponent(cod)}` : ''}`;
  return `Oi ${primeiro(a.nome)}, tudo bem? Que bom ter você treinando com a gente! 💪\n\nTem alguém que você queria que treinasse junto? Amigo, namorado(a), parente, colega de trabalho...\n\n🎁 Funciona assim: se a pessoa fechar a consultoria, *você ganha R$ ${DESCONTO_INDICADOR} de desconto* na sua próxima renovação e *ela ganha R$ ${DESCONTO_INDICADO} de desconto* pra começar.\n\nÉ só me mandar o nome e o WhatsApp de quem você quer indicar, ou enviar pra pessoa o seu link de indicação:\n${link}\n\nQuanto mais gente você indicar, mais desconto você acumula! 🔥`;
}

function telaIndicacoes(L) {
  const pedido = (a) => {
    const p = a.ultimo_pedido_indicacao;
    if (!p) return '<span class="pill">ainda não pedido</span>';
    const dd = diasDesde(p.data);
    return `<span class="pill ${dd === 0 ? 'ok' : ''}">pedido ${dd === 0 ? 'hoje' : dd === 1 ? 'ontem' : `há ${dd} dias`}</span>`;
  };
  const lista = L.indicacao.map(a => {
    const msg = mensagemPedirIndicacao(a);
    const n = fone(a);
    const acao = n
      ? `<a class="btn btn-wpp" target="_blank" rel="noopener" href="${whats(n, msg)}" data-cobrar="${esc(a.codigo)}" data-tipo="indicacao">📲 Pedir indicação</a>`
      : `<button type="button" class="btn" data-copiar="${esc(msg)}" data-cobrar="${esc(a.codigo)}" data-tipo="indicacao">📋 Copiar mensagem</button>`;
    return item(
      `<b>${esc(a.nome)}</b><small>começou ${textoDias(-diasDesde(a.data_inicio)) || '—'} • ${esc(nomePlano(a.plano))}</small>
       <small>${pedido(a)}${a.indicacoes_recebidas ? `<span class="pill gold">${a.indicacoes_recebidas} ${a.indicacoes_recebidas > 1 ? 'indicações' : 'indicação'}</span>` : ''}</small>`,
      acao + `<button type="button" class="btn" data-copiar="${esc(`${SITE}/?ind=${a.codigo}${painel.vendedor ? '&vend=' + painel.vendedor.codigo : ''}`)}">🔗 Link dele</button>`);
  });

  const opcoesAlunos = (painel.alunos || []).filter(a => !a.aguardando).sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'pt-BR'))
    .map(a => `<option value="${esc(a.codigo)}">${esc(a.nome)}</option>`).join('');

  const creditos = L.creditosPend.map(c => item(
    `<b>${esc(nomeAluno(c.aluno_codigo))} — ${reais(c.valor)} de desconto</b><small>${esc(c.motivo || '')} • ${dataBR(c.criado_em)}</small>`,
    `<button type="button" class="btn" data-credito="${c.id}">✓ Desconto aplicado</button>`));

  return `
    <div class="painel">
      <h2>🤝 Pedir indicação</h2>
      <p class="desc">Quem fechou há pouco está empolgado: é a melhor hora de pedir indicação. Quem indica ganha <b>R$ ${DESCONTO_INDICADOR}</b> de desconto e quem é indicado ganha <b>R$ ${DESCONTO_INDICADO}</b>, quando fechar.</p>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin:0"><input type="checkbox" id="chkTodosInd" style="width:auto" ${mostrarTodosIndicacao ? 'checked' : ''}> Mostrar todos os alunos ativos (não só os últimos 30 dias)</label>
      ${lista.length ? lista.join('') : '<div class="vazio">Ninguém fechou nos últimos 30 dias. Marque a opção acima para ver todos os alunos.</div>'}
    </div>
    <div class="painel">
      <h2>➕ Cadastrar contato indicado</h2>
      <p class="desc">O aluno te mandou o contato de alguém? Cadastre aqui: ele vai para a aba Contatos com mensagem pronta, e se a pessoa fechar, os descontos são gerados sozinhos.</p>
      <label for="indNome">Nome da pessoa indicada</label><input id="indNome" placeholder="Ex.: Carla">
      <label for="indZap">WhatsApp</label><input id="indZap" type="tel" inputmode="tel" placeholder="(51) 90000-0000">
      <label for="indQuem">Quem indicou</label><select id="indQuem"><option value="">Escolha o aluno...</option>${opcoesAlunos}</select>
      <button type="button" class="btn btn-gold" id="btnSalvarIndicado" style="margin-top:12px">Salvar contato</button>
    </div>
    <div class="painel">
      <h2>🎁 Descontos de indicação a aplicar</h2>
      <p class="desc">Gerados quando um indicado fecha. Aplique na renovação ou no pagamento do aluno e dê baixa aqui.</p>
      ${creditos.length ? creditos.join('') : '<div class="vazio">Nenhum desconto pendente.</div>'}
    </div>`;
}

function telaLeads(L) {
  const opcoes = [['novo', 'Novo'], ['contatado', 'Contatado'], ['negociando', 'Negociando'], ['fechou', 'Fechou ✅'], ['perdido', 'Não quis']];
  return painelHtml('🆕 Contatos', 'Pessoas que deixaram o contato no site ou foram indicadas por alunos. Chame rápido: quanto antes, maior a chance de fechar.',
    L.leads.map(l => `
      <div class="item" style="display:block">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <div class="info"><b>${esc(l.nome)}</b><small>${l.indicado_por ? `<span class="pill gold">indicado por ${esc(primeiro(nomeAluno(l.indicado_por)))}</span>` : ''}${esc(l.objetivo || (l.indicado_por ? '' : 'objetivo não informado'))} • ${textoDias(-diasDesde(l.criado_em))}</small></div>
          <div class="acoes">${botaoWhats({ telefone: l.whatsapp }, mensagemContato(l), '📲 Chamar')}</div>
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
  return painelHtml('💰 Vendas do mês', 'Pagamentos confirmados no mês dos alunos que você vendeu. Renovações aparecem aqui só para acompanhamento: não geram comissão.',
    v.map(x => item(
      `<b>${esc(x.aluno_nome)}</b><small>${esc(nomePlano(x.plano))} • ${NOMES_FORMA[x.forma] || esc(x.forma)} • ${dataBR(x.criado_em)}</small>
       <small><span class="pill ${x.tipo === 'nova' ? 'gold' : ''}">${tipos[x.tipo] || esc(x.tipo)}</span>${x.tipo === 'renovacao' ? '<span class="pill">sem comissão</span>' : ''}${x.observacao ? esc(x.observacao) : ''}</small>`,
      `<b style="font-variant-numeric:tabular-nums;${x.tipo === 'renovacao' ? 'opacity:.5;text-decoration:line-through' : ''}">${reais(x.valor)}</b>`)), 'Nenhuma venda confirmada neste mês ainda.');
}

function telaLinks() {
  const cod = painel.vendedor ? painel.vendedor.codigo : '';
  const vend = cod ? `&vend=${encodeURIComponent(cod)}` : '';
  const planos = typeof PLANOS !== 'undefined' ? Object.entries(PLANOS) : [];
  const ordem = (p) => ['Anual', 'Semestral', 'Trimestral'].indexOf(p.duracao) + (p.dupla ? 10 : 0);
  const rotuloForma = { pix: 'PIX à vista', cartao: 'Cartão parcelado', recorrente: 'Mensal no cartão (recorrente)' };
  const precos = (p) => formasPagamentoPlano(p).map(f => `<li><span>${f.icone} ${rotuloForma[f.id]}</span><b>${esc(f.titulo.replace(/ no PIX à vista| no cartão recorrente| no cartão/, ''))}</b></li>`).join('');
  const botoes = (msg, link) => `<div class="acoes"><button type="button" class="btn btn-gold" data-copiar="${esc(msg)}">Copiar mensagem</button><button type="button" class="btn" data-copiar="${esc(link)}">Copiar link</button></div>`;

  // 1) Links da avaliação (o aluno preenche e paga no final)
  const blocoAvaliacao = (tipo, titulo, sub) => {
    const lista = planos.filter(([, p]) => p.tipo === tipo).sort((a, b) => ordem(a[1]) - ordem(b[1]));
    return `<div class="links-grupo"><h3>${titulo}</h3><p class="desc">${sub}</p>${lista.map(([id, p]) => {
      const link = `${SITE}/app.html?modo=anamnese${p.tipo === 'treino' ? '&tipo=treino' : ''}&plano=${id}${vend}`;
      const formas = formasPagamentoPlano(p).map(f => `• ${f.titulo}`).join('\n');
      const msg = `Perfeito! Segue o link do seu plano *${p.nome}*:\n${link}\n\nÉ só preencher a avaliação com calma (ela é usada para montar seu treino) e, no final, escolher como pagar:\n${formas}\n\n${p.dupla ? 'Depois de pagar, me avisa que eu mando o link da sua dupla.\n\n' : ''}Qualquer dúvida, me chama! 💪`;
      return `<div class="link-row"><div class="link-topo"><b>${p.dupla ? '👥 Dupla (anual)' : esc(p.duracao)}</b>${p.duracao === 'Anual' && !p.dupla ? '<span class="pill gold">mais vendido</span>' : ''}</div>
        <ul class="precos">${precos(p)}</ul>
        <code>${esc(link)}</code>${botoes(msg, link)}</div>`;
    }).join('')}</div>`;
  };

  // 2) Links especiais
  const especiais = [
    ['👥 2ª pessoa da dupla — Treino', `${SITE}/app.html?modo=anamnese_convidado&tipo=treino&origem=dupla`, 'Mande depois que o titular pagou o Treino em Dupla. Não cobra de novo.'],
    ['👥 2ª pessoa da dupla — Completa', `${SITE}/app.html?modo=anamnese_convidado&origem=dupla`, 'Mande depois que o titular pagou a Completa em Dupla. Não cobra de novo.'],
    ['🌐 Site com todos os planos', `${SITE}/?vend=${encodeURIComponent(cod)}`, 'Para quem ainda quer ver os planos antes de decidir.']
  ].map(([nome, link, nota]) => `<div class="link-row"><b>${nome}</b><small class="desc" style="margin:0">${nota}</small><code>${esc(link)}</code><div class="acoes"><button type="button" class="btn" data-copiar="${esc(link)}">Copiar link</button></div></div>`).join('');

  // 3) Links de pagamento do Asaas (sem avaliação)
  const pagamentos = planos.sort((a, b) => (a[1].tipo === b[1].tipo ? 0 : a[1].tipo === 'treino' ? -1 : 1) || ordem(a[1]) - ordem(b[1])).map(([, p]) => {
    const linhas = formasPagamentoPlano(p).filter(f => f.link).map(f => `
      <div class="pag-linha"><span>${f.icone} ${rotuloForma[f.id]} — <b>${esc(f.titulo.replace(/ no PIX à vista| no cartão recorrente| no cartão/, ''))}</b></span>
        <button type="button" class="btn" data-copiar="${esc(f.link)}">Copiar</button></div>`).join('');
    return `<div class="link-row"><b>${esc(p.nome)}</b>${linhas}</div>`;
  }).join('');

  return `
    <div class="painel">
      <h2>📝 Links da avaliação</h2>
      <p class="desc">Use na venda nova: o aluno preenche a avaliação com o plano já escolhido e paga no final. Os links levam o seu código, então a venda entra na sua comissão.</p>
      ${blocoAvaliacao('treino', '🏋️ Consultoria de Treino', 'Treino individualizado + acompanhamento.')}
      ${blocoAvaliacao('completa', '🥗 Consultoria Completa', 'Treino + plano alimentar + acompanhamento.')}
    </div>
    <div class="painel">
      <h2>👥 Links especiais</h2>
      ${especiais}
    </div>
    <div class="painel">
      <h2>💳 Links de pagamento do Asaas</h2>
      <p class="desc">Pagamento direto, sem avaliação. Use para <b>renovação</b> de quem já é aluno ou para quem já preencheu a avaliação. Peça para pagar com o mesmo CPF do cadastro.</p>
      ${pagamentos}
    </div>`;
}

function telaResgates() {
  const sd = painel.saldo || { disponivel: 0, pendente: 0, pago: 0, ganho: 0 };
  const st = { pendente: ['warn', '⏳ em análise'], pago: ['ok', '✅ pago'], recusado: ['bad', '✖ recusado'] };
  const lista = (painel.saques || []).map(x => item(
    `<b>${reais(x.valor)}</b><small>Pedido em ${dataBR(x.criado_em)}${x.resolvido_em ? ` • resolvido em ${dataBR(x.resolvido_em)}` : ''} • PIX: ${esc(x.chave_pix || '')}</small>
     ${x.resposta ? `<small>Resposta: ${esc(x.resposta)}</small>` : ''}`,
    `<span class="pill ${st[x.status] ? st[x.status][0] : ''}">${st[x.status] ? st[x.status][1] : esc(x.status)}</span>`));
  return `<div class="painel">
    <h2>🏦 Resgates</h2>
    <p class="desc">A comissão de cada mês soma no seu saldo. Peça o resgate quando quiser: o pedido vai para o Jhonata, que faz o PIX e marca como pago.</p>
    <div class="com-nums">
      <div><span>Comissão acumulada</span><b>${reais(sd.ganho)}</b></div>
      <div><span>Já recebido</span><b>${reais(sd.pago)}</b></div>
      <div><span>Em análise</span><b>${reais(sd.pendente)}</b></div>
      <div><span>Disponível</span><b class="gold">${reais(sd.disponivel)}</b></div>
    </div>
    <button type="button" class="btn btn-gold" id="btnResgatar2" ${sd.disponivel >= 1 ? '' : 'disabled'}>💸 Solicitar resgate</button>
    ${lista.length ? lista.join('') : '<div class="vazio">Você ainda não pediu nenhum resgate.</div>'}
  </div>`;
}

function abrirResgate() {
  let m = $('modalResgate');
  if (!m) {
    m = document.createElement('div');
    m.id = 'modalResgate'; m.className = 'modal hidden'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="modal-card">
      <h2>Solicitar resgate</h2>
      <p id="rgSaldo"></p>
      <label for="rgValor">Valor (R$)</label><input id="rgValor" type="number" min="1" step="0.01" inputmode="decimal">
      <label for="rgChave">Sua chave PIX</label><input id="rgChave" placeholder="CPF, e-mail, telefone ou chave aleatória" autocomplete="off">
      <label for="rgObs">Observação (opcional)</label><input id="rgObs" placeholder="Ex.: preciso até sexta">
      <div class="modal-botoes">
        <button class="btn btn-gold" id="rgEnviar" type="button">Enviar pedido</button>
        <button class="btn" id="rgCancelar" type="button">Cancelar</button>
      </div></div>`;
    document.body.appendChild(m);
    $('rgCancelar').onclick = () => m.classList.add('hidden');
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
    $('rgEnviar').onclick = async () => {
      const b = $('rgEnviar'); b.disabled = true;
      try {
        const chave = $('rgChave').value.trim();
        try { localStorage.setItem('vendedor_chave_pix', chave); } catch (e) {}
        await api('POST', '/api/vendedor/saques', { valor: parseFloat($('rgValor').value) || 0, chave_pix: chave, observacao: $('rgObs').value });
        m.classList.add('hidden');
        toast('Pedido de resgate enviado! O Jhonata vai fazer o PIX.');
        abaAtual = 'resgates';
        await carregar();
      } catch (err) { toast(err.message); }
      finally { b.disabled = false; }
    };
  }
  const disp = (painel.saldo && painel.saldo.disponivel) || 0;
  $('rgSaldo').textContent = `Disponível: ${reais(disp)}`;
  $('rgValor').value = disp ? disp.toFixed(2) : '';
  $('rgValor').max = disp;
  try { $('rgChave').value = localStorage.getItem('vendedor_chave_pix') || ''; } catch (e) {}
  $('rgObs').value = '';
  m.classList.remove('hidden');
}

/* ---------------- ações ---------------- */
async function registrarCobranca(codigo, tipo) {
  try {
    const r = await api('POST', '/api/equipe/cobranca', { codigo, tipo });
    const a = (painel.alunos || []).find(x => x.codigo === codigo);
    if (a && tipo === 'indicacao') a.ultimo_pedido_indicacao = { data: r.data, por: r.por };
    else if (a) a.ultima_cobranca = { data: r.data, por: r.por, vezes: ((a.ultima_cobranca && a.ultima_cobranca.vezes) || 0) + 1 };
    setTimeout(render, 400);
  } catch (e) {}
}

function ligarAcoes() {
  const chk = $('chkTodosInd'); if (chk) chk.onchange = () => { mostrarTodosIndicacao = chk.checked; render(); };
  const bInd = $('btnSalvarIndicado');
  if (bInd) bInd.onclick = async () => {
    bInd.disabled = true;
    try {
      await api('POST', '/api/equipe/leads', { nome: $('indNome').value, whatsapp: $('indZap').value, indicado_por: $('indQuem').value });
      toast('Contato salvo! Ele está na aba Contatos com a mensagem pronta.');
      await carregar();
    } catch (err) { toast(err.message); bInd.disabled = false; }
  };
  document.querySelectorAll('[data-credito]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api('POST', `/api/equipe/creditos/${b.dataset.credito}`, { status: 'usado' }); toast('Desconto marcado como aplicado.'); await carregar(); }
    catch (err) { toast(err.message); b.disabled = false; }
  });
  const br2 = $('btnResgatar2'); if (br2) br2.onclick = abrirResgate;
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
