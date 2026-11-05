const BACKEND_URL = "https://consultoria-backend-kbqi.onrender.com";
let currentStudentCode = "";
let currentStudentData = null;
let lastGeneratedPassword = "123456";
let allStudentsList = [];
let chartInstance = null;
let activeDietAbaIndex = 0;
let gifsDatabase = [];
let isentosExpanded = false;   // Controle de abertura da sanfona dos isentos
let pendentesExpanded = false; // Controle de abertura da sanfona dos pendentes

const TUTORIAL_IOS = "https://youtube.com/shorts/AC3qVx1mglc";
const TUTORIAL_ANDROID = "https://youtube.com/shorts/Px4gUAlgR7w";
const CHAVE_PIX_DEFAULT = "5551990169026";

/* -------------------------------------------------------------
   GERENCIAMENTO DE LINKS DE ANAMNESE (VENDAS ONLINE vs ORGÂNICO)
------------------------------------------------------------- */

// Mapeamento completo dos 6 links de anamnese
const LINKS_ANAMNESE_GERADOR = {
  // 1. Integram com o checkout do Asaas no final
  asaas_completa: "https://jhonataconsultoria.com.br/app.html?modo=anamnese",
  asaas_treino: "https://jhonataconsultoria.com.br/app.html?modo=anamnese&tipo=treino",
  
  // 2. Organico / Amigos (Valor a combinar diretamente no Wpp)
  amigos_completa: "https://jhonataconsultoria.com.br/app.html?modo=anamnese&origem=amigos",
  amigos_treino: "https://jhonataconsultoria.com.br/app.html?modo=anamnese&tipo=treino&origem=amigos",
  
  // 3. Dupla / Convidado (Incluso no plano / Parceria)
  dupla_completa: "https://jhonataconsultoria.com.br/app.html?modo=anamnese_convidado&origem=dupla",
  dupla_treino: "https://jhonataconsultoria.com.br/app.html?modo=anamnese_convidado&tipo=treino&origem=dupla"
};

// Função genérica para copiar qualquer uma das 6 opções
function copiarLinkVendaAnamnese(chave) {
  const link = LINKS_ANAMNESE_GERADOR[chave];
  if (link) {
    copiarLinkVenda(link);
  } else {
    showToast("Link não encontrado.", "error");
  }
}

// Retrocompatibilidade para manter chamadas antigas funcionando sem erros
function obterLinkAnamneseOrganico(tipo = 'completa') {
  return tipo === 'treino' ? LINKS_ANAMNESE_GERADOR.amigos_treino : LINKS_ANAMNESE_GERADOR.amigos_completa;
}

function copiarLinkAnamneseOrganico(tipo = 'completa') {
  copiarLinkVendaAnamnese(tipo === 'treino' ? 'amigos_treino' : 'amigos_completa');
}

function obterLinkAnamneseAsaas(tipo = 'completa') {
  return tipo === 'treino' ? LINKS_ANAMNESE_GERADOR.asaas_treino : LINKS_ANAMNESE_GERADOR.asaas_completa;
}

function copiarLinkAnamneseAsaas(tipo = 'completa') {
  copiarLinkVendaAnamnese(tipo === 'treino' ? 'asaas_treino' : 'asaas_completa');
}

function obterLinkAnamnese(tipo = 'completa') {
  return obterLinkAnamneseAsaas(tipo);
}

function copiarLinkAnamnese(tipo = 'completa') {
  copiarLinkAnamneseAsaas(tipo);
}

/* -------------------------------------------------------------
   UTILITÁRIOS E SEGURANÇA
------------------------------------------------------------- */
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
  const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token') || '';
  const cleanToken = String(token).replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '').trim();
  return { 
    'Content-Type': 'application/json', 
    'Authorization': cleanToken ? `Bearer ${cleanToken}` : '' 
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

function parsePreco(valorRaw) {
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

function extrairPrecoAluno(aluno) {
  if (!aluno) return 0;
  const v = aluno.valor_mensalidade ?? 
            aluno.valorMensal ?? 
            aluno.valor ?? 
            aluno.preco ?? 
            aluno.dadosAnamnese?.valor_mensalidade ??
            aluno.payload?.valor_mensalidade ?? 
            aluno.payload?.valorMensal ?? 
            aluno.payload?.valor ?? 
            aluno.payload?.dadosAnamnese?.valor_mensalidade ?? 0;
  return parsePreco(v);
}

function togglePainelLinksAdmin() {
  const conteudo = document.getElementById('conteudoLinksAdmin');
  const seta = document.getElementById('setaPainelLinks');
  if (!conteudo) return;

  const estaOculto = conteudo.classList.toggle('hidden');
  if (seta) seta.textContent = estaOculto ? '▼' : '▲';
}

function copiarLinkVenda(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast("📋 Link copiado com sucesso!", "success");
    }).catch(() => {
      prompt("Copie o link abaixo:", url);
    });
  } else {
    prompt("Copie o link abaixo:", url);
  }
}

