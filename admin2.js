/* -------------------------------------------------------------
   ADMIN2.JS - MÓDULO FINANCEIRO, CONTAS, LUCROS E RELATÓRIOS
------------------------------------------------------------- */

let dadosFinanceirosGerais = {
  despesasFixas: [],
  despesasVariaveis: [],
  entradasAvulsas: [],
  metaFaturamento: 0
};

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

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  let receitaMensalAlunos = 0;
  let receitaAnualEstimada = 0;
  let totalPagantes = 0;
  let totalIsentos = 0;
  let totalPendentes = 0;
  let totalAtrasadosCriticos = 0;

  allStudentsList.forEach(aluno => {
    const ehIsento = (
      aluno.isento === true ||
      aluno.isento === 'true' ||
      aluno.payload?.isento === true ||
      String(aluno.status_pagamento).toLowerCase() === 'isento' ||
      String(aluno.status_pagamento).toLowerCase() === 'vip'
    );

    const infoVenc = calcularDiasRestantes(
      aluno.data_expiracao || aluno.payload?.data_expiracao,
      aluno.dia_vencimento || aluno.payload?.dia_vencimento,
      aluno.isento,
      aluno.status_pagamento
    );

    const valor = extrairPrecoAluno(aluno);

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

      <!-- BOTÃO DE ATALHO PARA COBRANÇA EM MASSA -->
      <div style="background:#0d0204; border:1px solid var(--border); padding:14px; border-radius:10px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b style="color:#fff; font-size:13px;">📲 Lembrete de Cobrança Rápida via WhatsApp</b>
          <div style="font-size:11px; color:var(--muted); margin-top:2px;">Gere mensagens formatadas de cobrança com chave PIX para os alunos com vencimento pendente.</div>
        </div>
        <button onclick="notificarAlunosVencidos()" class="action-btn" style="font-size:12px; padding:8px 16px;">
          💬 Enviar Lembrete ao Primeiro Pendente
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

  allStudentsList.forEach(aluno => {
    const ehVIP = (
      aluno.isento === true ||
      aluno.isento === 'true' ||
      aluno.payload?.isento === true ||
      String(aluno.status_pagamento).toLowerCase() === 'isento' ||
      String(aluno.status_pagamento).toLowerCase() === 'vip'
    );

    const info = calcularDiasRestantes(
      aluno.data_expiracao || aluno.payload?.data_expiracao,
      aluno.dia_vencimento || aluno.payload?.dia_vencimento,
      ehVIP,
      aluno.status_pagamento
    );

    const valor = extrairPrecoAluno(aluno);
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
  const aluno = allStudentsList.find(a => a.codigo === codigo);
  if (!aluno) return showToast("Aluno não encontrado.", "error");

  const nome = aluno.clientName || aluno.nome || codigo;
  const valor = extrairPrecoAluno(aluno);
  const info = calcularDiasRestantes(aluno.data_expiracao, aluno.dia_vencimento, aluno.isento, aluno.status_pagamento);

  const msg = 
`🏋️ *CONSULTORIA JHONATA PERSONAL — LEMBRETE DE RENOVATION*

Olá, *${nome}*! 

Seu ciclo atual de consultoria vence no dia *${info.dataFormatada}*.

💰 *Valor:* R$ ${valor.toFixed(2)}
🔑 *Chave PIX:* ${CHAVE_PIX_DEFAULT}

Para manter o seu acesso liberado ao app, envio de novas fichas e análise de treinos sem interrupção, favor efetuar o pagamento e enviar o comprovante por aqui! 💪🔥`;

  const fone = aluno.dadosAnamnese?.telefone ? aluno.dadosAnamnese.telefone.replace(/\D/g, '') : '';
  const urlWpp = fone ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  window.open(urlWpp, '_blank');
}

function notificarAlunosVencidos() {
  const pendente = allStudentsList.find(aluno => {
    const ehVIP = aluno.isento === true || String(aluno.status_pagamento).toLowerCase() === 'isento';
    if (ehVIP) return false;
    const info = calcularDiasRestantes(aluno.data_expiracao, aluno.dia_vencimento, aluno.isento, aluno.status_pagamento);
    return info.dias <= 0 || String(aluno.status_pagamento).toLowerCase() === 'pendente';
  });

  if (pendente) {
    copiarMensagemCobranca(pendente.codigo);
  } else {
    showToast("Nenhum aluno pendente encontrado!", "success");
  }
}

/* -------------------------------------------------------------
   TELA 2: CONTAS, DESPESAS FIXAS/VARIÁVEIS E LUCRO LÍQUIDO
------------------------------------------------------------- */

async function renderTelaContasELucros() {
  const container = document.getElementById('secContasLucros');
  if (!container) return;

  await carregarDadosFinanceirosServidor();

  let totalReceitaBruta = 0;
  allStudentsList.forEach(a => {
    const ehIsento = a.isento === true || String(a.status_pagamento).toLowerCase() === 'isento';
    if (!ehIsento && String(a.status_pagamento).toLowerCase() !== 'pendente') {
      totalReceitaBruta += extrairPrecoAluno(a);
    }
  });

  let totalEntradasAvulsas = 0;
  dadosFinanceirosGerais.entradasAvulsas.forEach(e => totalEntradasAvulsas += parsePreco(e.valor));

  const receitaTotal = totalReceitaBruta + totalEntradasAvulsas;

  let totalFixas = 0;
  dadosFinanceirosGerais.despesasFixas.forEach(f => totalFixas += parsePreco(f.valor));

  let totalVariaveis = 0;
  dadosFinanceirosGerais.despesasVariaveis.forEach(v => totalVariaveis += parsePreco(v.valor));

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
          <b style="color:var(--accent); margin-right:8px;">R$ ${parsePreco(item.valor).toFixed(2)}</b>
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
          <b style="color:var(--accent); margin-right:8px;">R$ ${parsePreco(item.valor).toFixed(2)}</b>
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
          <b style="color:var(--green); margin-right:8px;">R$ ${parsePreco(item.valor).toFixed(2)}</b>
          <span onclick="removerEntradaAvulsa(${index})" style="color:var(--muted); cursor:pointer;">✕</span>
        </div>
      </div>
    `).join('') || '<small style="color:var(--muted);">Nenhuma entrada avulsa cadastrada.</small>';
  }
}

function adicionarDespesaFixa() {
  const nome = document.getElementById('novaFixaNome').value.trim();
  const valor = parsePreco(document.getElementById('novaFixaValor').value);
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
  const valor = parsePreco(document.getElementById('novaVariavelValor').value);
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
  const valor = parsePreco(document.getElementById('novaEntradaValor').value);
  if (!nome || valor <= 0) return showToast("Preencha o nome e o valor.", "error");

  dadosFinanceirosGerais.entradasAvulsas.push({ nome, valor });
  renderTelaContasELucros();
}

function removerEntradaAvulsa(index) {
  dadosFinanceirosGerais.entradasAvulsas.splice(index, 1);
  renderTelaContasELucros();
}
