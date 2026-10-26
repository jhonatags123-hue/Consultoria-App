const BACKEND_URL = "https://consultoria-backend-kbqi.onrender.com";
let currentStudentCode = "";
let currentStudentData = null;
let lastGeneratedPassword = "";
let allStudentsList = [];
let chartInstance = null;
let activeDietAbaIndex = 0;
let gifsDatabase = [];

const TUTORIAL_IOS = "https://youtube.com/shorts/AC3qVx1mglc";
const TUTORIAL_ANDROID = "https://youtube.com/shorts/Px4gUAlgR7w";
const CHAVE_PIX_DEFAULT = "5551990169026";

function sanitizeExKey(nome) {
  if (!nome) return "ex";
  return nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

function showToast(mensagem, tipo = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  
  let icone = 'ℹ';
  if (tipo === 'success') icone = '✅';
  if (tipo === 'error') icone = '❌';

  toast.innerHTML = `<span>${icone}</span> <div>${escapeHtml(mensagem)}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function authHeaders() {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('adminToken') || '';
  return { 
    'Content-Type': 'application/json', 
    'Authorization': `Bearer ${token}` 
  };
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function togglePainelLinksAdmin() {
  const conteudo = document.getElementById('conteudoLinksAdmin');
  const seta = document.getElementById('setaPainelLinks');
  if (!conteudo) return;

  const estaOculto = conteudo.classList.toggle('hidden');
  if (seta) seta.textContent = estaOculto ? '▼' : '▲';
}

function copiarLinkVenda(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast("Link copiado para a área de transferência!", "success");
  }).catch(() => {
    showToast("Erro ao copiar o link.", "error");
  });
}

function abrirPastaDriveAluno() {
  const pastaDriveUrl = "https://drive.google.com/drive/folders/1j-fRZTrP852K10fxfSbaf_b_vsOdi2hl";
  window.open(pastaDriveUrl, '_blank');
}

async function alternarSolicitacaoFeedback(status) {
  if (!currentStudentData) return;
  currentStudentData.solicitarFeedback = status;
  await salvarAlteracoes();
  showToast(status ? "Sinal vermelho de feedback ativado no app!" : "Alerta de feedback removido.", "info");
}

function carregarGifsAdmin() {
  fetch(`${BACKEND_URL}/api/exercicios/gifs`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
      gifsDatabase = data || [];
      renderGifsAdmin(gifsDatabase);
    })
    .catch(() => {
      document.getElementById('gifGalleryList').innerHTML = `<div style="color:var(--accent); font-size:12px; grid-column: 1/-1;">Não foi possível carregar a lista de GIFs.</div>`;
    });
}

function renderGifsAdmin(lista) {
  const gallery = document.getElementById('gifGalleryList');
  gallery.innerHTML = "";
  if (!lista || lista.length === 0) {
    gallery.innerHTML = `<div style="color:var(--muted); font-size:12px; grid-column: 1/-1;">Nenhum GIF encontrado.</div>`;
    return;
  }

  lista.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gif-card';
    card.innerHTML = `
      <img src="${item.url}" alt="${escapeHtml(item.nome)}" loading="lazy">
      <span>${escapeHtml(item.nome)}</span>
    `;
    gallery.appendChild(card);
  });
}

function filtrarGifsAdmin() {
  const termo = document.getElementById('searchGifInput').value.toLowerCase();
  const filtrados = gifsDatabase.filter(g => g.nome.toLowerCase().includes(termo));
  renderGifsAdmin(filtrados);
}

function buscarGifExercicio(nomeEx) {
  if (!nomeEx || !gifsDatabase.length) return null;
  const key = sanitizeExKey(nomeEx);
  const ex = gifsDatabase.find(g => sanitizeExKey(g.nome) === key || key.includes(sanitizeExKey(g.nome)) || sanitizeExKey(g.nome).includes(key));
  return ex ? ex.url : null;
}

function atualizarCampoNotasMemoria() {
  if (currentStudentData) {
    currentStudentData.notas_treinador = document.getElementById('editNotasTreinador').value.trim();
  }
}

async function salvarNotasTreinadorSozinhas() {
  atualizarCampoNotasMemoria();
  if (!currentStudentCode) return showToast("Selecione um aluno primeiro.", "error");
  await salvarAlteracoes();
  showToast("Bloco de notas do treinador salvo!", "success");
}

function calcularDiasRestantes(dataExpiracaoStr, diaVencimentoFallback = 7) {
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

  return {
    dias: diffDias,
    dataFormatada: `${diaFmt}/${mesFmt}/${anoFmt}`
  };
}

function lidarEdicaoTreino() {
  atualizarPreviewAoVivo();
  if (currentStudentCode) {
    const val = document.getElementById('liveWorkoutText').value;
    localStorage.setItem(`draft_workout_${currentStudentCode}`, val);
  }
}

function lidarEdicaoDieta() {
  atualizarPreviewDietaAoVivo();
  if (currentStudentCode) {
    const val = document.getElementById('dietTextarea').value;
    localStorage.setItem(`draft_diet_${currentStudentCode}`, val);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${BACKEND_URL}/ping`, { cache: 'no-cache' }).catch(() => {});

  const token = localStorage.getItem('admin_token') || localStorage.getItem('adminToken');
  if (token) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    fetchAlunos();
    carregarGifsAdmin();
  }
});

async function loginAdmin() {
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value.trim();
  const errorDiv = document.getElementById('loginError');
  const btn = document.getElementById('btnLoginAdmin');

  errorDiv.style.display = 'none';
  btn.textContent = "VALIDANDO...";
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache: 'no-cache',
      body: JSON.stringify({ user, pass })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('adminToken', data.token);
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('adminApp').classList.remove('hidden');
      showToast("Login realizado com sucesso!", "success");
      fetchAlunos();
      carregarGifsAdmin();
    } else {
      errorDiv.textContent = "❌ " + (data.error || "Acesso negado.");
      errorDiv.style.display = 'block';
    }
  } catch(e) { 
    errorDiv.textContent = "❌ Erro ao conectar ao servidor.";
    errorDiv.style.display = 'block';
  } finally {
    btn.textContent = "ENTRAR NO PAINEL";
    btn.disabled = false;
  }
}

function logoutAdmin() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('adminToken');
  location.reload();
}

async function fetchAlunos() {
  const container = document.getElementById('alunosList');
  container.innerHTML = "Carregando...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/alunos/listar`, {
      headers: authHeaders(),
      cache: 'no-cache'
    });
    if (!res.ok) { logoutAdmin(); return; }
    allStudentsList = await res.json();
    renderStudentsList(allStudentsList);
  } catch(e) { 
    container.innerHTML = "<small style='color:var(--accent)'>Erro de comunicação.</small>";
    showToast("Erro de comunicação com o servidor.", "error");
  }
}

function alunoTemFeedbackPendente(aluno) {
  if (aluno.solicitarFeedback === true) return true;
  const feedbacks = aluno.feedbacks || [];
  if (feedbacks.length === 0) return false;
  const ultimaMsg = feedbacks[feedbacks.length - 1];
  return ultimaMsg && ultimaMsg.autor === "ALUNO";
}

