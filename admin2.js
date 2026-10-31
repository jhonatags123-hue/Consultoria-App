/* ====================================================== */
/* ADMIN2.JS - GESTÃO FINANCEIRA PESSOAL: CONTAS & LUCROS  */
/* ====================================================== */

/* CARREGA DADOS SALVOS DO LOCALSTORAGE */
function carregarDadosContasLucros() {
  const defaultData = {
    emp1_nome: "Personal Presencial", emp1_valor: 0, emp1_horas: 0,
    emp2_nome: "Emprego 2", emp2_valor: 0, emp2_horas: 0,
    emp3_nome: "Consultoria On-line", emp3_valor: 0, emp3_horas: 0,
    esposa_nome: "Renda Esposa", esposa_valor: 0,
    contas: [
      { nome: "Luz", valor: 150, diaVencimento: 10, paga: false },
      { nome: "Gasolina", valor: 300, diaVencimento: 5, paga: false }
    ]
  };

  try {
    const saved = localStorage.getItem('personal_contas_lucros');
    return saved ? JSON.parse(saved) : defaultData;
  } catch (e) {
    return defaultData;
  }
}

function salvarDadosContasLucros(dados) {
  localStorage.setItem('personal_contas_lucros', JSON.stringify(dados));
}

/* RENDERIZA A TELA DE CONTAS E LUCROS PESSOAIS */
function renderTelaContasELucros() {
  const container = document.getElementById('contasLucrosContent');
  if (!container) return;

  const dados = carregarDadosContasLucros();

  const emp1Val = parseFloat(dados.emp1_valor) || 0;
  const emp2Val = parseFloat(dados.emp2_valor) || 0;
  const emp3Val = parseFloat(dados.emp3_valor) || 0;
  const esposaVal = parseFloat(dados.esposa_valor) || 0;

  const emp1Horas = parseFloat(dados.emp1_horas) || 0;
  const emp2Horas = parseFloat(dados.emp2_horas) || 0;
  const emp3Horas = parseFloat(dados.emp3_horas) || 0;

  // CÁLCULOS DOS TOTAIS
  const totalArrecadacaoSua = emp1Val + emp2Val + emp3Val;
  const totalArrecadacaoGeral = totalArrecadacaoSua + esposaVal; // TOTAL DE ARRECADAÇÃO
  
  const totalHorasDia = emp1Horas + emp2Horas + emp3Horas;
  const totalHorasMes = totalHorasDia * 22; // ~22 dias úteis
  const valorPorHora = totalHorasMes > 0 ? (totalArrecadacaoSua / totalHorasMes) : 0;

  const totalGastosContas = dados.contas.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0); // TOTAL DE GASTOS
  const totalContasPagas = dados.contas.filter(c => c.paga).reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);
  const totalContasPendentes = totalGastosContas - totalContasPagas;
  const lucroLiquidoSobra = totalArrecadacaoGeral - totalGastosContas;

  container.innerHTML = `
    <!-- CARDS DOS TOTAIS DE ARRECADAÇÃO E GASTOS PESSOAIS -->
    <div class="fin-grid" style="margin-bottom:16px;">
      
      <!-- CARD 1: TOTAL DE ARRECADAÇÃO -->
      <div class="fin-card bruto" style="border-color:var(--green);">
        <small style="color:var(--muted); font-weight:800; font-size:11px; text-transform:uppercase;">💰 TOTAL DE ARRECADAÇÃO</small>
        <div class="fin-val" style="color:var(--green);">R$ ${totalArrecadacaoGeral.toFixed(2)}</div>
        <small style="color:var(--muted); font-size:11px; margin-top:4px; display:block;">
          Sua Renda: R$ ${totalArrecadacaoSua.toFixed(2)} | Esposa: R$ ${esposaVal.toFixed(2)}
        </small>
      </div>

      <!-- CARD 2: TOTAL DE GASTOS / CONTAS -->
      <div class="fin-card pendente" style="border-color:var(--accent);">
        <small style="color:var(--muted); font-weight:800; font-size:11px; text-transform:uppercase;">💸 TOTAL DE GASTOS (CONTAS)</small>
        <div class="fin-val" style="color:var(--accent);">R$ ${totalGastosContas.toFixed(2)}</div>
        <small style="color:var(--accent); font-size:11px; margin-top:4px; display:block;">
          Pagas: R$ ${totalContasPagas.toFixed(2)} | Pendentes: R$ ${totalContasPendentes.toFixed(2)}
        </small>
      </div>

      <!-- CARD 3: LUCRO LÍQUIDO SOBRANDO -->
      <div class="fin-card pago" style="border-color:var(--gold);">
        <small style="color:var(--muted); font-weight:800; font-size:11px; text-transform:uppercase;">👑 LUCRO LÍQUIDO LIVRE</small>
        <div class="fin-val" style="color:var(--gold);">R$ ${lucroLiquidoSobra.toFixed(2)}</div>
        <small style="color:var(--gold); font-size:11px; margin-top:4px; display:block;">Total Arrecadado - Total de Gastos</small>
      </div>

      <!-- CARD 4: VALOR DA HORA TRABALHADA -->
      <div class="fin-card novos" style="border-color:#3b82f6;">
        <small style="color:var(--muted); font-weight:800; font-size:11px; text-transform:uppercase;">⏱️ VALOR DA SUA HORA</small>
        <div class="fin-val" style="color:#60a5fa;">R$ ${valorPorHora.toFixed(2)}/h</div>
        <small style="color:var(--muted); font-size:11px; margin-top:4px; display:block;">Jornada: ${totalHorasDia}h/dia (~${totalHorasMes}h/mês)</small>
      </div>

    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
      
      <!-- 1. PAINEL DE FONTES DE RENDA -->
      <div style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <h3 style="color:var(--gold); font-size:14px; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:12px;">
          💼 MEUS EMPREGOS, CONSULTORIA & ESPOSA
        </h3>

        <div style="display:flex; flex-direction:column; gap:10px;">
          
          <!-- EMPREGO 1 -->
          <div style="background:#0d0204; border:1px solid var(--border); padding:10px; border-radius:8px;">
            <b style="color:#fff; font-size:12px;">EMPREGO 1:</b>
            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:6px; margin-top:6px;">
              <input type="text" id="emp1_nome" value="${escapeHtml(dados.emp1_nome)}" placeholder="Nome do emprego">
              <input type="number" id="emp1_valor" value="${dados.emp1_valor || ''}" placeholder="Ganho R$">
              <input type="number" id="emp1_horas" value="${dados.emp1_horas || ''}" placeholder="Horas/dia">
            </div>
          </div>

          <!-- EMPREGO 2 -->
          <div style="background:#0d0204; border:1px solid var(--border); padding:10px; border-radius:8px;">
            <b style="color:#fff; font-size:12px;">EMPREGO 2:</b>
            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:6px; margin-top:6px;">
              <input type="text" id="emp2_nome" value="${escapeHtml(dados.emp2_nome)}" placeholder="Nome do emprego">
              <input type="number" id="emp2_valor" value="${dados.emp2_valor || ''}" placeholder="Ganho R$">
              <input type="number" id="emp2_horas" value="${dados.emp2_horas || ''}" placeholder="Horas/dia">
            </div>
          </div>

          <!-- EMPREGO 3: CONSULTORIA -->
          <div style="background:#05140b; border:1px solid var(--green); padding:10px; border-radius:8px;">
            <b style="color:var(--green); font-size:12px;">EMPREGO 3: CONSULTORIA ON-LINE</b>
            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:6px; margin-top:6px;">
              <input type="text" id="emp3_nome" value="${escapeHtml(dados.emp3_nome || 'Consultoria On-line')}" placeholder="Nome">
              <input type="number" id="emp3_valor" value="${dados.emp3_valor || ''}" placeholder="Ganho R$">
              <input type="number" id="emp3_horas" value="${dados.emp3_horas || ''}" placeholder="Horas/dia">
            </div>
          </div>

          <!-- RENDA DA ESPOSA -->
          <div style="background:#15050e; border:1px solid var(--purple); padding:10px; border-radius:8px;">
            <b style="color:var(--purple); font-size:12px;">👑 RENDA DA ESPOSA:</b>
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:6px; margin-top:6px;">
              <input type="text" id="esposa_nome" value="${escapeHtml(dados.esposa_nome || 'Renda Esposa')}" placeholder="Descrição">
              <input type="number" id="esposa_valor" value="${dados.esposa_valor || ''}" placeholder="Ganho R$">
            </div>
          </div>

          <button class="btn btn-gold btn-md full-width" onclick="salvarEmpregosEHoras()">💾 SALVAR RENDAS E RECALCULAR</button>
        </div>
      </div>

      <!-- 2. GERENCIADOR DE CONTAS E GASTOS PESSOAIS -->
      <div style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <h3 style="color:var(--accent); font-size:14px; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:12px;">
          🧾 GERENCIADOR DE CONTAS & GASTOS
        </h3>

        <!-- FORMULÁRIO PARA ADICIONAR NOVA CONTA -->
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr auto; gap:6px; margin-bottom:12px;">
          <input type="text" id="novaContaNome" placeholder="Conta (Luz, Gasolina...)">
          <input type="number" id="novaContaValor" placeholder="Valor R$">
          <input type="number" id="novaContaDia" placeholder="Dia Venc." min="1" max="31">
          <button class="btn btn-wpp sm" onclick="adicionarNovaConta()">➕ Adicionar</button>
        </div>

        <!-- LISTA DE CONTAS COM DIA DE VENCIMENTO -->
        <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
          ${
            dados.contas.length === 0 
            ? '<small style="color:var(--muted)">Nenhuma conta cadastrada ainda.</small>'
            : dados.contas.map((conta, index) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#0d0204; border:1px solid ${conta.paga ? 'var(--green)' : 'var(--border)'}; padding:8px 10px; border-radius:8px; font-size:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <input type="checkbox" ${conta.paga ? 'checked' : ''} onchange="alternarStatusConta(${index})" style="width:16px; height:16px; cursor:pointer;">
                  <div>
                    <span style="${conta.paga ? 'text-decoration:line-through; color:var(--muted);' : 'color:#fff; font-weight:700;'}">
                      ${escapeHtml(conta.nome)}
                    </span>
                    ${conta.diaVencimento ? `<br><small style="color:var(--gold); font-size:10px;">📅 Vencimento dia ${conta.diaVencimento}</small>` : ''}
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="color:${conta.paga ? 'var(--green)' : 'var(--accent)'}; font-weight:800;">R$ ${parseFloat(conta.valor).toFixed(2)}</span>
                  <button onclick="removerConta(${index})" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size:14px; font-weight:800;">✕</button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>

    </div>
  `;
}