function abrirPastaDriveAluno() {
  if (!currentStudentData && !currentStudentCode) {
    return showToast("Selecione um aluno primeiro.", "error");
  }

  const nomeAluno = (currentStudentData && (currentStudentData.clientName || currentStudentData.nome)) || currentStudentCode;
  
  if (currentStudentData && currentStudentData.driveFolderUrl) {
    window.open(currentStudentData.driveFolderUrl, '_blank');
  } else {
    const searchUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(nomeAluno)}`;
    window.open(searchUrl, '_blank');
  }
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
      const gallery = document.getElementById('gifGalleryList');
      if (gallery) gallery.innerHTML = `<div style="color:var(--accent); font-size:12px; grid-column: 1/-1;">Não foi possível carregar a lista de GIFs.</div>`;
    });
}

function renderGifsAdmin(lista) {
  const gallery = document.getElementById('gifGalleryList');
  if (!gallery) return;
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
  const input = document.getElementById('searchGifInput');
  if (!input) return;
  const termo = input.value.toLowerCase();
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
    const el = document.getElementById('editNotasTreinador');
    if (el) currentStudentData.notas_treinador = el.value.trim();
  }
}

async function salvarNotasTreinadorSozinhas() {
  atualizarCampoNotasMemoria();
  if (!currentStudentCode) return showToast("Selecione um aluno primeiro.", "error");
  await salvarAlteracoes();
  showToast("Bloco de notas do treinador salvo!", "success");
}

function calcularDiasRestantes(dataExpiracaoStr, diaVencimentoFallback = 7, isento = false, statusPagamento = '') {
  if (isento === true || statusPagamento === 'isento') {
    return {
      dias: 9999,
      dataFormatada: "Livre (VIP)"
    };
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

  return {
    dias: diffDias,
    dataFormatada: `${diaFmt}/${mesFmt}/${anoFmt}`
  };
}

/* -------------------------------------------------------------
   NAVEGAÇÃO E AUTENTICAÇÃO
------------------------------------------------------------- */
function switchTab(tab) {
  const ids = ['secFinanceiro', 'secContasLucros', 'secResumo', 'secAnamnese', 'secFeedbackAdmin', 'secTreino', 'secDieta', 'secCorrida', 'secErgogenicos', 'secCadastro', 'secNovo', 'secChatAdmin', 'secGifs'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const sidebar = document.getElementById('sidebarConsultoria');
  if (sidebar) sidebar.style.display = 'block';

  if (tab === 'financeiro') {
    const el = document.getElementById('secFinanceiro');
    if (el) el.classList.remove('hidden');
    if (typeof renderTelaFinanceiroExclusiva === 'function') {
      renderTelaFinanceiroExclusiva();
    }
  } else if (tab === 'contasLucros') {
    const el = document.getElementById('secContasLucros');
    if (el) el.classList.remove('hidden');
    if (typeof renderTelaContasELucros === 'function') {
      renderTelaContasELucros();
    }
  } else if (tab === 'resumo') {
    const el = document.getElementById('secResumo');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tab1');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'anamnese') {
    const el = document.getElementById('secAnamnese');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tabAnamnese');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'feedbackAdmin') {
    abrirAbaFeedback();
  } else if (tab === 'treino') {
    const el = document.getElementById('secTreino');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tab2');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'dieta') {
    const el = document.getElementById('secDieta');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tab3');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'corrida') {
    const el = document.getElementById('secCorrida');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tab5');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'ergogenicos') {
    const el = document.getElementById('secErgogenicos');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tabErgogenicos');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'cadastro') {
    const el = document.getElementById('secCadastro');
    if (el) el.classList.remove('hidden');
    const tabBtn = document.getElementById('tab4');
    if (tabBtn) tabBtn.classList.add('active');
  } else if (tab === 'novo') {
    const el = document.getElementById('secNovo');
    if (el) el.classList.remove('hidden');
  } else if (tab === 'chatAdmin') {
    const el = document.getElementById('secChatAdmin');
    if (el) el.classList.remove('hidden');
  } else if (tab === 'gifs') {
    const el = document.getElementById('secGifs');
    if (el) el.classList.remove('hidden');
  }
}

function abrirAbaFeedback() {
  const el = document.getElementById('secFeedbackAdmin');
  if (el) el.classList.remove('hidden');
  const tabBtn = document.getElementById('tabFeedbackAdmin');
  if (tabBtn) tabBtn.classList.add('active');
  renderAdminFeedbackHistory();
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
    const loginScreen = document.getElementById('loginScreen');
    const adminApp = document.getElementById('adminApp');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminApp) adminApp.classList.remove('hidden');
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
  if (container) container.innerHTML = "Carregando...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/alunos/listar`, {
      headers: authHeaders(),
      cache: 'no-cache'
    });
    if (!res.ok) { logoutAdmin(); return; }
    
    const dados = await res.json();
    
    allStudentsList = (dados || []).map(aluno => {
      const precoCalculado = extrairPrecoAluno(aluno);
      return {
        ...aluno,
        senha: aluno.senha || "123456",
        valor_mensalidade: precoCalculado,
        valorMensal: precoCalculado
      };
    });

    renderStudentsList(allStudentsList);

    const secFin = document.getElementById('secFinanceiro');
    if (secFin && !secFin.classList.contains('hidden') && typeof renderTelaFinanceiroExclusiva === 'function') {
      renderTelaFinanceiroExclusiva();
    }

    const secContas = document.getElementById('secContasLucros');
    if (secContas && !secContas.classList.contains('hidden') && typeof renderTelaContasELucros === 'function') {
      renderTelaContasELucros();
    }
  } catch(e) { 
    if (container) container.innerHTML = "<small style='color:var(--accent)'>Erro de comunicação.</small>";
    showToast("Erro de comunicação com o servidor.", "error");
  }
}

function alunoTemFeedbackPendente(aluno) {
  if (!aluno) return false;
  if (aluno.solicitarFeedback === true) return true;
  const feedbacks = aluno.feedbacks || aluno.payload?.feedbacks || [];
  if (feedbacks.length === 0) return false;
  const ultimaMsg = feedbacks[feedbacks.length - 1];
  return ultimaMsg && (ultimaMsg.autor === "ALUNO" || ultimaMsg.autor === "aluno");
}

function toggleSanfonaIsentos() {
  isentosExpanded = !isentosExpanded;
  const boxContainer = document.getElementById('alunosIsentosListContainer');
  const iconSeta = document.getElementById('setaIsentosIcon');
  if (boxContainer) {
    boxContainer.style.display = isentosExpanded ? 'block' : 'none';
  }
  if (iconSeta) {
    iconSeta.textContent = isentosExpanded ? '▲' : '▼';
  }
}

function toggleSanfonaPendentes() {
  pendentesExpanded = !pendentesExpanded;
  const boxContainer = document.getElementById('alunosPendentesListContainer');
  const iconSeta = document.getElementById('setaPendentesIcon');
  if (boxContainer) {
    boxContainer.style.display = pendentesExpanded ? 'block' : 'none';
  }
  if (iconSeta) {
    iconSeta.textContent = pendentesExpanded ? '▲' : '▼';
  }
}