function renderStudentsList(list) {
  const container = document.getElementById('alunosList');
  container.innerHTML = "";
  if (!list || list.length === 0) {
    container.innerHTML = "<small style='color:var(--muted); font-size:12px;'>Nenhum aluno encontrado.</small>";
    return;
  }

  list.forEach((aluno, i) => {
    const infoCalculada = calcularDiasRestantes(aluno.data_expiracao, aluno.dia_vencimento);
    let statusClass = "status-pago";
    let statusText = aluno.status_pagamento || "pago";

    if (aluno.isento === true || statusText === 'isento') {
      statusClass = "status-isento";
      statusText = "ISENTO";
    } else if (statusText === 'pendente' || infoCalculada.dias <= 0) {
      statusClass = "status-pendente";
    } else if (infoCalculada.dias <= 5) {
      statusClass = "status-alerta";
    }

    const temPendente = alunoTemFeedbackPendente(aluno);
    const badgePendenteHtml = temPendente ? `<span class="feedback-badge" style="margin-left:4px;">💬 FEEDBACK</span>` : '';

    const div = document.createElement('div');
    div.className = `student-item ${aluno.codigo === currentStudentCode || (i===0 && !currentStudentCode) ? 'active' : ''}`;
    div.innerHTML = `
      <div>
        <b>${escapeHtml(aluno.nome)}</b> ${badgePendenteHtml}<br>
        <small style="color:var(--muted)">@${escapeHtml(aluno.codigo)}</small>
      </div>
      <div style="text-align:right;">
        <span class="status-pill ${statusClass}">${escapeHtml(statusText.toUpperCase())}</span>
        <div style="font-size:10px; color:var(--muted); margin-top:3px;">${(aluno.isento === true || statusText === 'isento') ? 'Livre' : (infoCalculada.dias <= 0 ? 'Vencido' : infoCalculada.dias + 'd restantes')}</div>
      </div>
    `;
    div.onclick = () => {
      document.querySelectorAll('.student-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      carregarAluno(aluno.codigo);
    };
    container.appendChild(div);
  });

  if (list.length > 0 && !currentStudentCode) carregarAluno(list[0].codigo);
}

function filterStudents() {
  const term = document.getElementById('searchStudent').value.toLowerCase();
  const filtered = allStudentsList.filter(a => (a.nome || '').toLowerCase().includes(term) || (a.codigo || '').toLowerCase().includes(term));
  renderStudentsList(filtered);
}

async function carregarAluno(code) {
  currentStudentCode = code;

  try {
    const res = await fetch(`${BACKEND_URL}/api/aluno/${code}`, {
      headers: authHeaders(),
      cache: 'no-cache'
    });
    currentStudentData = await res.json();

    document.getElementById('studentName').textContent = currentStudentData.clientName || code;
    document.getElementById('studentCodeDisplay').textContent = `@${code}`;
    document.getElementById('studentPassDisplay').textContent = `🔒 Senha protegida`;

    const infoCalculada = calcularDiasRestantes(currentStudentData.data_expiracao, currentStudentData.dia_vencimento);
    document.getElementById('studentVencimentoDisplay').textContent = `📅 Vencimento: ${infoCalculada.dataFormatada}`;

    const stPill = document.getElementById('studentStatusPill');
    const daysPill = document.getElementById('studentDaysPill');
    const stVal = currentStudentData.status_pagamento || 'pago';

    if (currentStudentData.isento === true || stVal === 'isento') {
      stPill.className = "status-pill status-isento";
      stPill.textContent = "ISENTO";
      daysPill.className = "status-pill status-isento";
      daysPill.textContent = "ACESSO LIVRE";
    } else if (stVal === 'pendente' || infoCalculada.dias <= 0) {
      stPill.className = "status-pill status-pendente";
      stPill.textContent = "PENDENTE";
      daysPill.className = "status-pill status-pendente";
      daysPill.textContent = infoCalculada.dias <= 0 ? `VENCIDO` : `PENDENTE`;
    } else {
      stPill.className = "status-pill status-pago";
      stPill.textContent = "PAGO";
      daysPill.className = "status-pill status-pago";
      daysPill.textContent = `${infoCalculada.dias} DIAS RESTANTES`;
    }

    const toggleFeedback = document.getElementById('adminSolicitarFeedbackToggle');
    if (toggleFeedback) toggleFeedback.checked = currentStudentData.solicitarFeedback === true;

    const temFeedback = alunoTemFeedbackPendente(currentStudentData);
    const tabBadge = document.getElementById('tabFeedbackBadge');
    if (temFeedback) tabBadge.classList.remove('hidden');
    else tabBadge.classList.add('hidden');

    document.getElementById('editName').value = currentStudentData.clientName || '';
    document.getElementById('editStatus').value = stVal;
    document.getElementById('editIsentoCheckbox').checked = currentStudentData.isento === true;
    document.getElementById('editPassword').value = '';
    document.getElementById('editDiaVencimento').value = currentStudentData.dia_vencimento || 7;
    document.getElementById('editEvolucaoCarga').value = currentStudentData.evolucao_carga_pct || '';
    document.getElementById('editSemanasRotacao').value = currentStudentData.semanas_rotacao || 5;

    document.getElementById('editDataVigencia').value = currentStudentData.data_vigencia || '';

    // Módulos e Permissões
    document.getElementById('editLiberarDieta').checked = currentStudentData.liberarDieta !== false && !currentStudentData.apenasTreino;
    document.getElementById('editLiberarErgogenicos').checked = currentStudentData.liberarErgogenicos === true;

    const pTecnicas = (currentStudentData.pode_alterar_tecnica !== undefined) ? currentStudentData.pode_alterar_tecnica : currentStudentData.permitirTecnicas;
    document.getElementById('editPermitirTecnicas').checked = pTecnicas === true;

    document.getElementById('editTrainerGuidelines').value = currentStudentData.trainer_guidelines || currentStudentData.diretrizes_treinador || '';
    document.getElementById('editCardioGuidelines').value = currentStudentData.cardio_guidelines || currentStudentData.prescricao_cardio || '';
    
    document.getElementById('editNotasTreinador').value = currentStudentData.notas_treinador || '';

    carregarCamposCorridaAdmin(currentStudentData.prescricao_corrida || {});

    renderResumoVisaoGeral();
    renderIncomodosAluno();
    renderAnamneseDetails();
    renderAdminFeedbackHistory();
    carregarTreinoNoEditorAoVivo();
    loadDietView();
    renderCorridaAdmin();
  } catch(e) { 
    showToast("Erro ao carregar dados do aluno.", "error"); 
  }
}

function renderIncomodosAluno() {
  const list = document.getElementById('incomodosList');
  const sessoes = (currentStudentData && currentStudentData.historico_sessoes) || [];
  
  if (sessoes.length === 0) {
    list.innerHTML = `<span style="color:var(--muted)">Nenhuma sessão de treino finalizada pelo aluno ainda.</span>`;
    return;
  }

  const ultimaSessao = sessoes[sessoes.length - 1];
  const obs = ultimaSessao.observacoes || [];
  const minGasto = ultimaSessao.duracaoMinutos || 0;

  let html = `<div style="margin-bottom:6px;">⏱️ <b>Duração do Último Treino:</b> <span style="color:var(--gold); font-weight:800;">${minGasto} minutos</span></div>`;

  if (obs.length === 0) {
    html += `<span style="color:var(--muted)">O aluno não digitou observações ou dores no último treino.</span>`;
  } else {
    html += `<b>Relatos e Incômodos:</b><ul style="margin-left:18px; margin-top:4px;">`;
    obs.forEach(o => {
      html += `<li style="color:#ff6b7f;">${escapeHtml(o)}</li>`;
    });
    html += `</ul>`;
  }

  list.innerHTML = html;
}

async function analisarIncomodosIA() {
  if (!currentStudentData) return showToast("Selecione um aluno primeiro.", "error");

  const sessoes = currentStudentData.historico_sessoes || [];
  const ultimasObs = sessoes.length > 0 ? (sessoes[sessoes.length - 1].observacoes || []) : [];

  const box = document.getElementById('resumoIncomodosIA');
  box.classList.remove('hidden');
  box.innerHTML = "<i>Gerando análise de incômodos e dores via IA...</i>";

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/analisar-incomodos-ia`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        nomeAluno: currentStudentData.clientName || currentStudentCode,
        observacoes: ultimasObs,
        notasTreinador: currentStudentData.notas_treinador || ""
      })
    });

    const data = await res.json();
    box.innerHTML = `<b>🤖 Análise da IA:</b><br>${escapeHtml(data.resumo || 'Sem recomendações no momento.').replace(/\n/g, '<br>')}`;
  } catch(e) {
    box.innerHTML = "Erro ao conectar com a IA.";
  }
}

function renderResumoVisaoGeral() {
  const container = document.getElementById('summaryOverviewContainer');
  container.innerHTML = "";

  if (!currentStudentData) {
    container.innerHTML = "<p style='color:var(--muted); font-size:13px;'>Nenhum aluno selecionado.</p>";
    return;
  }

  let htmlContent = `<div class="section-subtitle">🏋 TREINOS CADASTRADOS & EVOLUÇÃO DE CARGAS</div>`;
  const days = currentStudentData.days || [];
  const weeklyLogs = currentStudentData.weekly_logs || {};
  const dailyLogs = currentStudentData.logs || {};

  if (days.length === 0) {
    htmlContent += `<p style="color:var(--muted); font-size:12px; margin-bottom:14px;">Nenhum treino cadastrado.</p>`;
  } else {
    days.forEach((day, dayIdx) => {
      const numEx = (day.exercicios || []).length;
      htmlContent += `
        <div class="day-accordion-header" onclick="toggleResumoAccordion('resumo_day_${dayIdx}')">
          <div>
            <b>🏋️ ${escapeHtml(day.title)}</b>
            <div style="font-size:11px; color:var(--muted); margin-top:2px;">${numEx} exercícios cadastrados</div>
          </div>
          <span style="color:var(--gold); font-size:12px; font-weight:700;">Ver Detalhes ▾</span>
        </div>
        <div id="resumo_day_${dayIdx}" class="hidden" style="background:#0d0204; border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:12px;">
      `;

      (day.exercicios || []).forEach((ex, exIdx) => {
        const exKey = sanitizeExKey(ex.nome);
        const keyDirect = `${dayIdx}_${exIdx}`;
        const historico = weeklyLogs[exKey] || weeklyLogs[keyDirect] || [];
        let cargaRecenteTexto = "Sem carga salva";

        if (historico.length > 0) {
          const ult = historico[historico.length - 1];
          cargaRecenteTexto = `${ult.cargaMax || ult.carga || 0}kg (${ult.repsMed || ult.reps || '-'} reps)`;
        } else {
          let maxC = 0;
          let totalR = 0;
          let countS = 0;
          for (let s = 1; s <= 5; s++) {
            const c = parseFloat(dailyLogs[`log_c_${exKey}_s${s}`] || dailyLogs[`log_c_${dayIdx}_${exIdx}_s${s}`]);
            const r = parseFloat(dailyLogs[`log_r_${exKey}_s${s}`] || dailyLogs[`log_r_${dayIdx}_${exIdx}_s${s}`]);
            if (!isNaN(c) && c > maxC) maxC = c;
            if (!isNaN(r)) { totalR += r; countS++; }
          }
          if (maxC > 0) {
            const rMed = countS > 0 ? Math.round(totalR / countS) : '-';
            cargaRecenteTexto = `${maxC}kg (${rMed} reps)`;
          }
        }

        const hasGif = ex.gifUrl ? '📹 GIF' : '';

        htmlContent += `
          <div class="ex-clickable" onclick="verEvolucaoSemanal('${escapeHtml(ex.nome)}', '${escapeHtml(ex.series)}', '${escapeHtml(ex.reps)}')">
            <span>• <b>${escapeHtml(ex.nome)}</b> <small style="color:var(--green);">${hasGif}</small></span>
            <span style='color:var(--gold); font-size:11px; font-weight:700;'>${escapeHtml(ex.series)} (${escapeHtml(ex.reps)}) | 📈 ${cargaRecenteTexto}</span>
          </div>
        `;
      });

      htmlContent += `</div>`;
    });
  }

  htmlContent += `<div class="section-subtitle">🥗 PLANO ALIMENTAR / DIETA</div>`;
  const refeicoes = currentStudentData.refeicoes || [];

  if (refeicoes.length === 0 || currentStudentData.liberarDieta === false) {
    htmlContent += `<p style="color:var(--muted); font-size:12px; margin-bottom:14px;">${currentStudentData.liberarDieta === false ? 'Aba Dieta bloqueada para o aluno.' : 'Nenhuma dieta cadastrada.'}</p>`;
  } else {
    refeicoes.forEach((ref, refIdx) => {
      htmlContent += `
        <div class="day-accordion-header" onclick="toggleResumoAccordion('resumo_ref_${refIdx}')">
          <div>
            <b style="color:var(--gold)">🍽 ${escapeHtml(ref.titulo || 'Refeição')}</b>
          </div>
          <span style="color:var(--gold); font-size:12px; font-weight:700;">Ver Alimentos ▾</span>
        </div>
        <div id="resumo_ref_${refIdx}" class="hidden" style="background:#0d0204; border:1px solid var(--border); border-radius:10px; padding:12px; margin-bottom:12px; font-size:12px; color:#fff; white-space:pre-line;">
          ${escapeHtml(ref.alimentos || 'Nenhum alimento cadastrado.')}
        </div>
      `;
    });
  }

  htmlContent += `<div class="section-subtitle">🏃 AERÓBICO & CORRIDA</div>`;
  const cardioGuidelines = currentStudentData.cardio_guidelines || currentStudentData.prescricao_cardio || '';
  const prescricao = currentStudentData.prescricao_corrida || {};

  htmlContent += `
    <div style="background:#0d0204; border:1px solid var(--border); border-left:3px solid var(--blue); padding:12px; border-radius:10px; margin-bottom:12px;">
      <b style="color:var(--blue); font-size:12px;">📌 Orientação Geral de Cardio:</b>
      <p style="font-size:12px; color:#fff; margin-top:4px;">${escapeHtml(cardioGuidelines || 'Sem orientação cadastrada.')}</p>
    </div>
  `;

  const diasNomes = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };
  let temSemana = false;

  let semanaHtml = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">`;
  Object.keys(diasNomes).forEach(d => {
    const p = prescricao[d];
    if (p && (p.km || p.min || p.desc)) {
      temSemana = true;
      semanaHtml += `
        <div style="background:#100305; border:1px solid var(--border); padding:8px; border-radius:8px; font-size:11px;">
          <b style="color:var(--blue);">${diasNomes[d]}:</b> 
          ${p.km ? p.km + 'km' : ''} ${p.min ? '| ' + p.min : ''} ${p.intensidade ? '(' + p.intensidade + ')' : ''}<br>
          <span style="color:var(--muted);">${escapeHtml(p.desc || '')}</span>
        </div>
      `;
    }
  });
  semanaHtml += `</div>`;

  if (temSemana) htmlContent += semanaHtml;

  container.innerHTML = htmlContent;
}

function toggleResumoAccordion(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.toggle('hidden');
}

function carregarCamposCorridaAdmin(prescricao) {
  const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  dias.forEach(d => {
    const item = prescricao[d] || {};
    if (typeof item === 'object') {
      if (document.getElementById(`run_km_${d}`)) document.getElementById(`run_km_${d}`).value = item.km || '';
      if (document.getElementById(`run_min_${d}`)) document.getElementById(`run_min_${d}`).value = item.min || '';
      if (document.getElementById(`run_int_${d}`)) document.getElementById(`run_int_${d}`).value = item.intensidade || '';
      if (document.getElementById(`run_desc_${d}`)) document.getElementById(`run_desc_${d}`).value = item.desc || '';
    } else {
      if (document.getElementById(`run_desc_${d}`)) document.getElementById(`run_desc_${d}`).value = item;
    }
  });
}

async function gerarSemanaCardioIA() {
  if (!currentStudentCode) return showToast("Selecione um aluno primeiro.", "error");

  const prompt = document.getElementById('aiCardioPromptAdmin').value.trim();
  const btn = document.getElementById('btnGerarCardioIA');
  const txtOriginal = btn.textContent;

  btn.textContent = "⏳ IA Montando...";
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/chat-ia`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        mensagem: `Você é um preparador físico especializado em cardio/corrida.
Monte uma semana de cardio dividida por dias (seg, ter, qua, qui, sex, sab, dom) e adicione uma orientação geral de prescrição de cardio.
Prompt do treinador: "${prompt || 'Cardio equilibrado focado no objetivo do aluno'}".
Retorne ESTRITAMENTE um JSON puro no formato:
{
  "cardio_guidelines": "Orientação geral de cardio",
  "semana": {
    "seg": {"km": "5.0", "min": "30", "intensidade": "Moderada", "desc": "1km leve + 3km moderado + 1km leve"},
    "ter": {"km": "0", "min": "20", "intensidade": "Leve", "desc": "Bike regenerativa"},
    "qua": {"km": "6.0", "min": "35", "intensidade": "Tiros", "desc": "10x400m forte com 1min pausa"},
    "qui": {"km": "0", "min": "0", "intensidade": "OFF", "desc": "Descanso Total"},
    "sex": {"km": "4.0", "min": "25", "intensidade": "Ritmo", "desc": "Pace constante"},
    "sab": {"km": "8.0", "min": "50", "intensidade": "Longão Z2", "desc": "Manter ritmo confortável"},
    "dom": {"km": "0", "min": "0", "intensidade": "OFF", "desc": "Descanso"}
  }
}`,
        contexto: currentStudentData || {},
        origem: "ADMIN"
      })
    });

    const data = await res.json();
    if (res.ok && data.resposta) {
      let jsonClean = data.resposta.replace(/```json/g, '').replace(/```/g, '').trim();
      const resCardio = JSON.parse(jsonClean);

      if (resCardio.cardio_guidelines) {
        document.getElementById('editCardioGuidelines').value = resCardio.cardio_guidelines;
      }

      const semana = resCardio.semana || resCardio;
      const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
      dias.forEach(d => {
        if (semana[d]) {
          if (document.getElementById(`run_km_${d}`)) document.getElementById(`run_km_${d}`).value = semana[d].km || '';
          if (document.getElementById(`run_min_${d}`)) document.getElementById(`run_min_${d}`).value = semana[d].min || '';
          if (document.getElementById(`run_int_${d}`)) document.getElementById(`run_int_${d}`).value = semana[d].intensidade || '';
          if (document.getElementById(`run_desc_${d}`)) document.getElementById(`run_desc_${d}`).value = semana[d].desc || '';
        }
      });

      showToast("Cardio e Prescrição gerados pela IA!", "success");
    } else {
      showToast("Erro ao processar resposta da IA.", "error");
    }
  } catch (e) {
    showToast("Erro ao conectar com a IA de Cardio.", "error");
  } finally {
    btn.textContent = txtOriginal;
    btn.disabled = false;
  }
}

function salvarPrescricaoCorridaSemanalAdmin() {
  if (!currentStudentCode || !currentStudentData) return showToast("Selecione um aluno.", "error");

  const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const prescricaoCompleta = {};

  dias.forEach(d => {
    prescricaoCompleta[d] = {
      km: document.getElementById(`run_km_${d}`).value.trim(),
      min: document.getElementById(`run_min_${d}`).value.trim(),
      intensidade: document.getElementById(`run_int_${d}`).value.trim(),
      desc: document.getElementById(`run_desc_${d}`).value.trim()
    };
  });

  currentStudentData.prescricao_corrida = prescricaoCompleta;
  currentStudentData.cardio_guidelines = document.getElementById('editCardioGuidelines').value.trim();

  salvarAlteracoes();
  showToast("Plano de cardio e prescrição salvos!", "success");
}

async function gerarApenasDiretrizesIA() {
  if (!currentStudentCode || !currentStudentData) return showToast("Selecione um aluno primeiro.", "error");

  const treinoAtualTexto = document.getElementById('liveWorkoutText').value.trim();
  if (!treinoAtualTexto) {
    return showToast("Insira ou monte a ficha de treino antes de gerar as diretrizes.", "error");
  }

  const btn = document.getElementById('btnGerarApenasDiretrizesIA');
  const txtOriginal = btn.textContent;

  btn.textContent = "⏳ Gerando Diretrizes...";
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/chat-ia`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({
        mensagem: `Você é um preparador físico prático e objetivo.
Sua única função é gerar as DIRETRIZES DE EXECUÇÃO DE TREINO para o aluno com base no treino fornecido.

MANTENHA O TEXTO RESUMIDO E SIMPLES:
1. Aquecimento Geral / Articular
​2. Série de Reconhecimento (Feeder Set)
3. PAP / Ativação Neural (Ramp-up)
4. Séries de Trabalho (Working Sets)

REGRAS DE FORMATO:
- NUNCA use o caractere asterisco (*).
- NUNCA fale sobre dieta ou suplementos.

--- FICHA DE TREINO ATUAL ---
${treinoAtualTexto}`,
        contexto: currentStudentData || {},
        origem: "ADMIN"
      })
    });

    const data = await res.json();
    if (res.ok && data.resposta) {
      let textoLimpo = data.resposta.replace(/\*/g, '').trim();
      document.getElementById('editTrainerGuidelines').value = textoLimpo;
      showToast("Diretrizes geradas!", "success");
    } else {
      showToast(data.error || "Não foi possível gerar as diretrizes.", "error");
    }
  } catch (e) {
    showToast("Erro ao conectar à IA de Diretrizes.", "error");
  } finally {
    btn.textContent = txtOriginal;
    btn.disabled = false;
  }
}