function salvarEmpregosEHoras() {
  const dados = carregarDadosContasLucros();

  dados.emp1_nome = document.getElementById('emp1_nome').value.trim() || "Emprego 1";
  dados.emp1_valor = parsePreco(document.getElementById('emp1_valor').value);
  dados.emp1_horas = parseFloat(document.getElementById('emp1_horas').value) || 0;

  dados.emp2_nome = document.getElementById('emp2_nome').value.trim() || "Emprego 2";
  dados.emp2_valor = parsePreco(document.getElementById('emp2_valor').value);
  dados.emp2_horas = parseFloat(document.getElementById('emp2_horas').value) || 0;

  dados.emp3_nome = document.getElementById('emp3_nome').value.trim() || "Consultoria On-line";
  dados.emp3_valor = parsePreco(document.getElementById('emp3_valor').value);
  dados.emp3_horas = parseFloat(document.getElementById('emp3_horas').value) || 0;

  dados.esposa_nome = document.getElementById('esposa_nome').value.trim() || "Renda Esposa";
  dados.esposa_valor = parsePreco(document.getElementById('esposa_valor').value);

  salvarDadosContasLucros(dados);
  renderTelaContasELucros();
  if (typeof showToast === 'function') showToast("Rendas e horas salvas com sucesso!", "success");
}