function renderStudentsList(list) {
  const containerPagantes = document.getElementById('alunosList');
  if (!containerPagantes) return;
  
  containerPagantes.innerHTML = "";

  if (!list || list.length === 0) {
    containerPagantes.innerHTML = "<small style='color:var(--muted); font-size:12px;'>Nenhum aluno encontrado.</small>";
    return;
  }

  const checarSeEhIsento = (aluno) => {
    if (!aluno) return false;
    const stPag = String(aluno.status_pagamento || aluno.status || '').toLowerCase();
    const plano = String(aluno.plano || aluno.tipo || '').toLowerCase();
    
    return (
      aluno.isento === true ||
      aluno.isento === 'true' ||
      aluno.payload?.isento === true ||
      stPag === 'isento' ||
      stPag === 'vip' ||
      plano === 'isento' ||
      plano === 'vip'
    );
  };

  const checarSeEhPendente = (aluno) => {
    if (!aluno || checarSeEhIsento(aluno)) return false;
    const info = calcularDiasRestantes(
      aluno.data_expiracao || aluno.payload?.data_expiracao,
      aluno.dia_vencimento || aluno.payload?.dia_vencimento,
      aluno.isento,
      aluno.status_pagamento
    );
    const stPag = String(aluno.status_pagamento || '').toLowerCase();
    return stPag === 'pendente' || info.dias <= 0;
  };

  const alunosIsentos = list.filter(a => checarSeEhIsento(a));
  const alunosPendentes = list.filter(a => checarSeEhPendente(a));
  const alunosPagantes = list.filter(a => !checarSeEhIsento(a) && !checarSeEhPendente(a));

  const criarItemAluno = (aluno) => {
    const ehVIP = checarSeEhIsento(aluno);
    const infoCalculada = calcularDiasRestantes(aluno.data_expiracao, aluno.dia_vencimento, ehVIP, aluno.status_pagamento);
    
    let statusClass = "status-pago";
    let statusText = aluno.status_pagamento || "pago";

    if (ehVIP) {
      statusClass = "status-isento";
      statusText = "ISENTO";
    } else if (statusText === 'pendente' || infoCalculada.dias <= 0) {
      statusClass = "status-pendente";
      statusText = "PENDENTE";
    } else if (infoCalculada.dias <= 5) {
      statusClass = "status-alerta";
    }

    const temPendente = alunoTemFeedbackPendente(aluno);
    const badgePendenteHtml = temPendente ? `<span class="feedback-badge" style="margin-left:4px;">💬 FEEDBACK</span>` : '';
    const valorMensalExibicao = extrairPrecoAluno(aluno);

    const div = document.createElement('div');
    div.className = `student-item ${aluno.codigo === currentStudentCode ? 'active' : ''}`;
    div.innerHTML = `
      <div>
        <b>${escapeHtml(aluno.clientName || aluno.nome)}</b> ${badgePendenteHtml}<br>
        <small style="color:var(--muted)">@${escapeHtml(aluno.codigo)}</small>
        ${valorMensalExibicao > 0 ? `<br><small style="color:var(--gold); font-weight:700;">R$ ${valorMensalExibicao.toFixed(2)}/mês</small>` : '<br><small style="color:var(--gold); font-weight:700;">Preço a combinar</small>'}
      </div>
      <div style="text-align:right;">
        <span class="status-pill ${statusClass}">${escapeHtml(statusText.toUpperCase())}</span>
        <div style="font-size:10px; color:var(--muted); margin-top:3px;">${ehVIP ? 'Livre' : (infoCalculada.dias <= 0 ? 'Vencido' : infoCalculada.dias + 'd restantes')}</div>
      </div>
    `;
    div.onclick = () => {
      document.querySelectorAll('.student-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      carregarAluno(aluno.codigo);
    };
    return div;
  };

  if (alunosPagantes.length === 0) {
    containerPagantes.innerHTML = "<small style='color:var(--muted); font-size:12px;'>Nenhum aluno pagante ativo.</small>";
  } else {
    alunosPagantes.forEach((aluno) => {
      containerPagantes.appendChild(criarItemAluno(aluno));
    });
  }

  let areaAbasExternas = document.getElementById('areaAbasExternasContainer');
  
  if (!areaAbasExternas) {
    areaAbasExternas = document.createElement('div');
    areaAbasExternas.id = 'areaAbasExternasContainer';
    containerPagantes.parentNode.insertBefore(areaAbasExternas, containerPagantes.nextSibling);
  }

  areaAbasExternas.innerHTML = `
    <!-- SANFONA ISENTOS / CORTESIA -->
    <div onclick="toggleSanfonaIsentos()" style="
      margin-top: 14px;
      margin-bottom: 6px;
      padding: 10px;
      background: rgba(220, 170, 58, 0.12);
      border-left: 3px solid var(--gold);
      border-radius: 6px;
      color: var(--gold);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    ">
      <span>👑 ALUNOS ISENTOS / CORTESIA (${alunosIsentos.length})</span>
      <span id="setaIsentosIcon" style="font-size:12px;">${isentosExpanded ? '▲' : '▼'}</span>
    </div>
    <div id="alunosIsentosListContainer" style="display: ${isentosExpanded ? 'block' : 'none'}; margin-bottom: 8px;"></div>

    <!-- SANFONA PENDENTES / EM ATRASO -->
    <div onclick="toggleSanfonaPendentes()" style="
      margin-top: 8px;
      margin-bottom: 6px;
      padding: 10px;
      background: rgba(255, 77, 77, 0.12);
      border-left: 3px solid var(--accent);
      border-radius: 6px;
      color: var(--accent);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    ">
      <span>🚨 ALUNOS PENDENTES / EM ATRASO (${alunosPendentes.length})</span>
      <span id="setaPendentesIcon" style="font-size:12px;">${pendentesExpanded ? '▲' : '▼'}</span>
    </div>
    <div id="alunosPendentesListContainer" style="display: ${pendentesExpanded ? 'block' : 'none'};"></div>
  `;

  const boxIsentos = document.getElementById('alunosIsentosListContainer');
  if (alunosIsentos.length === 0) {
    boxIsentos.innerHTML = `<div style="padding:8px; font-size:12px; color:var(--muted);">Nenhum aluno isento.</div>`;
  } else {
    alunosIsentos.forEach(aluno => boxIsentos.appendChild(criarItemAluno(aluno)));
  }

  const boxPendentes = document.getElementById('alunosPendentesListContainer');
  if (alunosPendentes.length === 0) {
    boxPendentes.innerHTML = `<div style="padding:8px; font-size:12px; color:var(--muted);">Nenhum aluno em atraso! 🎉</div>`;
  } else {
    alunosPendentes.forEach(aluno => boxPendentes.appendChild(criarItemAluno(aluno)));
  }

  if (!currentStudentCode) {
    if (alunosPagantes.length > 0) {
      carregarAluno(alunosPagantes[0].codigo);
    } else if (alunosIsentos.length > 0) {
      carregarAluno(alunosIsentos[0].codigo);
    } else if (alunosPendentes.length > 0) {
      carregarAluno(alunosPendentes[0].codigo);
    }
  }
}

function filterStudents() {
  const term = document.getElementById('searchStudent').value.toLowerCase();
  const filtered = allStudentsList.filter(a => (a.nome || a.clientName || '').toLowerCase().includes(term) || (a.codigo || '').toLowerCase().includes(term));
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

    const infoCalculada = calcularDiasRestantes(currentStudentData.data_expiracao, currentStudentData.dia_vencimento, currentStudentData.isento, currentStudentData.status_pagamento);
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
    if (temFeedback && tabBadge) tabBadge.classList.remove('hidden');
    else if (tabBadge) tabBadge.classList.add('hidden');

    document.getElementById('editName').value = currentStudentData.clientName || '';
    document.getElementById('editStatus').value = stVal;
    document.getElementById('editIsentoCheckbox').checked = currentStudentData.isento === true;
    document.getElementById('editPassword').value = currentStudentData.senha || '123456';
    lastGeneratedPassword = currentStudentData.senha || '123456';

    document.getElementById('editDiaVencimento').value = currentStudentData.isento ? '' : (currentStudentData.dia_vencimento || '');
    
    const inputDataInicio = document.getElementById('editDataInicio');
    if (inputDataInicio) {
      const dtInicioRaw = currentStudentData.data_inicio || currentStudentData.created_at || '';
      inputDataInicio.value = dtInicioRaw ? String(dtInicioRaw).split('T')[0] : '';
    }

    const inputValor = document.getElementById('editValorMensalidade');
    if (inputValor) inputValor.value = extrairPrecoAluno(currentStudentData) || '';

    document.getElementById('editEvolucaoCarga').value = currentStudentData.evolucao_carga_pct || '';
    document.getElementById('editSemanasRotacao').value = currentStudentData.semanas_rotacao || 5;
    document.getElementById('editDataVigencia').value = currentStudentData.data_vigencia || '';

    document.getElementById('editLiberarDieta').checked = currentStudentData.liberarDieta !== false && !currentStudentData.apenasTreino;
    document.getElementById('editLiberarErgogenicos').checked = currentStudentData.liberarErgogenicos === true;

    const pTecnicas = (currentStudentData.pode_alterar_tecnica !== undefined) ? currentStudentData.pode_alterar_tecnica : currentStudentData.permitirTecnicas;
    document.getElementById('editPermitirTecnicas').checked = pTecnicas === true;

    document.getElementById('editTrainerGuidelines').value = currentStudentData.trainer_guidelines || currentStudentData.diretrizes_treinador || '';
    document.getElementById('editCardioGuidelines').value = currentStudentData.cardio_guidelines || currentStudentData.prescricao_cardio || '';
    
    const campoErgo = document.getElementById('editProtocoloErgogenicos');
    if (campoErgo) {
      campoErgo.value = currentStudentData.protocoloErgogenicos || currentStudentData.ergogenicos_texto || '';
    }

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
  if (!list) return;

  const sessoes = (currentStudentData && currentStudentData.historico_sessoes) || [];
  
  if (sessoes.length === 0) {
    list.innerHTML = `<span style="color:var(--muted); font-size:12px;">Nenhuma sessão de treino finalizada pelo aluno ainda.</span>`;
    return;
  }

  const agora = new Date().getTime();
  const limite7DiasMs = 7 * 24 * 60 * 60 * 1000;

  const sessoesValidas7Dias = [];

  sessoes.forEach((sessao, idxOriginal) => {
    const dataSessao = sessao.data ? new Date(sessao.data).getTime() : null;
    const dentroDos7Dias = !dataSessao || (agora - dataSessao <= limite7DiasMs);

    if (dentroDos7Dias) {
      sessoesValidas7Dias.push({
        ...sessao,
        numeroTreino: idxOriginal + 1
      });
    }
  });

  if (sessoesValidas7Dias.length === 0) {
    list.innerHTML = `<span style="color:var(--muted); font-size:12px;">Nenhum relato nos últimos 7 dias.</span>`;
    return;
  }

  let html = `<b style="color:var(--gold); font-size:13px;">📜 Observações dos Últimos 7 Dias:</b><br><br>`;
  const sessoesInvertidas = [...sessoesValidas7Dias].reverse();

  sessoesInvertidas.forEach((sessao) => {
    const dataTreino = sessao.data ? new Date(sessao.data).toLocaleDateString('pt-BR') : 'Data recente';
    const duracao = sessao.duracaoMinutos || 0;
    const obs = sessao.observacoes || [];

    html += `
      <div style="background:#0d0204; border:1px solid var(--border); border-left:3px solid var(--gold); padding:10px; border-radius:8px; margin-bottom:8px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <b style="color:#fff;">🏋️ Treino ${sessao.numeroTreino} — ${escapeHtml(sessao.treinoTitulo || 'Sessão')}</b>
          <span style="color:var(--gold); font-weight:700;">⏱️ ${duracao} min | 📅 ${dataTreino}</span>
        </div>
    `;

    if (obs.length === 0) {
      html += `<div style="color:var(--muted); font-size:11px; margin-top:4px;">Sem observações ou dores relatadas nesta sessão.</div>`;
    } else {
      html += `<ul style="margin-left:16px; margin-top:4px; color:#ff6b7f;">`;
      obs.forEach(o => {
        html += `<li>${escapeHtml(o)}</li>`;
      });
      html += `</ul>`;
    }

    html += `</div>`;
  });

  list.innerHTML = html;
}

async function analisarIncomodosIA() {
  if (!currentStudentData) return showToast("Selecione um aluno primeiro.", "error");

  const sessoes = currentStudentData.historico_sessoes || [];
  const ultimasObs = sessoes.length > 0 ? (sessoes[sessoes.length - 1].observacoes || []) : [];

  const box = document.getElementById('resumoIncomodosIA');
  if (!box) return;

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
    if (!res.ok) throw new Error(data.error || 'Erro no servidor');

    box.innerHTML = `<b>🤖 Análise da IA:</b><br>${escapeHtml(data.resumo || 'Sem recomendações no momento.').replace(/\n/g, '<br>')}`;
  } catch(e) {
    box.innerHTML = `Erro ao conectar com a IA: ${e.message}`;
  }
}

