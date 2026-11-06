/* -------------------------------------------------------------
   ADMIN2.JS - MÓDULO FINANCEIRO, BALANÇO DE CONTAS & COBRANÇA
------------------------------------------------------------- */

let dadosFinanceirosGerais = {
  despesasFixas: [],
  despesasVariaveis: [],
  entradasAvulsas: [],
  metaFaturamento: 0
};

/* -------------------------------------------------------------
   FUNÇÕES UTILITÁRIAS AUTÔNOMAS DO MÓDULO FINANCEIRO
------------------------------------------------------------- */

function obterPropriedadeAluno(aluno, chave) {
  if (!aluno) return null;
  return aluno[chave] ?? 
         aluno.payload?.[chave] ?? 
         aluno.dadosAnamnese?.[chave] ?? 
         null;
}

function parsePrecoFin(valorRaw) {
  if (valorRaw === null || valorRaw === undefined) return 0;
  if (typeof valorRaw === 'number') return isNaN(valorRaw) ? 0 : valorRaw;
  
  let str = String(valorRaw).trim().replace(/[^\d.,]/g, '');
  if (!str) return 0;

  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function extrairPrecoAlunoFin(aluno) {
  if (!aluno) return 0;
  const v = obterPropriedadeAluno(aluno, 'valor_mensalidade') ?? 
            obterPropriedadeAluno(aluno, 'valorMensal') ?? 
            obterPropriedadeAluno(aluno, 'valor') ?? 
            obterPropriedadeAluno(aluno, 'preco') ?? 0;
  return parsePrecoFin(v);
}

function calcularDiasRestantesFin(dataExpiracaoStr, diaVencimentoFallback = 7, isento = false, statusPagamento = '') {
  if (isento === true || statusPagamento === 'isento') {
    return { dias: 9999, dataFormatada: "Livre (VIP)" };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let targetDate = null;

  if (dataExpiracaoStr) {
    const partes = String(dataExpiracaoStr).split('T')[0].split('-');
    if (partes.length === 3) {
      const ano = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      const dia = parseInt(partes[2], 10);
      targetDate = new Date(ano, mes, dia, 23, 59, 59);
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    let dia = parseInt(diaVencimentoFallback) || 7;
    targetDate = new Date(anoAtual, mesAtual, dia, 23, 59, 59);

    if (targetDate < hoje) {
      targetDate = new Date(anoAtual, mesAtual + 1, dia, 23, 59, 59);
    }
  }

  const diffTempo = targetDate.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffTempo / (1000 * 3600 * 24));

  const diaFmt = String(targetDate.getDate()).padStart(2, '0');
  const mesFmt = String(targetDate.getMonth() + 1).padStart(2, '0');
  const anoFmt = targetDate.getFullYear();

  return { dias: diffDias, dataFormatada: `${diaFmt}/${mesFmt}/${anoFmt}` };
}

/* -------------------------------------------------------------
   DISPARO E LISTAGEM DE ALUNOS COM VENCIMENTO PRÓXIMO (2 a 3 DIAS)
------------------------------------------------------------- */

function obterAlunosPertoVencimento(diasMin = 2, diasMax = 3) {
  const lista = (typeof allStudentsList !== 'undefined' && Array.isArray(allStudentsList)) ? allStudentsList : [];
  if (lista.length === 0) return [];

  return lista.filter(aluno => {
    const isentoVal = obterPropriedadeAluno(aluno, 'isento');
    const stPag = String(obterPropriedadeAluno(aluno, 'status_pagamento') || '').toLowerCase();
    const planoVal = String(obterPropriedadeAluno(aluno, 'plano') || '').toLowerCase();

    const ehVIP = isentoVal === true || 
                  isentoVal === 'true' || 
                  stPag === 'isento' || 
                  stPag === 'vip' ||
                  planoVal === 'isento' || 
                  planoVal === 'vip';
                  
    if (ehVIP) return false;

    const dataExp = obterPropriedadeAluno(aluno, 'data_expiracao');
    const diaVenc = obterPropriedadeAluno(aluno, 'dia_vencimento');

    const info = calcularDiasRestantesFin(dataExp, diaVenc, false, stPag);

    return info.dias >= diasMin && info.dias <= diasMax;
  });
}

async function abrirPainelMensagensVencimentoProximo() {
  if (typeof fetchAlunos === 'function' && (!allStudentsList || allStudentsList.length === 0)) {
    await fetchAlunos();
  }

  const alunosPerto = obterAlunosPertoVencimento(2, 3);

  let modal = document.getElementById('modalMensagensVencimento');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalMensagensVencimento';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  if (alunosPerto.length === 0) {
    modal.innerHTML = `
      <div class="modal-card-finish" style="max-width:450px; text-align:center; padding:20px; background:#100305; border:1px solid var(--border); border-radius:12px;">
        <h3 style="color:#fff; font-size:15px; margin-bottom:6px;">Nenhum aluno vencendo em 2 ou 3 dias</h3>
        <p style="color:var(--muted); font-size:12px;">Nenhum cadastro encontrado para este intervalo no momento.</p>
        <button class="btn-login" style="margin-top:14px; background:var(--panel); border:1px solid var(--border); padding:8px 16px; cursor:pointer;" onclick="document.getElementById('modalMensagensVencimento').classList.add('hidden')">Fechar</button>
      </div>
    `;
    modal.classList.remove('hidden');
    return;
  }

  let htmlLista = '';
  alunosPerto.forEach(aluno => {
    const nome = obterPropriedadeAluno(aluno, 'clientName') || 
                 obterPropriedadeAluno(aluno, 'nome') || 
                 aluno.codigo || 
                 "Aluno";

    const dataExp = obterPropriedadeAluno(aluno, 'data_expiracao');
    const diaVenc = obterPropriedadeAluno(aluno, 'dia_vencimento');
    const info = calcularDiasRestantesFin(dataExp, diaVenc, false, obterPropriedadeAluno(aluno, 'status_pagamento'));

    const foneRaw = obterPropriedadeAluno(aluno, 'telefone') || 
                    obterPropriedadeAluno(aluno, 'whatsapp') || 
                    aluno.dadosAnamnese?.telefone || 
                    aluno.dadosAnamnese?.whatsapp || '';
    const foneClean = String(foneRaw).replace(/\D/g, '');

    const tipoPlano = obterPropriedadeAluno(aluno, 'plano') || 
                      obterPropriedadeAluno(aluno, 'tipo') || 
                      (aluno.apenasTreino ? "Treino" : "Consultoria Completa (Treino + Dieta)");

    const valorMensal = extrairPrecoAlunoFin(aluno);
    const valorFmt = valorMensal > 0 ? `R$ ${valorMensal.toFixed(2).replace('.', ',')}` : "valor a combinar";
    const diasExtenso = info.dias === 3 ? "três" : "dois";

    // MENSAGEM COM TOM FORMAL DE SECRETARIA
    const mensagem = `Olá, ${nome}! Tudo bem?\n\nPassando em nome da consultoria para lembrar que faltam ${diasExtenso} dias para o vencimento do seu plano de ${tipoPlano} (valor: ${valorFmt}).\n\nQualquer dúvida ou para o envio do comprovante, estamos à disposição. Tenha um ótimo dia!`;

    const urlWpp = foneClean 
      ? `https://wa.me/55${foneClean}?text=${encodeURIComponent(mensagem)}` 
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

    htmlLista += `
      <div style="background:#0d0204; border:1px solid var(--gold); border-radius:10px; padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b style="color:#fff; font-size:14px;">${escapeHtml(nome)}</b><br>
          <span style="color:var(--gold); font-size:12px; font-weight:700;">Faltam ${info.dias} dias (${info.dataFormatada})</span><br>
          <small style="color:#60a5fa; font-size:11px; font-weight:600;">Plano: ${escapeHtml(tipoPlano)} (${valorFmt})</small>
        </div>
        <a href="${urlWpp}" target="_blank" class="btn-login" style="width:auto; margin:0; padding:8px 14px; font-size:11px; background:#25d366; color:#000; font-weight:800; text-decoration:none; border-radius:6px; display:inline-flex; align-items:center;">
          📱 Enviar
        </a>
      </div>
    `;
  });

  modal.innerHTML = `
    <div class="modal-card-finish" style="max-width:540px; background:#100305; border:1px solid var(--gold); border-radius:12px; padding:18px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px dashed var(--border); padding-bottom:8px;">
        <h3 style="color:var(--gold); font-size:15px; margin:0;">🔔 Notificar Vencimentos (${alunosPerto.length})</h3>
        <button onclick="document.getElementById('modalMensagensVencimento').classList.add('hidden')" style="background:none; border:none; color:var(--accent); font-size:18px; font-weight:800; cursor:pointer;">✕</button>
      </div>
      <div style="max-height:60vh; overflow-y:auto; padding-right:4px;">
        ${htmlLista}
      </div>
      <button class="btn-login" style="margin-top:14px; width:100%; background:var(--panel); border:1px solid var(--border); padding:8px; cursor:pointer;" onclick="document.getElementById('modalMensagensVencimento').classList.add('hidden')">Fechar</button>
    </div>
  `;

  modal.classList.remove('hidden');
}

/* -------------------------------------------------------------
   REQUISIÇÕES DA API FINANCEIRA
------------------------------------------------------------- */

async function carregarDadosFinanceirosServidor() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/financeiro-detalhado`, {
      headers: authHeaders(),
      cache: 'no-cache'
    });

    if (res.ok) {
      const data = await res.json();
      dadosFinanceirosGerais = {
        despesasFixas: data.despesasFixas || [],
        despesasVariaveis: data.despesasVariaveis || [],
        entradasAvulsas: data.entradasAvulsas || [],
        metaFaturamento: data.metaFaturamento || 0
      };
    }
  } catch (e) {
    showToast("Não foi possível carregar os dados financeiros adicionais.", "error");
  }
}

async function salvarDadosFinanceirosServidor() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/salvar-financeiro-detalhado`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify(dadosFinanceirosGerais)
    });

    if (res.ok) {
      showToast("Dados de contas e lucros atualizados com sucesso!", "success");
    } else {
      showToast("Erro ao salvar alterações financeiras no servidor.", "error");
    }
  } catch (e) {
    showToast("Erro de conexão ao salvar financeiro.", "error");
  }
}