function adicionarNovaConta() {
  const nome = document.getElementById('novaContaNome').value.trim();
  const valor = parsePreco(document.getElementById('novaContaValor').value);
  const dia = parseInt(document.getElementById('novaContaDia').value) || null;

  if (!nome || valor <= 0) {
    if (typeof showToast === 'function') showToast("Preencha o nome e o valor da conta corretamente.", "error");
    return;
  }

  const dados = carregarDadosContasLucros();
  dados.contas.push({ nome: nome, valor: valor, diaVencimento: dia, paga: false });

  salvarDadosContasLucros(dados);
  renderTelaContasELucros();
  if (typeof showToast === 'function') showToast("Conta adicionada com sucesso!", "success");
}

function alternarStatusConta(index) {
  const dados = carregarDadosContasLucros();
  if (dados.contas[index]) {
    dados.contas[index].paga = !dados.contas[index].paga;
    salvarDadosContasLucros(dados);
    renderTelaContasELucros();
  }
}

function removerConta(index) {
  const dados = carregarDadosContasLucros();
  if (dados.contas[index]) {
    dados.contas.splice(index, 1);
    salvarDadosContasLucros(dados);
    renderTelaContasELucros();
    if (typeof showToast === 'function') showToast("Conta removida.", "info");
  }
}