async function executarComandoIaTreino() {
  const input = document.getElementById('aiWorkoutCommand');
  const tx = document.getElementById('liveWorkoutText');
  const btn = document.getElementById('btnAiCmd');
  const cmd = input.value.trim();

  if (!cmd) return showToast("Digite o comando para a IA de Treino.", "error");

  const txtOriginal = btn.textContent;
  btn.textContent = "⚡ Modificando...";
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/chat-ia`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({
        mensagem: `Ajuste a ficha de treino com base na solicitação: "${cmd}".
Retorne ESTRITAMENTE um JSON no formato:
{
  "workout_text": "Texto completo da ficha ajustada"
}

Ficha Atual:
${tx.value}`,
        contexto: currentStudentData || {},
        origem: "ADMIN"
      })
    });

    const data = await res.json();
    if (res.ok && data.resposta) {
      let jsonClean = data.resposta.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedRes = JSON.parse(jsonClean);

      if (parsedRes.workout_text) {
        tx.value = parsedRes.workout_text.trim();
        lidarEdicaoTreino();
      }

      input.value = "";
      showToast("Ficha atualizada pela IA!", "success");
    } else {
      showToast(data.error || "Erro ao alterar ficha.", "error");
    }
  } catch(e) {
    showToast("Erro ao processar comando na IA.", "error");
  } finally {
    btn.textContent = txtOriginal;
    btn.disabled = false;
  }
}

async function gerarDietaCompletaPorAnamnese() {
  if (!currentStudentCode || !currentStudentData) {
    return showToast("Selecione um aluno primeiro.", "error");
  }

  const anamnese = currentStudentData.dadosAnamnese || currentStudentData || {};
  const instrucaoExtra = document.getElementById('aiDietExtraInstructions').value.trim();
  const textarea = document.getElementById('dietTextarea');
  const dietaAtual = textarea.value.trim();

  const btn = document.getElementById('btnRunAnamneseDualAI');
  const txtOriginal = btn.textContent;

  btn.disabled = true;
  btn.textContent = "⏳ IA Processando Dieta e Substituições...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/gerar-dieta-duas-ias`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({
        anamneseData: anamnese,
        instrucaoExtra: instrucaoExtra,
        dietaAtual: dietaAtual
      })
    });

    const data = await res.json();
    if (res.ok && data.dietaCompleta) {
      textarea.value = data.dietaCompleta;
      lidarEdicaoDieta();
      showToast("✅ Dieta gerada com sucesso!", "success");
    } else {
      showToast(data.error || "Falha ao gerar dieta.", "error");
    }
  } catch (erro) {
    showToast("Erro de conexão com o servidor ao gerar a dieta.", "error");
  } finally {
    btn.textContent = txtOriginal;
    btn.disabled = false;
  }
}

function salvarTreinoEditado() {
  const raw = document.getElementById('liveWorkoutText').value;
  const guidelinesText = document.getElementById('editTrainerGuidelines').value.trim();

  currentStudentData.days = parseWorkoutText(raw);
  currentStudentData.trainer_guidelines = guidelinesText;

  salvarAlteracoes('workout');
}