/* -------------------------------------------------------------
   TELA 1: GESTÃO FINANCEIRA EXCLUSIVA (PAGANTES, ATRASADOS E TOTAIS)
------------------------------------------------------------- */

function renderTelaFinanceiroExclusiva() {
  const container = document.getElementById('secFinanceiro');
  if (!container) return;

  const lista = (typeof allStudentsList !== 'undefined' && Array.isArray(allStudentsList)) ? allStudentsList : [];

  let receitaMensalAlunos = 0;
  let receitaAnualEstimada = 0;
  let totalPagantes = 0;
  let totalIsentos = 0;
  let totalPendentes = 0;
  let totalAtrasadosCriticos = 0;

  lista.forEach(aluno => {
    const ehIsento = (
      aluno.isento === true ||
      aluno.isento === 'true' ||
      aluno.payload?.isento === true ||
      String(aluno.status_pagamento).toLowerCase() === 'isento' ||
      String(aluno.status_pagamento).toLowerCase() === 'vip'
    );

    const infoVenc = calcularDiasRestantesFin(
      aluno.data_expiracao || aluno.payload?.data_expiracao,
      aluno.dia_vencimento || aluno.payload?.dia_vencimento,
      aluno.isento,
      aluno.status_pagamento
    );

    const valor = extrairPrecoAlunoFin(aluno);

    if (ehIsento) {
      totalIsentos++;
    } else {
      if (infoVenc.dias <= 0 || String(aluno.status_pagamento).toLowerCase() === 'pendente') {
        totalPendentes++;
        if (infoVenc.dias <= -5) totalAtrasadosCriticos++;
      } else {
        totalPagantes++;
        receitaMensalAlunos += valor;
      }
    }
  });

  receitaAnualEstimada = receitaMensalAlunos * 12;

  let html = `
    <div style="padding:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2 style="color:var(--gold); font-size:20px; margin:0;">📊 Painel de Controle Financeiro</h2>
          <span style="color:var(--muted); font-size:12px;">Visão detalhada de mensalidades, faturamento e cobranças.</span>
        </div>
        <button onclick="fetchAlunos()" class="action-btn-secondary" style="font-size:11px; padding:6px 12px;">
          🔄 Atualizar Dados
        </button>
      </div>

      <!-- CARDS DE METRICAS PRINCIPAIS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:#100305; border:1px solid var(--gold); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Faturamento Mensal Ativo</span>
          <div style="font-size:24px; font-weight:800; color:var(--gold); margin-top:4px;">R$ ${receitaMensalAlunos.toFixed(2)}</div>
          <span style="font-size:10px; color:var(--green);">🟢 Base de alunos pagantes</span>
        </div>

        <div style="background:#100305; border:1px solid #3b82f6; padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Projeção Anual Bruta</span>
          <div style="font-size:24px; font-weight:800; color:#3b82f6; margin-top:4px;">R$ ${receitaAnualEstimada.toFixed(2)}</div>
          <span style="font-size:10px; color:var(--muted);">📅 Média de 12 meses</span>
        </div>

        <div style="background:#100305; border:1px solid var(--green); padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Alunos Pagantes</span>
          <div style="font-size:24px; font-weight:800; color:var(--green); margin-top:4px;">${totalPagantes} <small style="font-size:12px; color:var(--muted);">alunos</small></div>
          <span style="font-size:10px; color:var(--muted);">👑 +${totalIsentos} alunos cortesia/VIP</span>
        </div>

        <div style="background:#100305; border:1px solid ${totalPendentes > 0 ? 'var(--accent)' : 'var(--border)'}; padding:16px; border-radius:12px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Pendências / Em Atraso</span>
          <div style="font-size:24px; font-weight:800; color:${totalPendentes > 0 ? 'var(--accent)' : '#fff'}; margin-top:4px;">${totalPendentes} <small style="font-size:12px; color:var(--muted);">alunos</small></div>
          <span style="font-size:10px; color:${totalAtrasadosCriticos > 0 ? '#ff4d4d' : 'var(--muted)'};">${totalAtrasadosCriticos} com mais de 5 dias de atraso</span>
        </div>
      </div>

      <!-- BOTÃO DE ATALHO PARA COBRANÇA DE VENCIMENTO EM 2 OU 3 DIAS -->
      <div style="background:#0d0204; border:1px solid var(--gold); padding:14px; border-radius:10px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b style="color:var(--gold); font-size:13.5px;">📲 Lembrar Alunos Vencendo em 2 ou 3 Dias</b>
          <div style="font-size:11px; color:var(--muted); margin-top:2px;">Dispare a mensagem formal de secretaria diretamente para o WhatsApp de cada aluno.</div>
        </div>
        <button onclick="abrirPainelMensagensVencimentoProximo()" class="action-btn" style="font-size:12px; padding:8px 16px; background:var(--gold); color:#000; font-weight:800;">
          🔔 Notificar Vencimentos
        </button>
      </div>

      <!-- TABELA DETALHADA DE ALUNOS -->
      <div style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <h3 style="color:#fff; font-size:14px; margin-bottom:12px;">📋 Lista Completa de Alunos e Mensalidades</h3>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); color:var(--gold);">
                <th style="padding:8px;">Aluno</th>
                <th style="padding:8px;">Código</th>
                <th style="padding:8px;">Mensalidade</th>
                <th style="padding:8px;">Vencimento</th>
                <th style="padding:8px;">Status</th>
                <th style="padding:8px; text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody>
  `;

  lista.forEach(aluno => {
    const ehVIP = (
      aluno.isento === true ||
      aluno.isento === 'true' ||
      aluno.payload?.isento === true ||
      String(aluno.status_pagamento).toLowerCase() === 'isento' ||
      String(aluno.status_pagamento).toLowerCase() === 'vip'
    );

    const info = calcularDiasRestantesFin(
      aluno.data_expiracao || aluno.payload?.data_expiracao,
      aluno.dia_vencimento || aluno.payload?.dia_vencimento,
      ehVIP,
      aluno.status_pagamento
    );

    const valor = extrairPrecoAlunoFin(aluno);
    let statusBadge = `<span class="status-pill status-pago">PAGO</span>`;

    if (ehVIP) {
      statusBadge = `<span class="status-pill status-isento">ISENTO</span>`;
    } else if (info.dias <= 0 || String(aluno.status_pagamento).toLowerCase() === 'pendente') {
      statusBadge = `<span class="status-pill status-pendente">PENDENTE</span>`;
    }

    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
        <td style="padding:10px; font-weight:700; color:#fff;">${escapeHtml(aluno.clientName || aluno.nome)}</td>
        <td style="padding:10px; color:var(--muted);">@${escapeHtml(aluno.codigo)}</td>
        <td style="padding:10px; color:var(--gold); font-weight:700;">R$ ${valor.toFixed(2)}</td>
        <td style="padding:10px; color:#fff;">${info.dataFormatada}</td>
        <td style="padding:10px;">${statusBadge}</td>
        <td style="padding:10px; text-align:right;">
          <button onclick="carregarAluno('${aluno.codigo}'); switchTab('resumo');" style="background:none; border:1px solid var(--border); color:#fff; font-size:11px; padding:4px 8px; border-radius:4px; cursor:pointer;">
            ✏️ Editar
          </button>
          <button onclick="copiarMensagemCobranca('${aluno.codigo}')" style="background:none; border:1px solid var(--gold); color:var(--gold); font-size:11px; padding:4px 8px; border-radius:4px; cursor:pointer; margin-left:4px;">
            💬 Cobrar
          </button>
        </td>
      </tr>
    `;
  });

  html += `
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function copiarMensagemCobranca(codigo) {
  const lista = (typeof allStudentsList !== 'undefined' && Array.isArray(allStudentsList)) ? allStudentsList : [];
  const aluno = lista.find(a => a.codigo === codigo);
  if (!aluno) return showToast("Aluno não encontrado.", "error");

  const nome = aluno.clientName || aluno.nome || codigo;
  const valor = extrairPrecoAlunoFin(aluno);
  const info = calcularDiasRestantesFin(aluno.data_expiracao, aluno.dia_vencimento, aluno.isento, aluno.status_pagamento);

  const msg = 
`🏋️ *CONSULTORIA JHONATA PERSONAL — LEMBRETE DE RENOVAÇÃO*

Olá, *${nome}*! 

Seu ciclo atual de consultoria vence no dia *${info.dataFormatada}*.

💰 *Valor:* R$ ${valor.toFixed(2)}
🔑 *Chave PIX:* ${typeof CHAVE_PIX_DEFAULT !== 'undefined' ? CHAVE_PIX_DEFAULT : '5551990169026'}

Para manter o seu acesso liberado ao app e análise de treinos sem interrupção, favor efetuar o pagamento e enviar o comprovante por aqui! 💪🔥`;

  const fone = aluno.dadosAnamnese?.telefone ? aluno.dadosAnamnese.telefone.replace(/\D/g, '') : '';
  const urlWpp = fone ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  window.open(urlWpp, '_blank');
}

/* -------------------------------------------------------------
   TELA 2: CONTAS, DESPESAS FIXAS/VARIÁVEIS E LUCRO LÍQUIDO
------------------------------------------------------------- */

async function renderTelaContasELucros() {
  const container = document.getElementById('secContasLucros');
  if (!container) return;

  await carregarDadosFinanceirosServidor();

  let totalReceitaBruta = 0;
  const lista = (typeof allStudentsList !== 'undefined' && Array.isArray(allStudentsList)) ? allStudentsList : [];
  
  lista.forEach(a => {
    const ehIsento = a.isento === true || String(a.status_pagamento).toLowerCase() === 'isento';
    if (!ehIsento && String(a.status_pagamento).toLowerCase() !== 'pendente') {
      totalReceitaBruta += extrairPrecoAlunoFin(a);
    }
  });

  let totalEntradasAvulsas = 0;
  dadosFinanceirosGerais.entradasAvulsas.forEach(e => totalEntradasAvulsas += parsePrecoFin(e.valor));

  const receitaTotal = totalReceitaBruta + totalEntradasAvulsas;

  let totalFixas = 0;
  dadosFinanceirosGerais.despesasFixas.forEach(f => totalFixas += parsePrecoFin(f.valor));

  let totalVariaveis = 0;
  dadosFinanceirosGerais.despesasVariaveis.forEach(v => totalVariaveis += parsePrecoFin(v.valor));

  const totalDespesas = totalFixas + totalVariaveis;
  const lucroLiquido = receitaTotal - totalDespesas;
  const margemLucro = receitaTotal > 0 ? ((lucroLiquido / receitaTotal) * 100).toFixed(1) : 0;

  let html = `
    <div style="padding:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2 style="color:var(--gold); font-size:20px; margin:0;">💰 Balanço de Contas & Lucro Líquido</h2>
          <span style="color:var(--muted); font-size:12px;">Gestão de despesas fixas, custos operacionais e margem líquida.</span>
        </div>
        <button onclick="salvarDadosFinanceirosServidor()" class="action-btn" style="font-size:11px; padding:6px 12px;">
          💾 Salvar Alterações
        </button>
      </div>

      <!-- CARDS DE BALANÇO FINANCEIRO -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:#100305; border:1px solid var(--green); padding:14px; border-radius:10px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700;">RECEITA TOTAL (BRUTA)</span>
          <div style="font-size:22px; font-weight:800; color:var(--green); margin-top:4px;">R$ ${receitaTotal.toFixed(2)}</div>
          <span style="font-size:10px; color:var(--muted);">Alunos + Entradas Avulsas</span>
        </div>

        <div style="background:#100305; border:1px solid var(--accent); padding:14px; border-radius:10px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700;">DESPESAS TOTAIS</span>
          <div style="font-size:22px; font-weight:800; color:var(--accent); margin-top:4px;">R$ ${totalDespesas.toFixed(2)}</div>
          <span style="font-size:10px; color:var(--muted);">Fixas: R$ ${totalFixas.toFixed(2)} | Var: R$ ${totalVariaveis.toFixed(2)}</span>
        </div>

        <div style="background:#100305; border:1px solid var(--gold); padding:14px; border-radius:10px;">
          <span style="font-size:11px; color:var(--muted); font-weight:700;">LUCRO LÍQUIDO MENSAL</span>
          <div style="font-size:22px; font-weight:800; color:var(--gold); margin-top:4px;">R$ ${lucroLiquido.toFixed(2)}</div>
          <span style="font-size:10px; color:var(--green);">Margem Líquida: ${margemLucro}%</span>
        </div>
      </div>

      <!-- FORMULÁRIOS DE CONTAS E DESPESAS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
        
        <!-- DESPESAS FIXAS -->
        <div style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
          <h3 style="color:var(--gold); font-size:14px; margin-bottom:10px;">📌 Despesas Fixas (Servidores, Apps, Plataformas)</h3>
          <div id="listaDespesasFixas" style="margin-bottom:12px;"></div>
          <div style="display:flex; gap:6px;">
            <input type="text" id="novaFixaNome" placeholder="Nome (Ex: Render, OpenAI)" style="flex:2; padding:6px; font-size:12px;">
            <input type="number" id="novaFixaValor" placeholder="R$" style="flex:1; padding:6px; font-size:12px;">
            <button onclick="adicionarDespesaFixa()" class="action-btn-secondary" style="padding:6px 10px; font-size:12px;">+</button>
          </div>
        </div>

        <!-- DESPESAS VARIÁVEIS -->
        <div style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
          <h3 style="color:var(--accent); font-size:14px; margin-bottom:10px;">🛒 Despesas Variáveis / Anúncios / Equipamentos</h3>
          <div id="listaDespesasVariaveis" style="margin-bottom:12px;"></div>
          <div style="display:flex; gap:6px;">
            <input type="text" id="novaVariavelNome" placeholder="Descrição (Ex: Tráfego Pago)" style="flex:2; padding:6px; font-size:12px;">
            <input type="number" id="novaVariavelValor" placeholder="R$" style="flex:1; padding:6px; font-size:12px;">
            <button onclick="adicionarDespesaVariavel()" class="action-btn-secondary" style="padding:6px 10px; font-size:12px;">+</button>
          </div>
        </div>

        <!-- ENTRADAS AVULSAS -->
        <div style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
          <h3 style="color:var(--green); font-size:14px; margin-bottom:10px;">💵 Entradas Avulsas / Avulso / Venda Direta</h3>
          <div id="listaEntradasAvulsas" style="margin-bottom:12px;"></div>
          <div style="display:flex; gap:6px;">
            <input type="text" id="novaEntradaNome" placeholder="Descrição (Ex: Anamnese Avulsa)" style="flex:2; padding:6px; font-size:12px;">
            <input type="number" id="novaEntradaValor" placeholder="R$" style="flex:1; padding:6px; font-size:12px;">
            <button onclick="adicionarEntradaAvulsa()" class="action-btn-secondary" style="padding:6px 10px; font-size:12px;">+</button>
          </div>
        </div>

      </div>
    </div>
  `;

  container.innerHTML = html;
  renderItensDespesas();
}

function renderItensDespesas() {
  const boxFixas = document.getElementById('listaDespesasFixas');
  const boxVariaveis = document.getElementById('listaDespesasVariaveis');
  const boxEntradas = document.getElementById('listaEntradasAvulsas');

  if (boxFixas) {
    boxFixas.innerHTML = dadosFinanceirosGerais.despesasFixas.map((item, index) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0d0204; padding:6px 10px; border-radius:6px; margin-bottom:4px; font-size:12px;">
        <span style="color:#fff;">${escapeHtml(item.nome)}</span>
        <div>
          <b style="color:var(--accent); margin-right:8px;">R$ ${parsePrecoFin(item.valor).toFixed(2)}</b>
          <span onclick="removerDespesaFixa(${index})" style="color:var(--muted); cursor:pointer;">✕</span>
        </div>
      </div>
    `).join('') || '<small style="color:var(--muted);">Nenhuma despesa fixa cadastrada.</small>';
  }

  if (boxVariaveis) {
    boxVariaveis.innerHTML = dadosFinanceirosGerais.despesasVariaveis.map((item, index) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0d0204; padding:6px 10px; border-radius:6px; margin-bottom:4px; font-size:12px;">
        <span style="color:#fff;">${escapeHtml(item.nome)}</span>
        <div>
          <b style="color:var(--accent); margin-right:8px;">R$ ${parsePrecoFin(item.valor).toFixed(2)}</b>
          <span onclick="removerDespesaVariavel(${index})" style="color:var(--muted); cursor:pointer;">✕</span>
        </div>
      </div>
    `).join('') || '<small style="color:var(--muted);">Nenhuma despesa variável cadastrada.</small>';
  }

  if (boxEntradas) {
    boxEntradas.innerHTML = dadosFinanceirosGerais.entradasAvulsas.map((item, index) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0d0204; padding:6px 10px; border-radius:6px; margin-bottom:4px; font-size:12px;">
        <span style="color:#fff;">${escapeHtml(item.nome)}</span>
        <div>
          <b style="color:var(--green); margin-right:8px;">R$ ${parsePrecoFin(item.valor).toFixed(2)}</b>
          <span onclick="removerEntradaAvulsa(${index})" style="color:var(--muted); cursor:pointer;">✕</span>
        </div>
      </div>
    `).join('') || '<small style="color:var(--muted);">Nenhuma entrada avulsa cadastrada.</small>';
  }
}

function adicionarDespesaFixa() {
  const nome = document.getElementById('novaFixaNome').value.trim();
  const valor = parsePrecoFin(document.getElementById('novaFixaValor').value);
  if (!nome || valor <= 0) return showToast("Preencha o nome e o valor.", "error");

  dadosFinanceirosGerais.despesasFixas.push({ nome, valor });
  renderTelaContasELucros();
}

function removerDespesaFixa(index) {
  dadosFinanceirosGerais.despesasFixas.splice(index, 1);
  renderTelaContasELucros();
}

function adicionarDespesaVariavel() {
  const nome = document.getElementById('novaVariavelNome').value.trim();
  const valor = parsePrecoFin(document.getElementById('novaVariavelValor').value);
  if (!nome || valor <= 0) return showToast("Preencha o nome e o valor.", "error");

  dadosFinanceirosGerais.despesasVariaveis.push({ nome, valor });
  renderTelaContasELucros();
}

function removerDespesaVariavel(index) {
  dadosFinanceirosGerais.despesasVariaveis.splice(index, 1);
  renderTelaContasELucros();
}

function adicionarEntradaAvulsa() {
  const nome = document.getElementById('novaEntradaNome').value.trim();
  const valor = parsePrecoFin(document.getElementById('novaEntradaValor').value);
  if (!nome || valor <= 0) return showToast("Preencha o nome e o valor.", "error");

  dadosFinanceirosGerais.entradasAvulsas.push({ nome, valor });
  renderTelaContasELucros();
}

function removerEntradaAvulsa(index) {
  dadosFinanceirosGerais.entradasAvulsas.splice(index, 1);
  renderTelaContasELucros();
}