function renderResumoVisaoGeral() {
  const container = document.getElementById('summaryOverviewContainer');
  if (!container) return;
  container.innerHTML = "";

  if (!currentStudentData) {
    container.innerHTML = "<p style='color:var(--muted); font-size:13px;'>Nenhum aluno selecionado.</p>";
    return;
  }

  let htmlTreino = "";
  const days = currentStudentData.days || [];
  if (days.length === 0) {
    htmlTreino = `<p style="color:var(--muted); font-size:12px;">Nenhum treino cadastrado.</p>`;
  } else {
    days.forEach((day) => {
      const isRestDay = /descanso|off|recovery/i.test(day.title);
      htmlTreino += `
        <div style="margin-bottom:8px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
          <b style="color:${isRestDay ? 'var(--blue, #60a5fa)' : 'var(--gold)'};">
            ${isRestDay ? '☕ ' : '🏋️ '}${escapeHtml(day.title)}
          </b>
          <div style="margin-top:4px;">
            ${(day.exercicios || []).map(ex => {
              const safeNome = escapeHtml(ex.nome).replace(/'/g, "\\'");
              const safeSeries = escapeHtml(ex.series).replace(/'/g, "\\'");
              const safeReps = escapeHtml(ex.reps).replace(/'/g, "\\'");
              
              if (isRestDay) {
                return `<div style="font-size:12px; margin-top:3px; padding:3px 6px; color:#fff;">• ${escapeHtml(ex.nome)}</div>`;
              }

              return `
                <div onclick="verEvolucaoSemanal('${safeNome}', '${safeSeries}', '${safeReps}')" 
                     style="cursor:pointer; font-size:12px; margin-top:3px; padding:3px 6px; border-radius:4px; background:rgba(255,255,255,0.03); display:flex; justify-content:space-between; align-items:center;"
                     title="Clique para ver o gráfico de evolução de cargas">
                  <span>📈 <b>${escapeHtml(ex.nome)}</b></span>
                  <span style="color:var(--muted); font-size:11px;">${escapeHtml(ex.series)} (${escapeHtml(ex.reps)})</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
  }

  let htmlDieta = "";
  if (currentStudentData.liberarDieta === false) {
    htmlDieta = `<p style="color:var(--muted); font-size:12px;">Aba Dieta bloqueada no app do aluno.</p>`;
  } else {
    let textoDietaRaw = "";
    const refeicoes = currentStudentData.refeicoes || [];
    if (typeof refeicoes === 'string') {
      textoDietaRaw = refeicoes;
    } else if (Array.isArray(refeicoes)) {
      refeicoes.forEach(ref => {
        textoDietaRaw += typeof ref === 'string' ? `${ref}\n\n` : `${ref.titulo ? ref.titulo + '\n' : ''}${ref.alimentos || ''}\n\n`;
      });
    }

    const { resumoAdminText, suplementos, abas } = parseDietaEstruturada(textoDietaRaw);

    if (!resumoAdminText && suplementos.length === 0 && abas.length === 0) {
      htmlDieta = `<p style="color:var(--muted); font-size:12px;">Nenhuma dieta cadastrada.</p>`;
    } else {
      if (resumoAdminText) {
        htmlDieta += `<div style="margin-bottom:8px; color:var(--gold); font-size:12px;"><b>📊 Metas:</b> ${escapeHtml(resumoAdminText)}</div>`;
      }
      if (suplementos.length > 0) {
        htmlDieta += `<div style="margin-bottom:8px; font-size:12px;"><b>💊 Suplementos:</b> ${suplementos.map(s => escapeHtml(s)).join(', ')}</div>`;
      }
      if (abas.length > 0) {
        abas.forEach(abaObj => {
          htmlDieta += `<div style="margin-top:6px;"><b style="color:var(--gold);">${escapeHtml(abaObj.abaNome)}</b></div>`;
          (abaObj.meals || []).forEach(ref => {
            htmlDieta += `<div style="font-size:12px; margin-left:8px;">🍽️ <b>${escapeHtml(ref.mealTitle)}:</b> ${ref.baseItems.map(i => escapeHtml(i)).join(', ')}</div>`;
          });
        });
      }
    }
  }

  let htmlCardio = "";
  const cardioGuidelines = currentStudentData.cardio_guidelines || currentStudentData.prescricao_cardio || '';
  const prescricao = currentStudentData.prescricao_corrida || {};
  htmlCardio += `<div style="font-size:12px; margin-bottom:6px;"><b>📌 Orientação:</b> ${escapeHtml(cardioGuidelines || 'Sem diretrizes.')}</div>`;

  const diasNomes = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };
  let temSemana = false;
  let semanaHtml = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:6px;">`;
  Object.keys(diasNomes).forEach(d => {
    const p = prescricao[d];
    if (p && (p.km || p.min || p.desc)) {
      temSemana = true;
      semanaHtml += `
        <div style="background:#0d0204; border:1px solid var(--border); padding:6px; border-radius:6px; font-size:11px;">
          <b style="color:var(--blue);">${diasNomes[d]}:</b> ${p.km ? p.km + 'km' : ''} ${p.min ? '| ' + p.min : ''}<br>
          <span style="color:var(--muted);">${escapeHtml(p.desc || '')}</span>
        </div>
      `;
    }
  });
  semanaHtml += `</div>`;
  if (temSemana) htmlCardio += semanaHtml;

  let htmlErgo = "";
  const protocoloTexto = currentStudentData.protocoloErgogenicos || currentStudentData.ergogenicos_texto || '';
  if (protocoloTexto.trim()) {
    htmlErgo = `<div style="font-size:12px; white-space:pre-line; color:#fff;">${escapeHtml(protocoloTexto)}</div>`;
  } else {
    htmlErgo = `<p style="color:var(--muted); font-size:12px;">Nenhum protocolo ergogênico cadastrado.</p>`;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
      <details style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:12px;">
        <summary style="cursor:pointer; font-weight:800; color:var(--gold); font-size:13px; outline:none;">
          🏋️ PROTOCOLO DE TREINAMENTO (CLIQUE PARA EXPANDIR)
        </summary>
        <div style="margin-top:10px; background:#0d0204; padding:10px; border-radius:8px; border:1px solid var(--border);">
          ${htmlTreino}
        </div>
      </details>

      <details style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:12px;">
        <summary style="cursor:pointer; font-weight:800; color:var(--gold); font-size:13px; outline:none;">
          🥗 PLANO ALIMENTAR & METAS (CLIQUE PARA EXPANDIR)
        </summary>
        <div style="margin-top:10px; background:#0d0204; padding:10px; border-radius:8px; border:1px solid var(--border);">
          ${htmlDieta}
        </div>
      </details>

      <details style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:12px;">
        <summary style="cursor:pointer; font-weight:800; color:var(--gold); font-size:13px; outline:none;">
          🏃 PROTOCOLO DE CARDIO & CORRIDA (CLIQUE PARA EXPANDIR)
        </summary>
        <div style="margin-top:10px; background:#0d0204; padding:10px; border-radius:8px; border:1px solid var(--border);">
          ${htmlCardio}
        </div>
      </details>

      <details style="background:#100305; border:1px solid var(--border); border-radius:10px; padding:12px;">
        <summary style="cursor:pointer; font-weight:800; color:var(--gold); font-size:13px; outline:none;">
          💉 PROTOCOLO DE ERGOGÊNICOS (CLIQUE PARA EXPANDIR)
        </summary>
        <div style="margin-top:10px; background:#0d0204; padding:10px; border-radius:8px; border:1px solid var(--border);">
          ${htmlErgo}
        </div>
      </details>
    </div>
  `;
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
      cache: 'no-cache',
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
        contexto: currentStudentData || {}
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao processar resposta da IA.');

    if (data.resposta) {
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
    showToast(`Erro IA Cardio: ${e.message}`, "error");
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

async function gerarProtocoloErgogenicosIA() {
  if (!currentStudentCode || !currentStudentData) return showToast("Selecione um aluno primeiro.", "error");

  const prompt = document.getElementById('aiErgogenicosPromptAdmin').value.trim();
  const btn = document.getElementById('btnGerarErgoIA');
  const txtOriginal = btn.textContent;

  btn.textContent = "⏳ IA Montando...";
  btn.disabled = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/chat-ia`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({
        mensagem: `Você é um preparador físico e especialista em fisiologia do exercício e recursos ergogênicos.
Monte um protocolo detalhado de ergogênicos, posologia, horários de aplicação e protetores de saúde (hepáticos, lipídicos, cardiovascular) com base no pedido.
Prompt do treinador: "${prompt || 'Protocolo ergogênico estruturado e seguro'}".
Retorne o texto formatado e direto, sem formatações estranhas.`,
        contexto: currentStudentData || {}
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao processar resposta da IA.');

    if (data.resposta) {
      document.getElementById('editProtocoloErgogenicos').value = data.resposta.trim();
      showToast("Protocolo de ergogênicos gerado via IA!", "success");
    } else {
      showToast("Erro ao processar resposta da IA.", "error");
    }
  } catch (e) {
    showToast(`Erro IA Ergogênicos: ${e.message}`, "error");
  } finally {
    btn.textContent = txtOriginal;
    btn.disabled = false;
  }
}

async function salvarProtocoloErgogenicos() {
  if (!currentStudentCode || !currentStudentData) return showToast("Selecione um aluno primeiro.", "error");

  const textoProtocolo = document.getElementById('editProtocoloErgogenicos').value.trim();
  
  currentStudentData.protocoloErgogenicos = textoProtocolo;
  currentStudentData.ergogenicos_texto = textoProtocolo;
  currentStudentData.liberarErgogenicos = true;

  const chkErgo = document.getElementById('editLiberarErgogenicos');
  if (chkErgo) chkErgo.checked = true;

  await salvarAlteracoes();
  showToast("Protocolo de ergogênicos salvo com sucesso!", "success");
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
2. Série de Reconhecimento (Feeder Set)
3. PAP / Ativação Neural (Ramp-up)
4. Séries de Trabalho (Working Sets)

REGRAS DE FORMATO:
- NUNCA use o caractere asterisco (*).
- NUNCA fale sobre dieta ou suplementos.

--- FICHA DE TREINO ATUAL ---
${treinoAtualTexto}`,
        contexto: currentStudentData || {}
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar diretrizes.');

    if (data.resposta) {
      let textoLimpo = data.resposta.replace(/\*/g, '').trim();
      document.getElementById('editTrainerGuidelines').value = textoLimpo;
      showToast("Diretrizes geradas!", "success");
    } else {
      showToast(data.error || "Não foi possível gerar as diretrizes.", "error");
    }
  } catch (e) {
    showToast(`Erro IA Diretrizes: ${e.message}`, "error");
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
        contexto: currentStudentData || {}
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha ao executar alteração na ficha.');

    if (data.resposta) {
      let textoFinal = "";
      try {
        const jsonMatch = data.resposta.match(/\{[\s\S]*"workout_text"[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : data.resposta;
        const parsedRes = JSON.parse(jsonString.replace(/```json/g, '').replace(/```/g, ''));
        textoFinal = parsedRes.workout_text || data.resposta;
      } catch (errJson) {
        textoFinal = data.resposta.replace(/```json/g, '').replace(/```/g, '').replace(/^\{\s*"workout_text"\s*:\s*"/, '').replace(/"\s*\}$/, '');
      }

      if (textoFinal) {
        tx.value = textoFinal.trim();
        lidarEdicaoTreino();
        input.value = "";
        showToast("Ficha atualizada pela IA!", "success");
      }
    } else {
      showToast(data.error || "Erro ao alterar ficha.", "error");
    }
  } catch(e) {
    showToast(`Erro IA Treino: ${e.message}`, "error");
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
  const senha = lastGeneratedPassword || currentStudentData.senha || "123456";
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
  if (!list) return;
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

  if (!currentStudentData) {
    div.innerHTML = `<p style="color:var(--muted); font-size:13px;">Selecione um aluno para exibir os dados da anamnese.</p>`;
    return;
  }

  const a = currentStudentData.dadosAnamnese || currentStudentData.anamnese || currentStudentData;
  const getVal = (val) => (val && String(val).trim() !== '' && String(val).trim() !== 'undefined') ? String(val).trim() : 'Não informado';
  const ehApenasTreino = currentStudentData.apenasTreino === true || currentStudentData.liberarDieta === false;

  let htmlAnamnese = `
    <div class="anamnese-container" style="display:flex; flex-direction:column; gap:16px;">
      
      <div class="anamnese-card" style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <div class="anamnese-card-title" style="font-size:12px; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
          👤 DADOS PESSOAIS & PERFIL FÍSICO
        </div>
        <div class="anamnese-questions-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Nome Completo</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.nome || a.clientName || currentStudentData.clientName))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Idade / Nascimento</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.idade))} ${a.idade ? 'anos' : ''} (${escapeHtml(getVal(a.nascimento))})</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">WhatsApp / Telefone</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.telefone || a.whatsapp))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">E-mail</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.email))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">CPF</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.cpf))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Peso & Altura</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.peso))} kg | ${escapeHtml(getVal(a.altura))} cm</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px; grid-column: 1 / -1;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Objetivo Principal</div>
            <div class="anamnese-a" style="font-size:13px; color:var(--gold); font-weight:800;">🎯 ${escapeHtml(getVal(a.objetivo || a.objetivoPrincipal))}</div>
          </div>
        </div>
      </div>

      <div class="anamnese-card" style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <div class="anamnese-card-title" style="font-size:12px; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
          🏋️ ROTINA DE TREINO & LOGÍSTICA
        </div>
        <div class="anamnese-questions-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Experiência / Tempo de Prática</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.tempoTreino || a.experiencia))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Frequência Semanal</div>
            <div class="anamnese-a" style="font-size:13px; color:var(--green); font-weight:800;">📅 ${escapeHtml(getVal(a.diasSemana || a.diasDisponiveis))} dias por semana</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px; grid-column: 1 / -1;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Dias Preferenciais</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:700;">📆 ${escapeHtml(getVal(a.preferenciaDias || a.diasTreino))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Duração da Sessão</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.tempoTreinoMin || a.horasTreino))} minutos</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Intervalo de Descanso</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.tempoDescanso))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px; grid-column: 1 / -1;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Outras Atividades Físicas</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.outrasAtividades || a.outrosEsportes))}</div>
          </div>
        </div>
      </div>

      <div class="anamnese-card" style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <div class="anamnese-card-title" style="font-size:12px; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
          🏥 SAÚDE & LESÕES
        </div>
        <div class="anamnese-questions-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px; grid-column: 1 / -1;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Lesões ou Dores</div>
            <div class="anamnese-a" style="font-size:13px; color:var(--accent); font-weight:800;">🚨 ${escapeHtml(getVal(a.lesoes || a.dores))}</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px; grid-column: 1 / -1;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Doenças Prévias / Condições Médicas</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.doencas || a.patologias))}</div>
          </div>
        </div>
      </div>
  `;

  if (!ehApenasTreino) {
    htmlAnamnese += `
      <div class="anamnese-card" style="background:#100305; border:1px solid var(--border); border-radius:12px; padding:16px;">
        <div class="anamnese-card-title" style="font-size:12px; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:12px; border-bottom:1px dashed var(--border); padding-bottom:6px;">
          🥗 HÁBITOS ALIMENTARES
        </div>
        <div class="anamnese-questions-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Refeições Diárias</div>
            <div class="anamnese-a" style="font-size:13px; color:#fff; font-weight:600;">${escapeHtml(getVal(a.numRefeicoes || a.refeicoesDia))} refeições</div>
          </div>
          <div class="anamnese-item" style="background:#0d0204; border:1px solid var(--border); border-radius:8px; padding:10px; grid-column: 1 / -1;">
            <div class="anamnese-q" style="font-size:11px; color:var(--muted); font-weight:700; text-transform:uppercase;">Alimentos Odiados</div>
            <div class="anamnese-a" style="font-size:13px; color:#ff6b7f; font-weight:700;">🚫 ${escapeHtml(getVal(a.alimentosOdiados || a.restricoes))}</div>
          </div>
        </div>
      </div>
    `;
  }

  htmlAnamnese += `</div>`;
  div.innerHTML = htmlAnamnese;
}

function renderAdminFeedbackHistory() {
  const history = document.getElementById('adminFeedbackHistory');
  if (!history) return;
  history.innerHTML = '';

  const feedbacks = (currentStudentData && (currentStudentData.feedbacks || currentStudentData.payload?.feedbacks)) || [];

  if (feedbacks.length === 0) {
    history.innerHTML = '<div style="color:var(--muted); font-size:12px; text-align:center; padding:20px;">Nenhum feedback enviado por este aluno ainda.</div>';
    return;
  }

  feedbacks.forEach(f => {
    const isAluno = f.autor === "ALUNO" || f.autor === "aluno";
    let htmlFotos = '';

    if (f.fotos && f.fotos.length > 0) {
      htmlFotos = '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">';
      f.fotos.forEach((url, idx) => {
        htmlFotos += `<a href="${url}" target="_blank" style="background:var(--gold); color:#000; font-size:10px; padding:4px 8px; border-radius:4px; text-decoration:none; font-weight:800;">🖼️ Foto ${idx + 1} no Drive</a>`;
      });
      htmlFotos += '</div>';
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = `
      background: ${isAluno ? '#1a050b' : '#100305'}; 
      padding: 10px 12px; 
      border-radius: 8px; 
      font-size: 12.5px; 
      color: #fff; 
      align-self: ${isAluno ? 'flex-start' : 'flex-end'}; 
      border: 1px solid ${isAluno ? 'var(--accent)' : 'var(--gold)'}; 
      max-width: 85%;
      margin-bottom: 8px;
    `;

    msgDiv.innerHTML = `
      <b style="color:${isAluno ? 'var(--accent)' : 'var(--gold)'}">${isAluno ? 'Aluno' : 'Você (Personal)'}:</b> ${escapeHtml(f.mensagem)}
      ${htmlFotos}
    `;

    history.appendChild(msgDiv);
  });
  history.scrollTop = history.scrollHeight;
}

async function responderFeedbackAdmin() {
  const input = document.getElementById('adminFeedbackInput');
  if (!input) return;

  const msg = input.value.trim();
  if (!msg) return showToast("Digite uma mensagem antes de responder.", "error");
  if (!currentStudentCode) return showToast("Selecione um aluno primeiro.", "error");

  try {
    const res = await fetch(`${BACKEND_URL}/api/feedback/enviar`, {
      method: 'POST',
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ 
        codigo: currentStudentCode, 
        autor: "PERSONAL", 
        mensagem: msg 
      })
    });

    const data = await res.json();
    if (res.ok && data.feedbacks) {
      currentStudentData.feedbacks = data.feedbacks;
    } else {
      if (!currentStudentData.feedbacks) currentStudentData.feedbacks = [];
      currentStudentData.feedbacks.push({ 
        autor: "PERSONAL", 
        mensagem: msg, 
        data: new Date().toISOString() 
      });
    }

    input.value = '';
    renderAdminFeedbackHistory();
    
    const tabBadge = document.getElementById('tabFeedbackBadge');
    if (tabBadge) tabBadge.classList.add('hidden');
    
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
  if (!tx) return;
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
      if (day.isDescanso) {
        text += `${ex.nome}\n`;
      } else {
        text += `${ex.nome} ${ex.series} (${ex.reps})\n`;
      }
    });
    text += "\n";
  });

  tx.value = text.trim();
  atualizarPreviewAoVivo();
}

function atualizarPreviewAoVivo() {
  const tx = document.getElementById('liveWorkoutText');
  const container = document.getElementById('liveWorkoutPreview');
  if (!tx || !container) return;

  const raw = tx.value;
  const parsedDays = parseWorkoutText(raw);

  container.innerHTML = "";
  if (parsedDays.length === 0) {
    container.innerHTML = `<div style="background:#20050c; border:1px solid var(--accent); padding:10px; border-radius:8px; color:#ff6b7f; font-size:12px;">⚠️ Nenhum treino reconhecido. Digite divisões claras.</div>`;
    return;
  }

  parsedDays.forEach(day => {
    const isRestDay = day.isDescanso || /descanso|off|recovery/i.test(day.title);

    let html = `
      <div style="margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px; ${isRestDay ? 'border-left:3px solid var(--blue, #60a5fa); padding-left:8px; background:rgba(96,165,250,0.05); border-radius:6px;' : ''}">
        <b style="color:${isRestDay ? 'var(--blue, #60a5fa)' : 'var(--gold)'}; font-size:13px;">
          ${isRestDay ? '☕ ' : '🏋️ '}${escapeHtml(day.title)}
        </b><br>
    `;
    
    day.exercicios.forEach(ex => {
      if (isRestDay) {
        html += `<div style="font-size:12px; margin-top:4px; color:#fff;">• ${escapeHtml(ex.nome)}</div>`;
      } else {
        const isTecnico = ex.isTecnico ? `<span style="color:var(--accent); font-weight:700;"> [${escapeHtml(ex.tecnicaTipo)}]</span>` : '';
        const gifBadge = ex.gifUrl ? ` <span style="font-size:10px; color:var(--green); font-weight:700;">🎥 GIF</span>` : '';
        
        const safeNome = escapeHtml(ex.nome).replace(/'/g, "\\'");
        const safeSeries = escapeHtml(ex.series).replace(/'/g, "\\'");
        const safeReps = escapeHtml(ex.reps).replace(/'/g, "\\'");

        html += `
          <div onclick="verEvolucaoSemanal('${safeNome}', '${safeSeries}', '${safeReps}')" 
               style="cursor:pointer; font-size:12px; margin-top:4px; padding:4px 6px; border-radius:6px; background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;"
               title="Clique para ver evolução de cargas">
            <span>📈 <b>${escapeHtml(ex.nome)}</b>${isTecnico}${gifBadge}</span>
            <span style="color:var(--muted); font-weight:700;">${escapeHtml(ex.series)} (${escapeHtml(ex.reps)})</span>
          </div>
        `;
      }
    });

    html += `</div>`;
    container.innerHTML += html;
  });
}

window.verEvolucaoSemanal = async function(nomeEx, seriesStr = '', repsStr = '') {
  const chartModal = document.getElementById('chartModal');
  const chartExName = document.getElementById('chartExName');
  const chartExMeta = document.getElementById('chartExMeta');
  
  if (!chartModal) {
    showToast("Estrutura do modal #chartModal não foi encontrada no DOM.", "error");
    return;
  }

  if (chartExName) chartExName.textContent = nomeEx;
  if (chartExMeta) chartExMeta.textContent = seriesStr ? `Meta: ${seriesStr} (${repsStr})` : '';

  const weeklyLogs = (currentStudentData && currentStudentData.weekly_logs) || {};
  const dailyLogs = (currentStudentData && currentStudentData.logs) || {};
  
  const keyEx = sanitizeExKey(nomeEx);
  let historicoSemanal = (weeklyLogs[keyEx] || []).slice(-6);

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
      historicoSemanal = [{ data: 'Sessão Recente', cargaMax: maxC, repsMed: rMed, tecnica: 'Log Diário' }];
    }
  }

  const logsDetailList = document.getElementById('logsDetailList');
  let html = "<b>Progresso de Cargas e Repetições:</b><br>";
  let cargasValidas = [];
  let repsValidas = [];

  if (historicoSemanal.length === 0) {
    html += `<div style="margin-top:8px; color:var(--muted); font-size:12px;">Nenhum registro de carga salvo para este exercício até o momento.</div>`;
    const boxIA = document.getElementById('aiProgressInsight');
    if (boxIA) boxIA.classList.add('hidden');
  } else {
    historicoSemanal.forEach((reg, idx) => {
      const cargaVal = reg.cargaMax || reg.carga || 0;
      const repsVal = reg.repsMed || reg.reps || '-';
      html += `
        <div style="margin-top:6px; background:#100305; padding:8px 10px; border-radius:8px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
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

    if (typeof gerarAnaliseIAProgresso === 'function') {
      gerarAnaliseIAProgresso(nomeEx, historicoSemanal);
    }
  }

  if (logsDetailList) logsDetailList.innerHTML = html;
  chartModal.classList.remove('hidden');

  renderChartDuplo(cargasValidas, repsValidas);
};