function enviarCredenciaisWhatsApp() {
  if (!currentStudentCode || !currentStudentData) return showToast("Selecione um aluno primeiro.", "error");

  const nome = currentStudentData.clientName || currentStudentCode;
  const codigo = currentStudentCode;
  const senha = lastGeneratedPassword || "123456";
  const linkApp = `https://jhonataconsultoria.com.br/app.html?aluno=${codigo}`;

  const mensagem = 
`🏋️ *ACESSO AO APLICATIVO — JHONATA PERSONAL*

Olá, *${nome}*! Seu protocolo e acesso exclusivo ao aplicativo já estão liberados.

🌐 *Link de Acesso:* ${linkApp}
👤 *Usuário:* ${codigo}
🔑 *Senha:* ${senha}

📲 *INSTALAÇÃO:*
🍏 iPhone: ${TUTORIAL_IOS}
🤖 Android: ${TUTORIAL_ANDROID}`;

  const fone = currentStudentData.dadosAnamnese?.telefone ? currentStudentData.dadosAnamnese.telefone.replace(/\D/g, '') : '';
  const urlWpp = fone ? `https://wa.me/55${fone}?text=${encodeURIComponent(mensagem)}` : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  window.open(urlWpp, '_blank');
}

async function gerarNovaSenhaAluno() {
  if (!currentStudentCode) return showToast("Selecione um aluno primeiro.", "error");
  if (!confirm(`Gerar uma nova senha temporária para @${currentStudentCode}?`)) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/gerar-senha/${currentStudentCode}`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache'
    });
    const data = await res.json();
    if (res.ok && data.senhaTemporaria) {
      lastGeneratedPassword = data.senhaTemporaria;
      document.getElementById('editPassword').value = data.senhaTemporaria;
      showToast(`Nova Senha: ${data.senhaTemporaria}`, "success");
      if (confirm("Deseja enviar as novas credenciais via WhatsApp agora?")) {
        enviarCredenciaisWhatsApp();
      }
    } else {
      showToast(data.error || "Erro ao gerar senha.", "error");
    }
  } catch (e) {
    showToast("Erro ao conectar ao servidor.", "error");
  }
}

function renderCorridaAdmin() {
  const list = document.getElementById('adminRunHistoryList');
  list.innerHTML = '';

  const registros = (currentStudentData && currentStudentData.registros_corrida) || {};
  const keysDias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const nomesDias = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };

  let encontrouTreino = false;

  keysDias.forEach(key => {
    let historicoDia = registros[key];
    if (!historicoDia) return;

    if (!Array.isArray(historicoDia)) historicoDia = [historicoDia];
    if (historicoDia.length > 4) historicoDia = historicoDia.slice(-4);

    if (historicoDia.length > 0) {
      encontrouTreino = true;
      const box = document.createElement('div');
      box.style.cssText = "background:#100305; border:1px solid var(--border); border-left:3px solid var(--blue); padding:10px; border-radius:8px; margin-bottom:8px; font-size:12px;";

      let html = `<b style="color:var(--blue); font-size:12px;">🏃 ${nomesDias[key]} (Últimos ${historicoDia.length} registros):</b><br>`;

      historicoDia.forEach((reg, i) => {
        if (reg.splits) {
          const numKms = Object.keys(reg.splits).length;
          html += `<div style="margin-top:4px; color:#fff;">• <b>Semana ${i+1} (${reg.data || 'Recente'}):</b> ${numKms} Kms fracionados inseridos</div>`;
        } else if (reg.km && reg.min) {
          html += `<div style="margin-top:4px; color:#fff;">• <b>Semana ${i+1} (${reg.data || 'Recente'}):</b> ${reg.km} km em ${reg.min} min</div>`;
        }
      });

      box.innerHTML = html;
      list.appendChild(box);
    }
  });

  if (!encontrouTreino) {
    list.innerHTML = `<p style="color:var(--muted); font-size:12px;">Nenhum registro de corrida encontrado para este aluno.</p>`;
  }
}

function renderAnamneseDetails() {
  const div = document.getElementById('anamneseDetails');
  if (!div) return;

  const a = (currentStudentData && currentStudentData.dadosAnamnese) || currentStudentData || {};

  if (!a.nome && !a.clientName && !a.objetivo && !a.telefone && !a.email && !a.peso) {
    div.innerHTML = `<p style="color:var(--muted); font-size:13px;">Nenhuma resposta de anamnese detalhada encontrada para este perfil.</p>`;
    return;
  }

  div.innerHTML = `
    <!-- BLOCO 1: DADOS PESSOAIS -->
    <div style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:14px;">
      <h4 style="color:var(--gold); font-size:13px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">👤 Dados Pessoais</h4>
      <div class="anamnese-grid">
        <div class="anamnese-box"><div class="anamnese-label">Nome Completo</div><div class="anamnese-val">${escapeHtml(a.nome || a.clientName) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Telefone / WhatsApp</div><div class="anamnese-val">${escapeHtml(a.telefone) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">E-mail</div><div class="anamnese-val">${escapeHtml(a.email) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">CPF</div><div class="anamnese-val">${escapeHtml(a.cpf) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Data Nasc. / Idade</div><div class="anamnese-val">${escapeHtml(a.nascimento || a.idade) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Gênero</div><div class="anamnese-val">${escapeHtml(a.genero) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Peso Corporal</div><div class="anamnese-val">${a.peso ? escapeHtml(a.peso) + ' kg' : '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Altura</div><div class="anamnese-val">${a.altura ? escapeHtml(a.altura) + ' m' : '-'}</div></div>
      </div>
    </div>

    <!-- BLOCO 2: OBJETIVOS E HISTÓRICO DE TREINO -->
    <div style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:14px;">
      <h4 style="color:var(--gold); font-size:13px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">🎯 Objetivo e Condição Física</h4>
      <div class="anamnese-grid">
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Objetivo Principal</div><div class="anamnese-val" style="color:var(--gold); font-weight:700;">${escapeHtml(a.objetivo) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Tempo Praticando Musculação</div><div class="anamnese-val">${escapeHtml(a.tempoTreino || a.experiencia) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Dias Disponíveis por Semana</div><div class="anamnese-val">${escapeHtml(a.diasDisponiveis || a.diasSemana) || '-'}</div></div>
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Lesões, Dores ou Incômodos</div><div class="anamnese-val" style="color:#ff6b7f;">${escapeHtml(a.lesoes || a.dores) || 'Nenhuma declarada.'}</div></div>
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Problemas de Saúde / Medicamentos</div><div class="anamnese-val">${escapeHtml(a.medicamentos || a.patologias) || 'Nenhum declarado.'}</div></div>
      </div>
    </div>

    <!-- BLOCO 3: ROTINA & HÁBITOS -->
    <div style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:14px;">
      <h4 style="color:var(--gold); font-size:13px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">🌙 Rotina e Sono</h4>
      <div class="anamnese-grid">
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Profissão / Rotina Diária</div><div class="anamnese-val">${escapeHtml(a.rotina || a.trabalho) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Média de Sono / Noite</div><div class="anamnese-val">${escapeHtml(a.sono || a.horasSono) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Nível de Estresse</div><div class="anamnese-val">${escapeHtml(a.estresse) || '-'}</div></div>
      </div>
    </div>

    <!-- BLOCO 4: ALIMENTAÇÃO E DIETA -->
    <div style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:14px;">
      <h4 style="color:var(--gold); font-size:13px; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">🥗 Hábitos Alimentares & Preferências</h4>
      <div class="anamnese-grid">
        <div class="anamnese-box"><div class="anamnese-label">Refeições por Dia</div><div class="anamnese-val">${escapeHtml(a.numRefeicoes) || '-'}</div></div>
        <div class="anamnese-box"><div class="anamnese-label">Consumo Diário de Água</div><div class="anamnese-val">${escapeHtml(a.agua) || '-'}</div></div>
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Alimentos que NÃO Gosta / Alergias</div><div class="anamnese-val" style="color:#ff6b7f; font-weight:700;">${escapeHtml(a.alimentosOdiados || a.restricoes) || 'Nenhum declarado.'}</div></div>
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Alimentos Preferidos / Indispensáveis</div><div class="anamnese-val" style="color:var(--green); font-weight:700;">${escapeHtml(a.alimentosGosta || a.preferencias) || 'Nenhum declarado.'}</div></div>
        <div class="anamnese-box" style="grid-column: 1 / -1;"><div class="anamnese-label">Suplementos e Ergogênicos em Uso</div><div class="anamnese-val">${escapeHtml(a.suplementos || a.ergogenicos) || 'Nenhum informado.'}</div></div>
      </div>
    </div>
  `;
}

function renderAdminFeedbackHistory() {
  const history = document.getElementById('adminFeedbackHistory');
  if (!history) return;
  history.innerHTML = '';

  const feedbacks = (currentStudentData && currentStudentData.feedbacks) || [];

  if (feedbacks.length === 0) {
    history.innerHTML = '<div style="color:var(--muted); font-size:12px; text-align:center;">Nenhum feedback enviado por este aluno ainda.</div>';
    return;
  }

  feedbacks.forEach(f => {
    const isAluno = f.autor === "ALUNO";
    let htmlFotos = '';

    if (f.fotos && f.fotos.length > 0) {
      htmlFotos = '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">';
      f.fotos.forEach((url, idx) => {
        htmlFotos += `<a href="${url}" target="_blank" style="background:var(--gold); color:#000; font-size:10px; padding:4px 8px; border-radius:4px; text-decoration:none; font-weight:800;">🖼️ Foto ${idx + 1} no Drive</a>`;
      });
      htmlFotos += '</div>';
    }
    
    history.innerHTML += `
      <div style="background:${isAluno ? '#1a050b' : '#100305'}; padding:10px 12px; border-radius:8px; font-size:12.5px; color:#fff; align-self:${isAluno ? 'flex-start' : 'flex-end'}; border:1px solid ${isAluno ? 'var(--accent)' : 'var(--gold)'}; max-width:85%;">
        <b style="color:${isAluno ? 'var(--accent)' : 'var(--gold)'}">${isAluno ? 'Aluno' : 'Você (Personal)'}:</b> ${escapeHtml(f.mensagem)}
        ${htmlFotos}
      </div>
    `;
  });
  history.scrollTop = history.scrollHeight;
}

async function responderFeedbackAdmin() {
  const input = document.getElementById('adminFeedbackInput');
  const msg = input.value.trim();
  if (!msg || !currentStudentCode) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/feedback/enviar`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: currentStudentCode, autor: "PERSONAL", mensagem: msg })
    });

    const data = await res.json();
    if (res.ok && data.feedbacks) {
      currentStudentData.feedbacks = data.feedbacks;
    } else {
      if (!currentStudentData.feedbacks) currentStudentData.feedbacks = [];
      currentStudentData.feedbacks.push({ autor: "PERSONAL", mensagem: msg, data: new Date().toISOString() });
    }

    input.value = '';
    renderAdminFeedbackHistory();
    document.getElementById('tabFeedbackBadge').classList.add('hidden');
    fetchAlunos();
    showToast("Resposta enviada!", "success");
  } catch (e) {
    showToast("Erro ao enviar resposta ao aluno.", "error");
  }
}

async function renovarUmMesAluno() {
  if (!currentStudentCode || !currentStudentData) return showToast("Selecione um aluno primeiro.", "error");
  if (!confirm(`Confirmar pagamento e renovar +30 DIAS de acesso para @${currentStudentCode}?`)) return;

  try {
    currentStudentData.status_pagamento = "pago";

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let dataBase = new Date(hoje.getTime());

    if (currentStudentData.data_expiracao) {
      const partes = String(currentStudentData.data_expiracao).split('T')[0].split('-');
      if (partes.length === 3) {
        const ano = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const dia = parseInt(partes[2], 10);
        
        const expExistente = new Date(ano, mes, dia, 23, 59, 59);
        if (expExistente > hoje) dataBase = expExistente;
      }
    }

    dataBase.setDate(dataBase.getDate() + 30);

    const anoFmt = dataBase.getFullYear();
    const mesFmt = String(dataBase.getMonth() + 1).padStart(2, '0');
    const diaFmt = String(dataBase.getDate()).padStart(2, '0');

    currentStudentData.data_expiracao = `${anoFmt}-${mesFmt}-${diaFmt}`;
    currentStudentData.dia_vencimento = dataBase.getDate();

    const res = await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: currentStudentCode, payload: currentStudentData })
    });

    if (res.ok) {
      showToast(`✅ Renovado por +30 dias! Vencimento: ${diaFmt}/${mesFmt}/${anoFmt}`, "success");
      await fetchAlunos();
      await carregarAluno(currentStudentCode);
    } else {
      showToast("Erro ao salvar renovação no servidor.", "error");
    }
  } catch (e) {
    showToast("Erro de conexão ao renovar pagamento.", "error");
  }
}

function carregarTreinoNoEditorAoVivo() {
  const tx = document.getElementById('liveWorkoutText');
  const draft = localStorage.getItem(`draft_workout_${currentStudentCode}`);

  if (draft) {
    tx.value = draft;
    atualizarPreviewAoVivo();
    return;
  }

  if (!currentStudentData.days || currentStudentData.days.length === 0) {
    tx.value = "";
    atualizarPreviewAoVivo();
    return;
  }

  let text = "";
  currentStudentData.days.forEach(day => {
    text += `${day.title}\n`;
    (day.exercicios || []).forEach(ex => {
      text += `${ex.nome} ${ex.series} (${ex.reps})\n`;
    });
    text += "\n";
  });

  tx.value = text.trim();
  atualizarPreviewAoVivo();
}

function atualizarPreviewAoVivo() {
  const raw = document.getElementById('liveWorkoutText').value;
  const container = document.getElementById('liveWorkoutPreview');
  const parsedDays = parseWorkoutText(raw);

  container.innerHTML = "";
  if (parsedDays.length === 0) {
    container.innerHTML = `<div style="background:#20050c; border:1px solid var(--accent); padding:10px; border-radius:8px; color:#ff6b7f; font-size:12px;">⚠️ Nenhum treino reconhecido. Digite divisões claras.</div>`;
    return;
  }

  parsedDays.forEach(day => {
    let html = `<div style="margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
      <b style="color:var(--gold); font-size:13px;">🏋️ ${escapeHtml(day.title)}</b><br>`;
    
    day.exercicios.forEach(ex => {
      const isTecnico = ex.isTecnico ? `<span style="color:var(--accent); font-weight:700;"> [${escapeHtml(ex.tecnicaTipo)}]</span>` : '';
      const gifBadge = ex.gifUrl ? ` <span style="font-size:10px; color:var(--green); font-weight:700;">🎥 GIF</span>` : '';
      html += `<div style="font-size:12px; margin-top:4px; display:flex; justify-content:space-between;">
        <span>• ${escapeHtml(ex.nome)}${isTecnico}${gifBadge}</span>
        <span style="color:var(--muted); font-weight:700;">${escapeHtml(ex.series)} (${escapeHtml(ex.reps)})</span>
      </div>`;
    });

    html += `</div>`;
    container.innerHTML += html;
  });
}

async function verEvolucaoSemanal(nomeEx, seriesStr, repsStr) {
  document.getElementById('chartExName').textContent = nomeEx;
  document.getElementById('chartExMeta').textContent = `Meta: ${seriesStr} (${repsStr})`;

  const weeklyLogs = (currentStudentData && currentStudentData.weekly_logs) || {};
  const dailyLogs = (currentStudentData && currentStudentData.logs) || {};
  
  const keyEx = sanitizeExKey(nomeEx);
  let historicoSemanal = (weeklyLogs[keyEx] || []).slice(-4);

  if (historicoSemanal.length === 0) {
    let maxC = 0;
    let totalR = 0;
    let countS = 0;

    for (let s = 1; s <= 5; s++) {
      const c = parseFloat(dailyLogs[`log_c_${keyEx}_s${s}`]);
      const r = parseFloat(dailyLogs[`log_r_${keyEx}_s${s}`]);
      if (!isNaN(c) && c > maxC) maxC = c;
      if (!isNaN(r)) { totalR += r; countS++; }
    }

    if (maxC > 0) {
      const rMed = countS > 0 ? Math.round(totalR / countS) : '-';
      historicoSemanal = [{ data: 'Hoje', cargaMax: maxC, repsMed: rMed, tecnica: 'Sessão Recente' }];
    }
  }

  let html = "<b>Progresso Semanal (Últimos Registros):</b><br>";
  let cargasValidas = [];
  let repsValidas = [];

  if (historicoSemanal.length === 0) {
    html += `<div style="margin-top:8px; color:var(--muted); font-size:12px;">Nenhum registro de carga salvo até o momento.</div>`;
    document.getElementById('aiProgressInsight').classList.add('hidden');
  } else {
    historicoSemanal.forEach((reg, idx) => {
      const cargaVal = reg.cargaMax || reg.carga || 0;
      const repsVal = reg.repsMed || reg.reps || '-';
      html += `
        <div style="margin-top:8px; background:#100305; padding:8px 10px; border-radius:8px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <b style="color:var(--gold)">Treino ${idx + 1} (${escapeHtml(reg.data || 'Recente')}):</b><br>
            <span style="color:#60a5fa; font-size:11px; font-weight:700;">Reps Médias: ${escapeHtml(repsVal)}</span>
            ${reg.tecnica ? `<br><span style="color:var(--green); font-size:11px; font-weight:700;">⚙ Técnica: ${escapeHtml(reg.tecnica)}</span>` : ''}
          </div>
          <div style="font-size:15px; font-weight:800; color:var(--gold);">${escapeHtml(cargaVal)} kg</div>
        </div>
      `;
      if (!isNaN(parseFloat(cargaVal))) cargasValidas.push(parseFloat(cargaVal));
      if (!isNaN(parseFloat(repsVal))) repsValidas.push(parseFloat(repsVal));
    });

    gerarAnaliseIAProgresso(nomeEx, historicoSemanal);
  }

  document.getElementById('logsDetailList').innerHTML = html;
  document.getElementById('chartModal').classList.remove('hidden');

  renderChartDuplo(cargasValidas, repsValidas);
}

async function gerarAnaliseIAProgresso(nomeEx, historicoLogs) {
  const boxIA = document.getElementById('aiProgressInsight');
  const textIA = document.getElementById('aiInsightText');

  boxIA.classList.remove('hidden');
  textIA.innerHTML = "<i>Analisando cargas e repetições com a IA...</i>";

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/analisar-progresso-ia`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({
        exercicioNome: nomeEx,
        historicoLogs: historicoLogs
      })
    });

    const data = await res.json();
    if (res.ok && data.analise) {
      textIA.innerHTML = escapeHtml(data.analise).replace(/\n/g, '<br>');
    } else {
      textIA.textContent = "Não foi possível gerar o resumo da evolução neste momento.";
    }
  } catch (e) {
    textIA.textContent = "Erro de conexão ao buscar análise da IA.";
  }
}

function renderChartDuplo(cargas, reps) {
  const ctx = document.getElementById('progressChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  const dataCargas = cargas.length > 0 ? cargas : [0];
  const dataReps = reps.length > 0 ? reps : [0];
  const maxLen = Math.max(dataCargas.length, dataReps.length);
  const labels = Array.from({length: maxLen}, (_, i) => `Treino ${i+1}`);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Carga (kg)',
          data: dataCargas,
          borderColor: '#dcaa3a',
          backgroundColor: 'rgba(220,170,58,0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 6,
          pointBackgroundColor: '#dcaa3a',
          yAxisID: 'y'
        },
        {
          label: 'Repetições',
          data: dataReps,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 6,
          pointBackgroundColor: '#3b82f6',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Carga (kg)', color: '#dcaa3a' },
          grid: { color: '#25080e' },
          ticks: { color: '#dcaa3a' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Reps Médias', color: '#3b82f6' },
          grid: { drawOnChartArea: false },
          ticks: { color: '#3b82f6' }
        },
        x: { grid: { color: '#25080e' }, ticks: { color: '#a08086' } }
      },
      plugins: {
        legend: { labels: { color: '#f8efec', font: { family: 'Inter', weight: '700' } } }
      }
    }
  });
}

function closeChartModal() {
  document.getElementById('chartModal').classList.add('hidden');
}

const ORDEM_ABAS_PRINCIPAIS = ['treino', 'dieta', 'feedbackAdmin', 'resumo', 'anamnese', 'corrida', 'cadastro'];

function switchTab(tab) {
  document.getElementById('secResumo').classList.add('hidden');
  document.getElementById('secAnamnese').classList.add('hidden');
  document.getElementById('secFeedbackAdmin').classList.add('hidden');
  document.getElementById('secTreino').classList.add('hidden');
  document.getElementById('secDieta').classList.add('hidden');
  document.getElementById('secCorrida').classList.add('hidden');
  document.getElementById('secCadastro').classList.add('hidden');
  document.getElementById('secNovo').classList.add('hidden');
  document.getElementById('secChatAdmin').classList.add('hidden');
  document.getElementById('secGifs').classList.add('hidden');

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  if (tab === 'resumo') {
    document.getElementById('secResumo').classList.remove('hidden');
    document.getElementById('tab1').classList.add('active');
  } else if (tab === 'anamnese') {
    document.getElementById('secAnamnese').classList.remove('hidden');
    document.getElementById('tabAnamnese').classList.add('active');
  } else if (tab === 'feedbackAdmin') {
    document.getElementById('secFeedbackAdmin').classList.remove('hidden');
    document.getElementById('tabFeedbackAdmin').classList.add('active');
  } else if (tab === 'treino') {
    document.getElementById('secTreino').classList.remove('hidden');
    document.getElementById('tab2').classList.add('active');
  } else if (tab === 'dieta') {
    document.getElementById('secDieta').classList.remove('hidden');
    document.getElementById('tab3').classList.add('active');
  } else if (tab === 'corrida') {
    document.getElementById('secCorrida').classList.remove('hidden');
    document.getElementById('tab5').classList.add('active');
  } else if (tab === 'cadastro') {
    document.getElementById('secCadastro').classList.remove('hidden');
    document.getElementById('tab4').classList.add('active');
  } else if (tab === 'novo') {
    document.getElementById('secNovo').classList.remove('hidden');
  } else if (tab === 'chatAdmin') {
    document.getElementById('secChatAdmin').classList.remove('hidden');
  } else if (tab === 'gifs') {
    document.getElementById('secGifs').classList.remove('hidden');
  }
}

function loadDietView() {
  const tx = document.getElementById('dietTextarea');
  const draft = localStorage.getItem(`draft_diet_${currentStudentCode}`);

  if (draft) {
    tx.value = draft;
    atualizarPreviewDietaAoVivo();
    return;
  }

  if (!currentStudentData || !currentStudentData.refeicoes) {
    tx.value = "";
    atualizarPreviewDietaAoVivo();
    return;
  }

  let str = "";
  if (typeof currentStudentData.refeicoes === 'string') {
    str = currentStudentData.refeicoes;
  } else if (Array.isArray(currentStudentData.refeicoes)) {
    currentStudentData.refeicoes.forEach(ref => {
      if (typeof ref === 'string') {
        str += `${ref}\n\n`;
      } else {
        str += `${ref.titulo || ''}\n${ref.alimentos || ''}\n\n`;
      }
    });
  }
  tx.value = str.trim();
  atualizarPreviewDietaAoVivo();
}

function parseDietaEstruturada(rawText) {
  if (!rawText || !rawText.trim()) return { resumoAdminText: "", suplementos: [], abas: [] };

  let cleanText = rawText.trim();
  let resumoAdminText = "";
  let suplementos = [];

  const abas = [];
  const rawAbas = cleanText.split(/(?=\[\s*ABA\s*\]|\[\s*CICLO\s*\]|---)/gi);

  rawAbas.forEach((rawAba, abaIdx) => {
    const cleanAba = rawAba.trim();
    if (!cleanAba || cleanAba === '---') return;

    let abaNome = "DIETA BASE";
    let abaDias = "";
    let textContent = cleanAba;

    if (/^(\[\s*ABA\s*\]|\[\s*CICLO\s*\])/i.test(cleanAba)) {
      const linesAba = cleanAba.split('\n');
      abaNome = linesAba[0].replace(/\[\s*ABA\s*\]|\[\s*CICLO\s*\]/gi, '').trim() || `Ciclo ${abaIdx + 1}`;

      let startIdx = 1;
      if (linesAba.length > 1 && linesAba[1].toLowerCase().trim().startsWith('dias:')) {
        abaDias = linesAba[1].trim();
        startIdx = 2;
      }
      textContent = linesAba.slice(startIdx).join('\n').trim();
    }

    const regexTitulosRefeicao = /(?=\[\s*REFEIÇÃO\s*\]|\[\s*DIETA BASE\s*\]|🍽|\d+ª\s*Refeição|Refeição\s*\d+|REF\s*\d+|CAFÉ DA MANHÃ|ALMOÇO|LANCHE PÓS CORRIDA|CAFÉ DA TARDE|JANTAR|CEIA)/gi;
    const rawMeals = textContent.split(regexTitulosRefeicao);
    const meals = [];

    rawMeals.forEach(bloco => {
      let clean = bloco.trim();
      if (!clean) return;

      clean = clean.replace(/^\[?\s*REFEIÇÃO\s*\]?\s*/gi, '').replace(/^REFEIÇÃO\]\s*/gi, '').trim();

      const lines = clean.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (lines.length === 0) return;

      let title = lines[0].replace(/^\[.*?\]\s*/, '').replace(/^🍽\s*/, '').trim();
      const titleLower = title.toLowerCase();

      // FILTRO DE CABEÇALHOS GERAIS DE RESUMO/SUPLEMENTAÇÃO
      if (
        titleLower.includes('plano alimentar') || 
        titleLower.includes('resumo nutricional') ||
        titleLower.includes('meta diaria') ||
        titleLower.includes('metas diarias') ||
        titleLower.includes('meta diária') ||
        titleLower.includes('metas diárias') ||
        titleLower.includes('suplemento') ||
        titleLower.includes('suplementos') ||
        titleLower.includes('suplementação') ||
        titleLower.includes('suplementacao') ||
        titleLower.includes('gasto estimado')
      ) {
        lines.forEach(l => {
          const lLower = l.toLowerCase();
          if (lLower.includes('meta') || lLower.includes('calórica') || lLower.includes('água') || lLower.includes('gasto') || lLower.includes('proteínas') || lLower.includes('carboidratos') || lLower.includes('gorduras')) {
            resumoAdminText += l + '\n';
          } else if (l.startsWith('-') || l.startsWith('•')) {
            suplementos.push(l.replace(/^[-•*]\s*/, '').trim());
          }
        });

        return; // Pula este bloco para não gerar cartão fantasma
      }

      let days = "";
      const baseItems = [];
      const trocasCarbo = [];
      const trocasProt = [];

      lines.slice(1).forEach(line => {
        let lineClean = line.replace(/\[\s*\]/g, '').trim();
        const lineLower = lineClean.toLowerCase();
        
        if (lineLower.startsWith('dias:') || lineLower.startsWith('dias da semana:')) {
          days = lineClean;
        } else if (lineClean.includes('↳') || lineClean.includes('(Opção de troca)') || lineClean.includes('(Troca)')) {
          let itemTxt = lineClean.replace(/↳|Opção de Troca|\(Carboidrato\):|\(Proteína\):|\(Opção de troca\)|\(Troca\)/gi, '').replace(/^[-•*]\s*/, '').trim();
          if (!itemTxt) return;

          if (lineClean.toUpperCase().includes('[CARBO]') || lineLower.includes('carbo')) {
            trocasCarbo.push(itemTxt);
          } else if (lineClean.toUpperCase().includes('[PROT]') || lineLower.includes('prot')) {
            trocasProt.push(itemTxt);
          } else {
            trocasCarbo.push(itemTxt);
          }
        } else {
          const cleanItem = lineClean.replace(/^[-•*]\s*/, '').trim();
          if (cleanItem) baseItems.push(cleanItem);
        }
      });

      if (title && (baseItems.length > 0 || trocasCarbo.length > 0 || trocasProt.length > 0)) {
        meals.push({ 
          mealTitle: title, 
          days: days, 
          baseItems: baseItems, 
          trocasCarbo: trocasCarbo, 
          trocasProt: trocasProt 
        });
      }
    });

    if (meals.length > 0) {
      abas.push({ abaNome: abaNome, abaDias: abaDias, meals: meals });
    }
  });

  return { resumoAdminText: resumoAdminText.trim(), suplementos, abas };
}

function atualizarPreviewDietaAoVivo() {
  const raw = document.getElementById('dietTextarea').value;
  const filtersEl = document.getElementById('dietPreviewFilters');
  const listEl = document.getElementById('dietPreviewList');

  const { resumoAdminText, suplementos, abas } = parseDietaEstruturada(raw);
  filtersEl.innerHTML = '';
  listEl.innerHTML = '';

  if (resumoAdminText) {
    const resCard = document.createElement('div');
    resCard.style.cssText = "background:#100305; border:1px solid var(--gold); border-radius:10px; padding:12px; margin-bottom:12px; font-size:12px; color:#fff;";
    resCard.innerHTML = `
      <b style="color:var(--gold); font-size:13px;">📊 METAS DIÁRIAS (CALORIAS & ÁGUA):</b>
      <div style="margin-top:6px; white-space:pre-line;">${escapeHtml(resumoAdminText)}</div>
    `;
    listEl.appendChild(resCard);
  }

  if (suplementos.length > 0) {
    const supCard = document.createElement('div');
    supCard.style.cssText = "background:#050d1a; border:1px solid #60a5fa; border-radius:10px; padding:12px; margin-bottom:12px; font-size:12px; color:#fff;";
    let supHtml = `<b style="color:#60a5fa; font-size:13px;">💊 SUPLEMENTAÇÃO DIÁRIA CADASTRADA:</b><ul style="margin-top:6px; margin-left:16px;">`;
    suplementos.forEach(s => supHtml += `<li>${escapeHtml(s)}</li>`);
    supHtml += `</ul>`;
    supCard.innerHTML = supHtml;
    listEl.appendChild(supCard);
  }

  if (abas.length === 0) {
    listEl.innerHTML += `<div style="background:#20050c; border:1px solid var(--accent); padding:10px; border-radius:8px; color:#ff6b7f; font-size:12px;">⚠️ Nenhuma refeição reconhecida. Digite ou gere a dieta no editor.</div>`;
    return;
  }

  if (activeDietAbaIndex >= abas.length) activeDietAbaIndex = 0;

  abas.forEach((aba, idx) => {
    const btn = document.createElement('button');
    btn.className = `diet-aba-btn ${idx === activeDietAbaIndex ? 'active' : ''}`;
    btn.textContent = aba.abaNome;
    btn.onclick = () => {
      activeDietAbaIndex = idx;
      atualizarPreviewDietaAoVivo();
    };
    filtersEl.appendChild(btn);
  });

  const currentAba = abas[activeDietAbaIndex];
  if (currentAba) {
    if (currentAba.abaDias) {
      const diasDiv = document.createElement('div');
      diasDiv.style.cssText = "font-size:11px; color:var(--gold); font-weight:700; margin-bottom:10px; background:#100305; padding:8px 12px; border-radius:8px; border:1px solid var(--gold);";
      diasDiv.textContent = currentAba.abaDias;
      listEl.appendChild(diasDiv);
    }

    (currentAba.meals || []).forEach((block, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'margin-bottom:10px; border-radius:12px; overflow:hidden; border:1px solid var(--border);';

      let html = `
        <div class="day-accordion-header" onclick="toggleResumoAccordion('preview_ref_${idx}')" style="margin-bottom:0;">
          <div>
            <b style="color:var(--gold); font-size:14px;">🍽️ ${escapeHtml(block.mealTitle)}</b>
            ${block.days ? `<div style="font-size:11px; color:var(--blue); font-weight:700; margin-top:2px;">${escapeHtml(block.days)}</div>` : ''}
          </div>
          <span style="color:var(--gold); font-size:12px; font-weight:700;">Ver Base & Trocas ▾</span>
        </div>
        <div id="preview_ref_${idx}" class="hidden" style="background:#0d0204; padding:12px; font-size:12px;">
      `;

      block.baseItems.forEach(item => {
        html += `
          <div class="meal-item-base">
            <span style="color:#fff; font-weight:700;">• ${escapeHtml(item)}</span>
          </div>
        `;
      });

      if (block.trocasCarbo.length > 0) {
        html += `<div style="font-size:11px; color:#60a5fa; font-weight:800; margin-top:8px;">🌾 OPÇÕES DE TROCA DE CARBOIDRATOS:</div>`;
        block.trocasCarbo.forEach(subC => {
          html += `<div class="sub-item-box carbo"><span style="color:#60a5fa; font-weight:700;">🔄 Troca:</span> ${escapeHtml(subC)}</div>`;
        });
      }

      if (block.trocasProt.length > 0) {
        html += `<div style="font-size:11px; color:#25d366; font-weight:800; margin-top:8px;">🥩 OPÇÕES DE TROCA DE PROTEÍNA/GORDURA:</div>`;
        block.trocasProt.forEach(subP => {
          html += `<div class="sub-item-box prot"><span style="color:#25d366; font-weight:700;">🔄 Troca:</span> ${escapeHtml(subP)}</div>`;
        });
      }

      html += `</div>`;
      card.innerHTML = html;
      listEl.appendChild(card);
    });
  }
}

function salvarDieta() {
  const raw = document.getElementById('dietTextarea').value.trim();
  if (!raw) return showToast("A caixa de texto da dieta está vazia.", "error");

  currentStudentData.refeicoes = [{ titulo: "Plano Alimentar", alimentos: raw }];
  salvarAlteracoes('diet');
}

async function salvarConfiguracoesConta() {
  currentStudentData.clientName = document.getElementById('editName').value.trim();
  currentStudentData.status_pagamento = document.getElementById('editStatus').value;
  
  const isentoVal = document.getElementById('editIsentoCheckbox').checked;
  currentStudentData.isento = isentoVal;
  if (isentoVal) currentStudentData.status_pagamento = 'isento';

  const novoDia = parseInt(document.getElementById('editDiaVencimento').value) || 7;
  currentStudentData.dia_vencimento = novoDia;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let ano = hoje.getFullYear();
  let mes = hoje.getMonth();
  
  let novaDataExp = new Date(ano, mes, novoDia, 23, 59, 59);
  if (novaDataExp < hoje) {
    novaDataExp = new Date(ano, mes + 1, novoDia, 23, 59, 59);
  }

  const anoFmt = novaDataExp.getFullYear();
  const mesFmt = String(novaDataExp.getMonth() + 1).padStart(2, '0');
  const diaFmt = String(novaDataExp.getDate()).padStart(2, '0');

  currentStudentData.data_expiracao = `${anoFmt}-${mesFmt}-${diaFmt}`;
  currentStudentData.evolucao_carga_pct = parseFloat(document.getElementById('editEvolucaoCarga').value) || 0;
  currentStudentData.semanas_rotacao = parseInt(document.getElementById('editSemanasRotacao').value) || 5;

  currentStudentData.data_vigencia = document.getElementById('editDataVigencia').value || '';

  const libDieta = document.getElementById('editLiberarDieta').checked;
  currentStudentData.liberarDieta = libDieta;
  currentStudentData.apenasTreino = !libDieta;

  currentStudentData.liberarErgogenicos = document.getElementById('editLiberarErgogenicos').checked;

  const estaPermitido = document.getElementById('editPermitirTecnicas').checked;
  currentStudentData.pode_alterar_tecnica = estaPermitido;
  currentStudentData.permitirTecnicas = estaPermitido;

  currentStudentData.notas_treinador = document.getElementById('editNotasTreinador').value.trim();

  const newPass = document.getElementById('editPassword').value.trim();
  if (newPass) {
    currentStudentData.senha = newPass;
    lastGeneratedPassword = newPass;
  } else {
    delete currentStudentData.senha;
  }

  await salvarAlteracoes();
  document.getElementById('editPassword').value = '';
}

async function salvarAlteracoes(tipoLimpezaRascunho = null) {
  try {
    atualizarCampoNotasMemoria();
    const res = await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: currentStudentCode, payload: currentStudentData })
    });
    if (res.ok) {
      if (tipoLimpezaRascunho === 'workout') {
        localStorage.removeItem(`draft_workout_${currentStudentCode}`);
      } else if (tipoLimpezaRascunho === 'diet') {
        localStorage.removeItem(`draft_diet_${currentStudentCode}`);
      }
      showToast("Dados salvos com sucesso!", "success");
      await fetchAlunos();
      await carregarAluno(currentStudentCode);
      switchTab('resumo');
    } else {
      showToast("Erro ao salvar dados no servidor.", "error");
    }
  } catch(e) { showToast("Erro de conexão ao salvar no servidor.", "error"); }
}

function parseWorkoutText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n');
  const days = [];
  let currentDay = null;

  let globalSeries = "3";
  let globalReps = "8-10";

  const divKeywords = ['upper', 'lower', 'torso', 'limbs', 'fullbody', 'push', 'pull', 'legs', 'anterior', 'posterior', 'treino', 'dia'];

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    const lowerLine = cleanLine.toLowerCase();

    if (lowerLine.includes('global') || lowerLine.startsWith('series') || lowerLine.startsWith('séries')) {
      const matchGlobal = cleanLine.match(/(\d+)\s*x\s*([\d\-\+]+)/i);
      if (matchGlobal) {
        globalSeries = matchGlobal[1];
        globalReps = matchGlobal[2];
      }
      return;
    }

    let isDayHeader = false;
    const cleanLowerNoBullets = lowerLine.replace(/^[•\-\*\d\.\s]+/, '');

    const hasDivKeyword = divKeywords.some(kw => cleanLowerNoBullets.startsWith(kw) || cleanLowerNoBullets === kw);
    const isShortHeader = /^(treino\s*[a-z0-9]+|dia\s*[a-z0-9]+|[a-z]\b)/i.test(cleanLowerNoBullets) && !/(x|×|\d+x)/i.test(cleanLine);

    if (hasDivKeyword || isShortHeader) isDayHeader = true;

    if (isDayHeader) {
      currentDay = { title: cleanLine.toUpperCase().replace(/^[•\-\*\s]+/, ''), exercicios: [] };
      days.push(currentDay);
    } else {
      if (!currentDay) {
        currentDay = { title: "TREINO A", exercicios: [] };
        days.push(currentDay);
      }

      let name = cleanLine.replace(/^[•\-\*\d\.\s]+/, '').trim();

      const hasMyo = lowerLine.includes('myo');
      const hasBackoff = lowerLine.includes('backoff') || lowerLine.includes('back-off') || lowerLine.includes('back off');
      const hasCluster = lowerLine.includes('cluster');

      const matchX = cleanLine.match(/^(\d+)\s*[xX×]\s*/i);
      let numSeriesDigitado = matchX ? parseInt(matchX[1]) : null;

      let exObj = {};

      if (hasCluster && hasBackoff) {
        name = name.replace(/^(\d+)\s*[xX×]\s*/i, '')
                   .replace(/(\d+x\+cluster\+backoff|\d+x\+backoff|cluster\+backoff|\+cluster|\+backoff)/gi, '')
                   .trim();

        exObj = {
          nome: name,
          series: "3 Séries",
          reps: "2 Séries Cluster (20s desc) + 1 Série Back-off (-20% carga)",
          tecnica: "cluster_backoff",
          isTecnico: true,
          tecnicaObrigatoria: true,
          tecnicaTipo: "CLUSTER + BACK-OFF"
        };
      } 
      else if (hasMyo) {
        name = name.replace(/^(\d+)\s*[xX×]\s*/i, '')
                   .replace(/(\d+x\+myoreps|myoreps|myo|\+myo)/gi, '')
                   .trim();

        exObj = {
          nome: name,
          series: "Myo-Reps",
          reps: "1 Série Ativação (4-6 reps) + 4 a 6 Mini-blocos (10-15s desc)",
          tecnica: "myoreps",
          isTecnico: true,
          tecnicaObrigatoria: true,
          tecnicaTipo: "MYO-REPS"
        };
      } 
      else if (hasBackoff) {
        name = name.replace(/^(\d+)\s*[xX×]\s*/i, '')
                   .replace(/(\d+x\+backoff|\d+x\+back-off|backoff|back-off|\+backoff|\+back-off)/gi, '')
                   .trim();

        exObj = {
          nome: name,
          series: "3 Séries",
          reps: "2 Séries normais + 1 Série Back-off (-20% a 30% carga)",
          tecnica: "backoff_2x",
          isTecnico: true,
          tecnicaObrigatoria: true,
          tecnicaTipo: "2 SÉRIES + BACK-OFF"
        };
      } 
      else if (hasCluster) {
        name = name.replace(/^(\d+)\s*[xX×]\s*/i, '')
                   .replace(/(\d+x\+cluster|cluster|\+cluster)/gi, '')
                   .trim();

        const qtdSeries = numSeriesDigitado ? `${numSeriesDigitado} Séries` : "2 Séries";
        exObj = {
          nome: name,
          series: qtdSeries,
          reps: "Blocos de 2-3 reps (20s descanso intra-série)",
          tecnica: "cluster",
          isTecnico: true,
          tecnicaObrigatoria: true,
          tecnicaTipo: "CLUSTER SET"
        };
      } 
      else {
        const matchTempo = cleanLine.match(/(\d+)\s*[xX×]\s*(\d+\s*(?:min|minuto|minutos|seg|s)\b)/i);

        if (matchTempo) {
          let series = matchTempo[1];
          let tempoStr = matchTempo[2];
          name = name.replace(/(\d+)\s*[xX×]\s*(\d+\s*(?:min|minuto|minutos|seg|s)\b)/gi, '').trim();

          exObj = { 
            nome: name, 
            series: `${series} Séries`, 
            reps: tempoStr, 
            tecnica: 'convencional',
            tecnicaObrigatoria: false
          };
        } else {
          const matchFull = cleanLine.match(/(\d+)\s*[xX×]\s*([\d\-\+]+)?/i);

          if (matchFull) {
            let series = matchFull[1];
            let reps = matchFull[2] || globalReps;
            name = name.replace(/(\d+)\s*[xX×]\s*([\d\-\+]+)?/gi, '').trim();

            exObj = { 
              nome: name, 
              series: `${series} Séries`, 
              reps: reps, 
              tecnica: 'convencional',
              tecnicaObrigatoria: false,
              baseSeriesNum: parseInt(series) || 3
            };
          } else {
            exObj = { 
              nome: name, 
              series: `${globalSeries} Séries`, 
              reps: globalReps, 
              tecnica: 'convencional',
              tecnicaObrigatoria: false,
              baseSeriesNum: parseInt(globalSeries) || 3
            };
          }
        }
      }

      const foundGifUrl = buscarGifExercicio(exObj.nome);
      if (foundGifUrl) exObj.gifUrl = foundGifUrl;

      currentDay.exercicios.push(exObj);
    }
  });

  return days.filter(d => d.exercicios.length > 0);
}

async function salvarNovoAlunoBloco() {
  const nome = document.getElementById('newName').value.trim();
  const codigo = document.getElementById('newCode').value.trim().toLowerCase();
  const rawW = document.getElementById('rawWorkout').value.trim();
  const rawD = document.getElementById('rawDiet').value.trim();

  if (!nome || !codigo) return showToast("Preencha Nome e Código.", "error");

  const parsedDays = parseWorkoutText(rawW);

  const hoje = new Date();
  hoje.setDate(hoje.getDate() + 30);
  
  const anoFmt = hoje.getFullYear();
  const mesFmt = String(hoje.getMonth() + 1).padStart(2, '0');
  const diaFmt = String(hoje.getDate()).padStart(2, '0');

  const payload = {
    clientName: nome,
    senha: codigo,
    status_pagamento: 'pago',
    isento: false,
    dia_vencimento: hoje.getDate(),
    data_expiracao: `${anoFmt}-${mesFmt}-${diaFmt}`,
    semanas_rotacao: 5,
    data_vigencia: "",
    pode_alterar_tecnica: false,
    permitirTecnicas: false,
    liberarDieta: true,
    liberarErgogenicos: false,
    apenasTreino: false,
    notas_treinador: "",
    trainer_guidelines: "",
    cardio_guidelines: "",
    logs: {},
    weekly_logs: {},
    days: parsedDays.length > 0 ? parsedDays : [{ title: "TREINO A", exercicios: [] }],
    refeicoes: [{ titulo: "Plano Alimentar", alimentos: rawD }]
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: codigo, payload: payload })
    });
    if (res.ok) {
      lastGeneratedPassword = codigo;
      showToast(`Aluno criado! Senha: ${codigo}`, "success");
      fetchAlunos();
      switchTab('resumo');
    }
  } catch(e) { showToast("Erro ao criar aluno.", "error"); }
}

async function deletarAluno() {
  if (!confirm(`Tem certeza que deseja apagar o aluno @${currentStudentCode}?`)) return;
  await fetch(`${BACKEND_URL}/api/aluno/${currentStudentCode}`, {
    method: 'DELETE',
    headers: authHeaders(),
    cache: 'no-cache'
  });
  currentStudentCode = "";
  showToast("Aluno excluído com sucesso.", "error");
  fetchAlunos();
  switchTab('resumo');
}

function copiarLinkAcessoAluno() {
  if (!currentStudentCode) return showToast("Selecione um aluno primeiro.", "error");
  const linkAluno = `https://jhonataconsultoria.com.br/app.html?aluno=${currentStudentCode}`;
  navigator.clipboard.writeText(linkAluno);
  showToast("Link de acesso copiado!", "success");
}

function calcularVolumeMuscularSemanal() {
  if (!currentStudentData || !currentStudentData.days) {
    return showToast("Selecione um aluno com treino cadastrado.", "error");
  }

  const grupos = {
    "Peitoral": ["supino", "crucifixo", "crossover", "peitoral", "fly", "chest", "flexao"],
    "Dorsais / Costas": ["puxada", "remada", "pulldown", "barra fixa", "serrote", "lat", "trapezio"],
    "Quadríceps": ["agachamento", "leg press", "extensora", "hack", "afundo", "sissy", "passada"],
    "Posterior de Coxa": ["stiff", "flexora", "mesa flexora", "cadeira flexora", "rdl", "good morning"],
    "Glúteos": ["elevacao pélvica", "elevação pelvica", "gluteo", "glúteo", "abducao", "abdução", "coice"],
    "Ombros (Deltoides)": ["desenvolvimento", "elevacao lateral", "elevação lateral", "facepull", "crucifixo invertido", "deltoide"],
    "Bíceps": ["rosca", "biceps", "bíceps", "scott"],
    "Tríceps": ["triceps", "tríceps", "testa", "frances", "francês", "pulley", "paralela"],
    "Panturrilhas": ["panturrilha", "gêmeos", "gemeos", "solear"]
  };

  const relatorio = {};
  Object.keys(grupos).forEach(g => relatorio[g] = { series: 0, tonagemKg: 0, exercicios: [] });

  const weeklyLogs = currentStudentData.weekly_logs || {};
  const dailyLogs = currentStudentData.logs || {};

  currentStudentData.days.forEach((day, dayIdx) => {
    (day.exercicios || []).forEach((ex, exIdx) => {
      const exNome = ex.nome.toLowerCase();
      const exKey = sanitizeExKey(ex.nome);
      const keyDirect = `${dayIdx}_${exIdx}`;

      const matchSeries = String(ex.series || '').match(/(\d+)/);
      const numSeries = matchSeries ? parseInt(matchSeries[1], 10) : 3;

      const matchReps = String(ex.reps || '').match(/(\d+)/);
      const repsMedias = matchReps ? parseInt(matchReps[1], 10) : 10;

      let cargaKg = 0;
      const historico = weeklyLogs[exKey] || weeklyLogs[keyDirect] || [];
      if (historico.length > 0) {
        const ult = historico[historico.length - 1];
        cargaKg = parseFloat(ult.cargaMax || ult.carga || 0);
      } else {
        for (let s = 1; s <= 5; s++) {
          const c = parseFloat(dailyLogs[`log_c_${exKey}_s${s}`] || dailyLogs[`log_c_${dayIdx}_${exIdx}_s${s}`]);
          if (!isNaN(c) && c > cargaKg) cargaKg = c;
        }
      }

      let grupoEncontrado = "Outros / Core";
      for (const [grupo, keywords] of Object.entries(grupos)) {
        if (keywords.some(kw => exNome.includes(kw))) {
          grupoEncontrado = grupo;
          break;
        }
      }

      if (!relatorio[grupoEncontrado]) {
        relatorio[grupoEncontrado] = { series: 0, tonagemKg: 0, exercicios: [] };
      }

      const tonagemExercicio = numSeries * repsMedias * cargaKg;
      relatorio[grupoEncontrado].series += numSeries;
      relatorio[grupoEncontrado].tonagemKg += tonagemExercicio;
      relatorio[grupoEncontrado].exercicios.push(ex.nome);
    });
  });

  renderModalVolumeMuscular(relatorio);
}

function renderModalVolumeMuscular(relatorio) {
  let modal = document.getElementById('volumeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'volumeModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  let htmlCards = '';
  Object.keys(relatorio).forEach(grupo => {
    const data = relatorio[grupo];
    if (data.series > 0) {
      let faixaStatus = '🟢 Volume Adequado';
      let corBorder = 'var(--green)';

      if (data.series < 10) {
        faixaStatus = '🟡 Manutenção / Baixo';
        corBorder = 'var(--gold)';
      } else if (data.series > 22) {
        faixaStatus = '🔴 Volume Elevado / Overreaching';
        corBorder = 'var(--accent)';
      }

      htmlCards += `
        <div style="background:#0d0204; border:1px solid ${corBorder}; border-radius:12px; padding:12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b style="color:#fff; font-size:14px;">💪 ${grupo}</b>
            <span style="font-size:10px; font-weight:800; color:${corBorder};">${faixaStatus}</span>
          </div>
          <div style="display:flex; gap:16px; margin-top:8px; font-size:12px; color:var(--muted);">
            <span>📊 Séries Semanais: <b style="color:var(--gold);">${data.series} séries</b></span>
            <span>🏋️ Tonagem Aprox.: <b style="color:#60a5fa;">${data.tonagemKg.toLocaleString('pt-BR')} kg</b></span>
          </div>
          <div style="font-size:10.5px; color:var(--muted); margin-top:6px;">
            <b>Exercícios:</b> ${data.exercicios.join(', ')}
          </div>
        </div>
      `;
    }
  });

  modal.innerHTML = `
    <div class="modal-chart" style="max-width:550px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="color:#fff; font-size:16px;">📊 Volume Semanal & Tonagem por Grupo Muscular</h3>
        <button onclick="document.getElementById('volumeModal').classList.add('hidden')" style="background:none; border:none; color:var(--accent); font-size:18px; font-weight:800; cursor:pointer;">✕</button>
      </div>
      <div style="max-height:60vh; overflow-y:auto; padding-right:4px;">
        ${htmlCards || '<p style="color:var(--muted); font-size:12px;">Nenhum exercício contabilizado para este treino.</p>'}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

async function sendAdminChatMessage() {
  const input = document.getElementById('adminChatInput');
  const history = document.getElementById('adminChatHistory');
  const text = input.value.trim();

  if (!text) return;

  history.innerHTML += `<div style="background:#20060d; padding:10px; border-radius:8px; font-size:13px; color:#fff; align-self:flex-end;"><b>Você:</b> ${escapeHtml(text)}</div>`;
  input.value = '';
  history.scrollTop = history.scrollHeight;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/chat-ia`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ 
        mensagem: text, 
        contexto: currentStudentData || {}
      })
    });

    const data = await res.json();
    if (res.ok && data.resposta) {
      history.innerHTML += `<div style="background:#150508; padding:10px; border-radius:8px; font-size:13px; color:#fff; align-self:start;"><b>Assistente IA:</b> ${escapeHtml(data.resposta).replace(/\n/g, '<br>')}</div>`;
    } else {
      history.innerHTML += `<div style="color:var(--accent); font-size:12px;"><b>Assistente IA:</b> ${escapeHtml(data.error || 'Assistente indisponível no momento.')}</div>`;
    }
  } catch(e) {
    history.innerHTML += `<div style="color:var(--accent); font-size:12px;">Erro na comunicação com a IA. Verifique sua conexão.</div>`;
  }
  history.scrollTop = history.scrollHeight;
}