async function gerarAnaliseIAProgresso(nomeEx, historicoLogs) {
  const boxIA = document.getElementById('aiProgressInsight');
  const textIA = document.getElementById('aiInsightText');

  if (!boxIA || !textIA) return;

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
  const canvas = document.getElementById('progressChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
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

window.closeChartModal = function() {
  const modal = document.getElementById('chartModal');
  if (modal) modal.classList.add('hidden');
};

function loadDietView() {
  const tx = document.getElementById('dietTextarea');
  if (!tx) return;

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

        return;
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
  const tx = document.getElementById('dietTextarea');
  const filtersEl = document.getElementById('dietPreviewFilters');
  const listEl = document.getElementById('dietPreviewList');

  if (!tx || !filtersEl || !listEl) return;

  const raw = tx.value;
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
  if (!currentStudentData) return;

  const precoDigitado = parsePreco(document.getElementById('editValorMensalidade').value);
  const dataInicioDigitada = document.getElementById('editDataInicio').value;

  currentStudentData.clientName = document.getElementById('editName').value.trim();
  currentStudentData.valor_mensalidade = precoDigitado;
  currentStudentData.valorMensal = precoDigitado;
  
  if (dataInicioDigitada) {
    currentStudentData.data_inicio = dataInicioDigitada;
    currentStudentData.created_at = dataInicioDigitada;
  }

  const isentoVal = document.getElementById('editIsentoCheckbox').checked;
  currentStudentData.isento = isentoVal;

  if (isentoVal) {
    currentStudentData.status_pagamento = 'pago'; 
    currentStudentData.dia_vencimento = null;
    currentStudentData.data_expiracao = '2099-12-31';
  } else {
    currentStudentData.status_pagamento = document.getElementById('editStatus').value;
    
    const campoDia = document.getElementById('editDiaVencimento').value.trim();
    const novoDia = campoDia ? parseInt(campoDia) : 7;
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
  }

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
  currentStudentData.senha = newPass || currentStudentData.senha || "123456";
  lastGeneratedPassword = currentStudentData.senha;

  await salvarAlteracoes();
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

      const idx = allStudentsList.findIndex(a => a.codigo === currentStudentCode);
      if (idx !== -1) {
        const preco = extrairPrecoAluno(currentStudentData);
        allStudentsList[idx] = {
          ...allStudentsList[idx],
          ...currentStudentData,
          valor_mensalidade: preco,
          valorMensal: preco
        };
      }

      await fetchAlunos();
      await carregarAluno(currentStudentCode);
    } else {
      showToast("Erro ao salvar dados no servidor.", "error");
    }
  } catch(e) { 
    showToast("Erro de conexão ao salvar no servidor.", "error"); 
  }
}

function parseWorkoutText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n');
  const days = [];
  let currentDay = null;

  let globalSeries = "3";
  let globalReps = "8-10";

  const divKeywords = ['upper', 'lower', 'torso', 'limbs', 'fullbody', 'push', 'pull', 'legs', 'anterior', 'posterior', 'treino', 'dia', 'descanso', 'off', 'recovery'];

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
    const isShortHeader = /^(treino\s*[a-z0-9]+|dia\s*[a-z0-9]+|[a-z]\b|descanso|off|recovery)/i.test(cleanLowerNoBullets) && !/(x|×|\d+x)/i.test(cleanLine);

    if (hasDivKeyword || isShortHeader) isDayHeader = true;

    if (isDayHeader) {
      const isDescanso = /descanso|off|recovery/i.test(cleanLowerNoBullets);
      currentDay = { 
        title: cleanLine.toUpperCase().replace(/^[•\-\*\s]+/, ''), 
        isDescanso: isDescanso,
        exercicios: [] 
      };
      days.push(currentDay);
    } else {
      if (!currentDay) {
        currentDay = { title: "TREINO A", isDescanso: false, exercicios: [] };
        days.push(currentDay);
      }

      let name = cleanLine.replace(/^[•\-\*\d\.\s]+/, '').trim();

      if (currentDay.isDescanso) {
        currentDay.exercicios.push({
          nome: name,
          series: "",
          reps: "",
          tecnica: "convencional",
          isTecnico: false
        });
        return;
      }

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

/* -------------------------------------------------------------
   SALVAMENTO E CRIAÇÃO DE ALUNOS COM SENHA 123456
------------------------------------------------------------- */
async function salvarNovoAlunoBloco() {
  const nome = document.getElementById('newName').value.trim();
  const codigo = document.getElementById('newCode').value.trim().toLowerCase();
  const rawW = document.getElementById('rawWorkout').value.trim();
  const rawD = document.getElementById('rawDiet').value.trim();
  const inputDataInicio = document.getElementById('newDataInicio').value;
  
  const valorMensal = parsePreco(document.getElementById('newValorMensalidade').value);

  if (!nome || !codigo) return showToast("Preencha Nome e Código.", "error");

  const parsedDays = parseWorkoutText(rawW);

  const hoje = new Date();
  const dataInicioFinal = inputDataInicio || hoje.toISOString().split('T')[0];

  hoje.setDate(hoje.getDate() + 30);
  
  const anoFmt = hoje.getFullYear();
  const mesFmt = String(hoje.getMonth() + 1).padStart(2, '0');
  const diaFmt = String(hoje.getDate()).padStart(2, '0');

  // Senha padrão inicial fixada em 123456 para novos cadastros
  const senhaPadrao = "123456";

  const payload = {
    clientName: nome,
    senha: senhaPadrao,
    status_pagamento: 'pago',
    isento: false,
    dia_vencimento: hoje.getDate(),
    data_inicio: dataInicioFinal,
    created_at: dataInicioFinal,
    data_expiracao: `${anoFmt}-${mesFmt}-${diaFmt}`,
    valor_mensalidade: valorMensal,
    valorMensal: valorMensal,
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
    protocoloErgogenicos: "",
    logs: {},
    weekly_logs: {},
    days: parsedDays.length > 0 ? parsedDays : [{ title: "TREINO A", isDescanso: false, exercicios: [] }],
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
      lastGeneratedPassword = senhaPadrao;
      showToast(`Aluno criado! Senha padrão: ${senhaPadrao}`, "success");
      await fetchAlunos();
      switchTab('financeiro');
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
    if (day.isDescanso) return;

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
  if (!input || !history) return;

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
