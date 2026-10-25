const BACKEND_URL = "https://consultoria-backend-kbqi.onrender.com";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxR_uk51E_dUevVLAKiu1bF7jZ2SSG3aIQXksjY_a_V5sy9qnO0NqLzJA78Lz_GrGIU/exec";

// Mapeamento dos 12 Links de Checkout do Asaas (Divididos entre PIX e Cartão Recorrente)
const CHECKOUT_LINKS = {
  // 1. Consultoria Completa (3 Meses)
  COMPLETA_TRIMESTRAL: {
    cartao: "https://www.asaas.com/000/c/lvfk6qle0ufq0t57", // R$ 120/mês Recorrente
    pix:    "https://www.asaas.com/000/c/k9pnu5cry59ts60b"  // R$ 330 à vista
  },

  // 2. Consultoria Completa (6 Meses)
  COMPLETA_SEMESTRAL: {
    cartao: "https://www.asaas.com/000/c/oky8it88u28d4vat", // R$ 110/mês Recorrente
    pix:    "https://www.asaas.com/000/c/vmplvn41acefxh6q"  // R$ 600 à vista
  },

  // 3. Consultoria Completa (Anual)
  COMPLETA_ANUAL: {
    cartao: "https://www.asaas.com/000/c/5gd9tb7c0szjdwbd", // R$ 85/mês Recorrente
    pix:    "https://www.asaas.com/000/c/d3g2zgxzvigjnpam"  // R$ 900 à vista
  },

  // 4. Apenas Treino (Anual)
  TREINO_ANUAL: {
    cartao: "https://www.asaas.com/000/c/v36oz63i4jg0cg2u", // R$ 55/mês Recorrente
    pix:    "https://www.asaas.com/000/c/3rzicld44lby9g6b"  // R$ 540 à vista
  },

  // 5. Consultoria Completa Dupla (Anual)
  COMPLETA_DUPLA: {
    cartao: "https://www.asaas.com/000/c/z4zlsoe009fz8tgu", // R$ 140/mês Recorrente
    pix:    "https://www.asaas.com/000/c/52mqr2awi4hzl61n"  // R$ 1.560 à vista
  },

  // 6. Consultoria Apenas Treino Dupla (Anual)
  TREINO_DUPLA: {
    cartao: "https://www.asaas.com/000/c/omsltaq25btnizvo", // R$ 90/mês Recorrente
    pix:    "https://www.asaas.com/000/c/ke2r2emle6sfnmif"  // R$ 960 à vista
  }
};

const DETALHES_PLANOS = {
  'COMPLETA_ANUAL': { valor: 'R$ 85,00/mês no Cartão Recorrente ou R$ 900,00 no PIX', sub: 'Acompanhamento completo individual com treino + dieta.' },
  'COMPLETA_SEMESTRAL': { valor: 'R$ 110,00/mês no Cartão Recorrente ou R$ 600,00 no PIX', sub: 'Protocolo completo semestral com suporte contínuo.' },
  'COMPLETA_TRIMESTRAL': { valor: 'R$ 120,00/mês no Cartão Recorrente ou R$ 330,00 no PIX', sub: 'Acompanhamento trimestral focado em metas rápidas.' },
  'COMPLETA_DUPLA': { valor: 'R$ 140,00/mês no Cartão Recorrente ou R$ 1.560,00 no PIX', sub: 'Plano em Dupla: apenas R$ 70,00 por mês para cada pessoa.' },
  'TREINO_ANUAL': { valor: 'R$ 55,00/mês no Cartão Recorrente ou R$ 540,00 no PIX', sub: 'Ficha de treino contínua individual com ajuste de cargas.' },
  'TREINO_DUPLA': { valor: 'R$ 90,00/mês no Cartão Recorrente ou R$ 960,00 no PIX', sub: 'Apenas R$ 45,00 por mês por pessoa para treinar em dupla.' }
};

let currentData = null;
let loggedUserCode = "";
let autoSaveTimer = null;
let currentTreinoDayIdx = 0;
let activeAlunoDietAbaIndex = null;
let isApenasTreinoMode = false;
let isConvidadoDuplaMode = false;

let workoutTimerInterval = null;
let workoutTimerRunning = false;
let selectedFeedbackFiles = [];

// ==========================================
// FUNÇÃO DE INTEGRAÇÃO COM GOOGLE DRIVE
// ==========================================
async function enviarArquivoParaGoogleDrive(nomeAluno, file, customFileName) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const reader = new FileReader();
    reader.onload = async function() {
      const base64String = reader.result.split(',')[1];

      const payload = {
        nome: nomeAluno,
        fileName: customFileName || file.name,
        mimeType: file.type,
        fileData: base64String
      };

      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
          resolve(result.url);
        } else {
          console.error("Erro no Apps Script:", result.error);
          resolve(null);
        }
      } catch (err) {
        console.error("Erro ao enviar arquivo para o Drive:", err);
        resolve(null);
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function mascaraDataNascimento(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  
  if (v.length > 4) {
    input.value = `${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`;
  } else if (v.length > 2) {
    input.value = `${v.slice(0,2)}/${v.slice(2)}`;
  } else {
    input.value = v;
  }
}

function sanitizeExKey(nome) {
  if (!nome) return "ex";
  return nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

function atualizarResumoPrecoAnamnese() {
  const plano = document.getElementById('anamTipoConsultoria').value;
  const info = DETALHES_PLANOS[plano] || { valor: 'Consulte o plano', sub: '' };
  const elValor = document.getElementById('resumoPlanoValor');
  const elSub = document.getElementById('resumoPlanoSub');
  if (elValor) elValor.textContent = info.valor;
  if (elSub) elSub.textContent = info.sub;
}

function abrirModalIndique() { document.getElementById('modalIndique').classList.remove('hidden'); }
function fecharModalIndique() { document.getElementById('modalIndique').classList.add('hidden'); }
function abrirModalSenha() { document.getElementById('modalSenha').classList.remove('hidden'); }
function fecharModalSenha() { document.getElementById('modalSenha').classList.add('hidden'); }

function compartilharIndicaoWpp() {
  const nome = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;
  const msg = `*CONSULTORIA JHONATA PERSONAL*%0A%0AOlá! Estou treinando com a consultoria do Jhonata Personal e recomendo demais. Acesse o link para conhecer e fazer sua anamnese:%0Ahttps://jhonataconsultoria.com.br/app.html?modo=anamnese%0A%0A_Indicação do aluno: ${nome}_`;
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

async function alterarSenhaAlunoModal() {
  const novaSenha = document.getElementById('alunoNovaSenhaModal').value.trim();
  if (!novaSenha) return alert("Digite uma nova senha.");

  currentData.senha = novaSenha;

  try {
    const res = await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: "POST",
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });

    if (res.ok) {
      alert("Senha alterada com sucesso.");
      document.getElementById('alunoNovaSenhaModal').value = "";
      fecharModalSenha();
    }
  } catch (e) {
    alert("Erro ao alterar senha.");
  }
}

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function obterDiaSemanaNormalizado() {
  const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  return dias[new Date().getDay()];
}

function obterNomeDiaSemanaFormatado() {
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return dias[new Date().getDay()];
}

function calcularPaceTexto(kmNum, minNum) {
  const km = parseFloat(kmNum) || 0;
  const min = parseFloat(minNum) || 0;
  if (km <= 0 || min <= 0) return "--'--\"";
  const paceFloat = min / km;
  const paceMin = Math.floor(paceFloat);
  const paceSec = Math.round((paceFloat - paceMin) * 60);
  return `${paceMin}'${paceSec < 10 ? '0' : ''}${paceSec}"`;
}

let restTimerInterval = null;
let restSecondsLeft = 0;
let audioCtx = null;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playBipSound() {
  try {
    initAudioContext();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch(e){}
}

function startRestTimer(seconds) {
  initAudioContext();
  if (restTimerInterval) clearInterval(restTimerInterval);
  restSecondsLeft = seconds;

  const widget = document.getElementById('restTimerWidget');
  if (widget) widget.classList.remove('timer-finished-glow');

  updateTimerDisplay();

  restTimerInterval = setInterval(() => {
    restSecondsLeft--;
    updateTimerDisplay();

    if (restSecondsLeft <= 0) {
      clearInterval(restTimerInterval);
      if (widget) widget.classList.add('timer-finished-glow');
      playBipSound();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      setTimeout(() => {
        if (widget) widget.classList.remove('timer-finished-glow');
      }, 5000);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  if (!display) return;
  const m = Math.floor(restSecondsLeft / 60);
  const s = restSecondsLeft % 60;
  display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function checkAndRestoreWorkoutTimer() {
  const keyStart = `workout_start_time_${loggedUserCode}`;
  const startTimeStr = localStorage.getItem(keyStart);
  const btn = document.getElementById('btnWorkoutTimer');

  if (startTimeStr) {
    workoutTimerRunning = true;
    if (btn) {
      btn.textContent = "⏹️ PAUSAR";
      btn.style.background = "var(--signal-light)";
    }
    setInputsLockState(false);

    if (workoutTimerInterval) clearInterval(workoutTimerInterval);
    workoutTimerInterval = setInterval(updateWorkoutTimerDisplay, 1000);
    updateWorkoutTimerDisplay();
  } else {
    workoutTimerRunning = false;
    if (btn) {
      btn.textContent = "▶ INICIAR TREINO";
      btn.style.background = "var(--good)";
    }
    setInputsLockState(true);
    const clock = document.getElementById('workoutTimerClock');
    if (clock) clock.textContent = "00:00:00";
  }
}

function setInputsLockState(locked) {
  document.querySelectorAll('.input-log, .btn-check-serie, .btn-check-exercise').forEach(el => {
    el.disabled = locked;
  });
}

function toggleWorkoutTimer() {
  const btn = document.getElementById('btnWorkoutTimer');
  const keyStart = `workout_start_time_${loggedUserCode}`;

  if (!workoutTimerRunning) {
    workoutTimerRunning = true;
    const startTime = Date.now();
    localStorage.setItem(keyStart, startTime.toString());

    if (btn) {
      btn.textContent = "⏹️ PAUSAR";
      btn.style.background = "var(--signal-light)";
    }

    setInputsLockState(false);

    if (workoutTimerInterval) clearInterval(workoutTimerInterval);
    workoutTimerInterval = setInterval(updateWorkoutTimerDisplay, 1000);
    updateWorkoutTimerDisplay();
  } else {
    workoutTimerRunning = false;
    localStorage.removeItem(keyStart);
    if (workoutTimerInterval) clearInterval(workoutTimerInterval);

    if (btn) {
      btn.textContent = "▶ INICIAR TREINO";
      btn.style.background = "var(--good)";
    }

    setInputsLockState(true);
  }
}

function updateWorkoutTimerDisplay() {
  const keyStart = `workout_start_time_${loggedUserCode}`;
  const startTimeStr = localStorage.getItem(keyStart);
  const clock = document.getElementById('workoutTimerClock');

  if (!startTimeStr) {
    if (clock) clock.textContent = "00:00:00";
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - parseInt(startTimeStr)) / 1000);
  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = elapsedSeconds % 60;

  const fmt = n => String(n).padStart(2, '0');
  if (clock) clock.textContent = `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
}

function aplicarCargaBackoff(keyInput, valorCarga, dayIdx, exIdx) {
  if (!workoutTimerRunning) {
    alert("⚠️ Clique em '▶ INICIAR TREINO' para registrar cargas!");
    return;
  }
  const el = document.getElementById(`input_${keyInput}`);
  if (el) el.value = valorCarga;
  scheduleAutoSave(keyInput, String(valorCarga), dayIdx, exIdx);
}

function authHeaders() {
  const token = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

document.addEventListener("DOMContentLoaded", async () => {
  fetch(`${BACKEND_URL}/ping`, { cache: 'no-cache' }).catch(() => {});

  const params = new URLSearchParams(window.location.search);
  const paramAluno = params.get('aluno');
  if (paramAluno && document.getElementById('loginUser')) {
    document.getElementById('loginUser').value = paramAluno;
  }

  const modo = params.get('modo');
  const tipo = params.get('tipo');

  if (tipo === 'treino' || modo === 'anamnese_treino') {
    isApenasTreinoMode = true;
  }

  if (modo === 'anamnese_convidado') {
    isConvidadoDuplaMode = true;
  }

  if (modo === 'anamnese' || modo === 'anamnese_treino' || modo === 'anamnese_convidado' || isApenasTreinoMode) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('anamneseScreen').classList.remove('hidden');

    const restWidget = document.getElementById('restTimerWidget');
    if (restWidget) restWidget.classList.remove('visible');

    if (isApenasTreinoMode) {
      const anamTitle = document.getElementById('anamMainTitle');
      const anamSub = document.getElementById('anamMainSub');
      if (anamTitle) anamTitle.textContent = "Anamnese de Treino";
      if (anamSub) anamSub.textContent = "Preencha com atenção para a montagem da sua ficha personalizada de treino";
      
      const selectPlano = document.getElementById('anamTipoConsultoria');
      if (selectPlano && !isConvidadoDuplaMode) {
        selectPlano.innerHTML = `
          <option value="TREINO_ANUAL" selected>Consultoria de Treino Anual — R$ 55/mês ou R$ 540 no PIX</option>
          <option value="TREINO_DUPLA">Promocional Treino em Dupla (Anual) — R$ 90/mês ou R$ 960 no PIX</option>
        `;
      }
    }

    const planoParam = params.get('plano');
    const selectPlano = document.getElementById('anamTipoConsultoria');

    if (planoParam && selectPlano && !isConvidadoDuplaMode) {
      selectPlano.value = planoParam;
      selectPlano.disabled = true;
      selectPlano.style.opacity = '0.85';
      selectPlano.style.background = 'var(--panel)';
    }

    if (isConvidadoDuplaMode) {
      const selectPagamento = document.getElementById('anamFormaPagamento');
      const pixBox = document.getElementById('pixDiretoBox');

      if (selectPlano) {
        selectPlano.innerHTML = `<option value="DUPLA_CONVIDADO_INCLUSO" selected>Consultoria em Dupla (Incluso no Plano do Titular)</option>`;
        selectPlano.disabled = true;
      }
      if (selectPagamento) {
        selectPagamento.innerHTML = `<option value="INCLUSO_NO_PLANO_DUPLA" selected>Incluso no Plano em Dupla (Já Pago)</option>`;
        selectPagamento.disabled = true;
      }
      if (pixBox) pixBox.classList.add('hidden');
    }

    atualizarResumoPrecoAnamnese();
    return;
  }

  const loggedUser = localStorage.getItem('logged_user');
  const alunoToken = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');

  if (loggedUser && alunoToken) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/aluno/${loggedUser}`, {
        headers: authHeaders(),
        cache: 'no-cache'
      });
      if (res.ok) {
        const data = await res.json();
        loggedUserCode = loggedUser;
        loadStudentData(data);
      } else {
        logout();
      }
    } catch (e) {
      logout();
    }
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('anamneseScreen').classList.add('hidden');

    const restWidget = document.getElementById('restTimerWidget');
    if (restWidget) restWidget.classList.remove('visible');
  }
});

function nextAnamStep(step) {
  if (isApenasTreinoMode) {
    if (step === 7 || step === 8) {
      step = 9;
    }
  }

  for (let i = 1; i <= 10; i++) {
    const elStep = document.getElementById(`anamStep${i}`);
    if (elStep) elStep.classList.add('hidden');
  }
  const currentStepEl = document.getElementById(`anamStep${step}`);
  if (currentStepEl) currentStepEl.classList.remove('hidden');
  
  const progressBar = document.getElementById('progressBar');
  const stepCounter = document.getElementById('stepCounter');
  if (progressBar) progressBar.style.width = `${(step/10)*100}%`;
  if (stepCounter) stepCounter.textContent = `Etapa ${step} de 10`;
  
  const btnVoltarStep10 = document.getElementById('btnVoltarStep10');
  if (btnVoltarStep10) {
    btnVoltarStep10.setAttribute('onclick', isApenasTreinoMode ? 'nextAnamStep(6)' : 'nextAnamStep(9)');
  }

  if (step === 10) atualizarResumoPrecoAnamnese();
}

function togglePaymentView() {
  const option = document.getElementById('anamFormaPagamento').value;
  const pixBox = document.getElementById('pixDiretoBox');
  if (pixBox) {
    if (option === 'PIX_DIRETO') pixBox.classList.remove('hidden');
    else pixBox.classList.add('hidden');
  }
}

function copiarChavePix() {
  navigator.clipboard.writeText("jhonatags123@gmail.com");
  alert("Chave Pix copiada: jhonatags123@gmail.com");
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btnLoginSubmit');
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();
  const errorDiv = document.getElementById('loginError');

  errorDiv.classList.add('hidden');
  btn.textContent = "Conectando ao servidor...";
  btn.disabled = true;

  const tentarConexao = async (tentativasRestantes) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/aluno/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
        body: JSON.stringify({ codigo: user, senha: pass })
      });

      const result = await res.json();

      if (!res.ok) {
        errorDiv.textContent = result.error || "Erro de login.";
        errorDiv.classList.remove('hidden');
        btn.textContent = "Entrar";
        btn.disabled = false;
        return;
      }

      localStorage.setItem('logged_user', user);
      localStorage.setItem('aluno_token', result.token);
      localStorage.setItem('token', result.token);
      localStorage.setItem('tokenAluno', result.token);
      loggedUserCode = user;

      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      loadStudentData(result.data);
    } catch (err) {
      if (tentativasRestantes > 0) {
        btn.textContent = "Iniciando servidor, aguarde...";
        setTimeout(() => tentarConexao(tentativasRestantes - 1), 3500);
      } else {
        errorDiv.textContent = "O servidor demorou a responder. Aguarde alguns segundos e tente novamente.";
        errorDiv.classList.remove('hidden');
        btn.textContent = "Entrar";
        btn.disabled = false;
      }
    }
  };

  tentarConexao(3);
}

function renderizarCheckoutFinalPlano(tipoConsultoria) {
  const checkoutInfo = CHECKOUT_LINKS[tipoConsultoria] || CHECKOUT_LINKS.COMPLETA_SEMESTRAL;

  return `
    <div style="text-align:center; padding:24px 10px;">
      <div style="font-size:48px; margin-bottom:12px;">✅</div>
      <h2 style="font-size:24px; font-weight:700; color:var(--ink,#fff); font-family:var(--font-display);">
        Anamnese Concluída com Sucesso!
      </h2>
      <p style="font-size:13.5px; color:var(--ink-dim,#e0d0d3); margin-top:8px; line-height:1.6;">
        Escolha abaixo como deseja realizar o pagamento da sua assinatura:
      </p>

      <div style="background:var(--panel-2,#150508); border:1px solid var(--line,rgba(220,170,58,.25)); border-radius:18px; padding:20px; margin-top:20px; text-align:center;">
        
        <a href="${checkoutInfo.cartao}" target="_blank" rel="noopener" class="btn-login" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; background:linear-gradient(135deg,#c4324f,#841628); color:#fff; text-decoration:none; padding:14px; border-radius:12px; margin-bottom:12px; font-weight:800; border:0;">
          <span>💳 Pagar no Cartão Recorrente</span>
          <small style="font-size:11px; opacity:.9; font-weight:400;">✓ Débito mensal sem ocupar o limite total do cartão</small>
        </a>

        <a href="${checkoutInfo.pix}" target="_blank" rel="noopener" class="btn-login" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; background:#dcaa3a; color:#1a0b02; text-decoration:none; padding:14px; border-radius:12px; font-weight:800; border:0;">
          <span>⚡ Pagar via PIX À Vista</span>
          <small style="font-size:11px; opacity:.9; font-weight:400;">✓ Liberação e início imediato do seu acompanhamento</small>
        </a>

      </div>

      <a href="https://wa.me/5551990169026?text=Ol%C3%A1%20Jhonata!%20Acabei%20de%20preencher%20minha%20Anamnese!" target="_blank" class="btn-login btn-wpp" style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:20px; text-decoration:none;">
         Falar com o personal no WhatsApp
      </a>
    </div>
  `;
}

async function sendAnamneseAppDirect() {
  const nome = document.getElementById('anamNome').value.trim();
  const nascimento = document.getElementById('anamNascimento').value.trim();
  const idade = document.getElementById('anamIdade').value.trim();
  const email = document.getElementById('anamEmail').value.trim();
  const cpf = document.getElementById('anamCpf').value.trim();
  const telefone = document.getElementById('anamTelefone').value.trim();
  const pixInput = document.getElementById('pixReceiptInput');
  const formaPagamento = document.getElementById('anamFormaPagamento').value;
  const tipoConsultoria = document.getElementById('anamTipoConsultoria').value;
  const btn = document.getElementById('btnSubmitAnam');

  if (!nome || !nascimento || !idade || !email || !cpf || !telefone) {
    return alert("Preencha nome, data de nascimento, idade, e-mail, CPF e WhatsApp.");
  }

  const userCode = nome.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const anamneseData = {
    codigo: userCode,
    nome: nome,
    clientName: nome,
    nascimento: nascimento,
    idade: idade,
    email: email,
    cpf: cpf,
    tipoConsultoria: tipoConsultoria,
    telefone: telefone,
    peso: document.getElementById('anamPeso').value.trim(),
    altura: document.getElementById('anamAltura').value.trim(),
    objetivo: document.getElementById('anamObjetivo').value,
    tempoTreino: document.getElementById('anamTempoTreino').value.trim(),
    anabolizantes: document.getElementById('anamAnabolizantes').value.trim(),
    diasSemana: document.getElementById('anamDiasSemana').value.trim(),
    preferenciaDias: document.getElementById('anamPreferenciaDias').value.trim(),
    tempoTreinoMin: document.getElementById('anamTempoTreinoMin').value.trim(),
    tempoDescanso: document.getElementById('anamTempoDescanso').value,
    outrasAtividades: document.getElementById('anamOutrasAtividades').value.trim(),
    lesoes: document.getElementById('anamLesoes').value.trim(),
    doencas: document.getElementById('anamDoencas').value.trim(),
    rotina: document.getElementById('anamRotina').value.trim(),
    horasSono: document.getElementById('anamHorasSono').value.trim(),
    qualidadeSono: document.getElementById('anamQualidadeSono').value.trim(),
    alcool: document.getElementById('anamAlcool').value.trim(),
    tabagismo: document.getElementById('anamTabagismo').value.trim(),
    numRefeicoes: isApenasTreinoMode ? "" : document.getElementById('anamNumRefeicoes').value.trim(),
    alergias: isApenasTreinoMode ? "" : document.getElementById('anamAlergias').value.trim(),
    alimentosOdiados: isApenasTreinoMode ? "" : document.getElementById('anamAlimentosOdiados').value.trim(),
    gostaCarbos: isApenasTreinoMode ? "" : document.getElementById('anamGostaCarbos').value.trim(),
    gostaProteinas: isApenasTreinoMode ? "" : document.getElementById('anamGostaProteinas').value.trim(),
    gostaLegumes: isApenasTreinoMode ? "" : document.getElementById('anamGostaLegumes').value.trim(),
    orcamento: isApenasTreinoMode ? "" : document.getElementById('anamOrcamento').value.trim(),
    suplementos: isApenasTreinoMode ? "" : document.getElementById('anamSuplementos').value.trim(),
    fimDeSemana: isApenasTreinoMode ? "" : document.getElementById('anamFimDeSemana').value.trim(),
    formaPagamento: formaPagamento,
    apenasTreino: isApenasTreinoMode || tipoConsultoria.includes('TREINO')
  };

  if (btn) {
    btn.textContent = "Processando...";
    btn.disabled = true;
  }

  // Upload do comprovante no Drive se anexado
  if (pixInput && pixInput.files && pixInput.files[0]) {
    btn.textContent = "Salvando Comprovante no Drive...";
    const comprovanteFile = pixInput.files[0];
    const driveUrl = await enviarArquivoParaGoogleDrive(nome, comprovanteFile, `Comprovante_Anamnese_${nome}`);
    if (driveUrl) {
      anamneseData.comprovanteUrl = driveUrl;
    }
  }

  try {
    await fetch(`${BACKEND_URL}/api/anamnese/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: 'no-cache',
      body: JSON.stringify(anamneseData)
    });

    if (!isConvidadoDuplaMode) {
      document.getElementById('anamneseScreen').innerHTML = renderizarCheckoutFinalPlano(tipoConsultoria);
    } else {
      document.getElementById('anamneseScreen').innerHTML = `
        <div style="text-align:center; padding:24px 10px;">
          <div style="font-size:48px; margin-bottom:12px;">✅</div>
          <h2 style="font-size:26px; font-weight:700; color:var(--ink); font-family:var(--font-display);">
            Anamnese Recebida
          </h2>
          <p style="font-size:13.5px; color:#e0d0d3; margin-top:10px; line-height:1.6;">
            Seu cadastro em dupla foi vinculado com sucesso!
          </p>
        </div>
      `;
    }
  } catch (e) {
    alert("Erro ao conectar.");
    if (btn) {
      btn.textContent = "Finalizar e enviar";
      btn.disabled = false;
    }
  }
}

function loadStudentData(data) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('anamneseScreen').classList.add('hidden');
  document.getElementById('mainContent').classList.remove('hidden');
  document.body.classList.add('app-mode');

  currentData = data;

  if (currentData.logs) {
    Object.keys(currentData.logs).forEach(k => {
      if (k.startsWith('ex_done_')) delete currentData.logs[k];
    });
  }

  const localLogs = localStorage.getItem(`draft_student_logs_${loggedUserCode}`);
  if (localLogs) {
    try {
      const parsed = JSON.parse(localLogs);
      Object.keys(parsed).forEach(k => {
        if (k.startsWith('ex_done_')) delete parsed[k];
      });
      currentData.logs = Object.assign({}, currentData.logs || {}, parsed);
    } catch(e) {}
  }

  document.getElementById('clientName').textContent = data.clientName || 'Aluno';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let estaVencido = data.status_pagamento === 'pendente' || data.ativo === false;
  let diasRestantes = 0;
  let textoVencimento = "";
  let dataExp = null;

  if (data.data_expiracao) {
    const expStr = String(data.data_expiracao).split('T')[0];
    const parts = expStr.split('-');
    if (parts.length === 3) {
      dataExp = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
    }
  }

  if (!dataExp) {
    const diaVenc = parseInt(data.dia_vencimento) || 7;
    let ano = hoje.getFullYear();
    let mes = hoje.getMonth();
    if (hoje.getDate() > diaVenc) mes += 1;
    dataExp = new Date(ano, mes, diaVenc, 23, 59, 59, 999);
  }

  const diffTempo = dataExp.getTime() - hoje.getTime();
  diasRestantes = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
  if (diasRestantes <= 0) estaVencido = true;

  const diaFmt = String(dataExp.getDate()).padStart(2, '0');
  const mesFmt = String(dataExp.getMonth() + 1).padStart(2, '0');

  if (diasRestantes <= 0) {
    textoVencimento = `📅 Vencido em ${diaFmt}/${mesFmt} (Acesso Suspenso)`;
  } else {
    textoVencimento = `📅 Vencimento em ${diaFmt}/${mesFmt} (${diasRestantes} dias restantes)`;
  }

  if (estaVencido) {
    renderLockNotice();
    return;
  }

  let corBadge = '#4F9C6E';
  if (diasRestantes <= 5) corBadge = '#C1402C';
  else if (diasRestantes <= 15) corBadge = '#B4924F';

  document.getElementById('billingInfo').innerHTML = `<span style="display:inline-block; padding:3px 8px; border-radius:4px; background:rgba(0,0,0,0.4); color:${corBadge}; font-weight:700; font-size:11px;">${textoVencimento}</span>`;

  if (data.apenasTreino === true) {
    document.getElementById('btnDieta').style.display = 'none';
    document.getElementById('noDietBanner').classList.remove('hidden');
    document.getElementById('dietListView').classList.add('hidden');
  } else {
    document.getElementById('btnDieta').style.display = 'block';
    document.getElementById('noDietBanner').classList.add('hidden');
    renderDietaAluno(data.refeicoes || data.dieta || []);
  }

  if (data.corredor === true) {
    document.getElementById('btnCorrida').classList.remove('hidden');
    setupCorrida(data);
  } else {
    document.getElementById('btnCorrida').classList.add('hidden');
  }

  verificarCardEvolucao(data);
  verificarNotificacaoFeedback(data);
  setupWorkout(data.days || []);
  renderFeedbackHistory();
  setupSwipeNavigation();

  showTab('treino');
}

function toggleCheckExercise(btn, dayIdx, exIdx) {
  if (!workoutTimerRunning) {
    alert("⚠️ Clique em '▶ INICIAR TREINO' antes de marcar o exercício!");
    return;
  }

  const card = btn.closest('.item');
  const isDone = btn.classList.toggle('done');
  
  if (isDone) {
    btn.textContent = '✓ Concluído';
    if (card) card.classList.add('exercise-done');
    if (navigator.vibrate) navigator.vibrate(50);
  } else {
    btn.textContent = 'Marcar Concluído';
    if (card) card.classList.remove('exercise-done');
  }

  const keyExDone = `ex_done_${dayIdx}_${exIdx}`;
  scheduleAutoSave(keyExDone, isDone ? 'true' : 'false');
}

function verificarNotificacaoFeedback(alunoData) {
  const feedbacks = alunoData.feedbacks || [];
  const notifyBox = document.getElementById('feedbackNotifyBox');
  const notifyText = document.getElementById('feedbackNotifyText');
  if (!notifyBox || feedbacks.length === 0) return;

  const ultimasMensagens = feedbacks.filter(f => f.autor === "PERSONAL");
  if (ultimasMensagens.length === 0) return;

  const ultima = ultimasMensagens[ultimasMensagens.length - 1];
  const keyVisto = `fb_last_seen_${loggedUserCode}`;
  const vistoId = localStorage.getItem(keyVisto);
  const msgId = ultima.data || ultima.mensagem;

  if (vistoId !== msgId) {
    notifyText.textContent = `"${ultima.mensagem}"`;
    notifyBox.classList.remove('hidden');
  }
}

function dismissFeedbackNotify() {
  const notifyBox = document.getElementById('feedbackNotifyBox');
  if (notifyBox) notifyBox.classList.add('hidden');

  const feedbacks = (currentData && currentData.feedbacks) || [];
  const ultimas = feedbacks.filter(f => f.autor === "PERSONAL");
  if (ultimas.length > 0) {
    const ultima = ultimas[ultimas.length - 1];
    localStorage.setItem(`fb_last_seen_${loggedUserCode}`, ultima.data || ultima.mensagem);
  }
}

function irParaFeedbackChat() {
  dismissFeedbackNotify();
  showTab('feedback');
}

function renderLockNotice() {
  const lockHtml = `
    <div class="pay-lock-overlay">
      <div style="font-size:42px; margin-bottom:8px;">🔒</div>
      <div class="pay-lock-title">Acesso suspenso</div>
      <div class="pay-lock-desc">
        Identificamos que o seu plano mensal venceu.<br>
        Assim que efetuar a renovação, envie o comprovante no WhatsApp para reativar seu acesso na hora!
      </div>
      <a href="https://wa.me/5551990169026?text=Ol%C3%A1%20Jhonata!%20Efetuei%20o%20pagamento%20da%20minha%20renova%C3%A7%C3%A3o,%20segue%20o%20comprovante:" 
         target="_blank" class="btn-login btn-wpp" style="text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px;">
         Enviar comprovante no WhatsApp
      </a>
    </div>
  `;

  document.getElementById('treinoListView').classList.remove('hidden');
  document.getElementById('treinoDetailView').classList.add('hidden');
  document.getElementById('treinoDayList').innerHTML = lockHtml;

  document.getElementById('dietListView').classList.remove('hidden');
  document.getElementById('dietCategoryList').innerHTML = lockHtml;
}

function verificarCardEvolucao(data) {
  if (!data.evolucao_carga_pct || data.evolucao_carga_pct <= 0) return;

  const keyStorage = `congrats_closed_${loggedUserCode}`;
  const timestampFechado = localStorage.getItem(keyStorage);
  const agora = new Date().getTime();

  if (timestampFechado && (agora - parseInt(timestampFechado)) < 86400000) {
    document.getElementById('congratsBox').classList.add('hidden');
    return;
  }

  document.getElementById('congratsText').textContent = `Parabéns! Você aumentou sua força em média +${data.evolucao_carga_pct}% em relação ao ciclo anterior. Excelente evolução!`;
  document.getElementById('congratsBox').classList.remove('hidden');
}

function fecharCardEvolucao() {
  document.getElementById('congratsBox').classList.add('hidden');
  localStorage.setItem(`congrats_closed_${loggedUserCode}`, new Date().getTime().toString());
}

async function salvarRunDia(diaKey) {
  if (!currentData) return;

  const inputKm = document.getElementById(`run_km_${diaKey}`);
  const inputMin = document.getElementById(`run_min_${diaKey}`);

  const kmVal = inputKm ? inputKm.value.trim() : "";
  const minVal = inputMin ? inputMin.value.trim() : "";

  if (!currentData.registros_corrida) currentData.registros_corrida = {};

  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  if (kmVal || minVal) {
    currentData.registros_corrida[diaKey] = [{
      data: dataHoje,
      km: kmVal,
      min: minVal
    }];
  } else {
    delete currentData.registros_corrida[diaKey];
  }

  const paceStr = (kmVal && minVal) ? calcularPaceTexto(kmVal, minVal) : "--'--\"";
  const displayPace = document.getElementById(`run_pace_display_${diaKey}`);
  if (displayPace) {
    displayPace.innerHTML = `⏱ Pace do dia: <span>${paceStr}</span> /km`;
  }

  setupCorrida(currentData);

  const ind = document.getElementById('saveIndicator');
  if (ind) ind.style.display = 'block';

  try {
    await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: "POST",
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {
    console.error("Erro ao salvar cardio:", e);
  } finally {
    if (ind) ind.style.display = 'none';
  }
}

async function apagarRunDia(diaKey) {
  if (!confirm(`Deseja apagar o registro de cardio deste dia?`)) return;

  const inputKm = document.getElementById(`run_km_${diaKey}`);
  const inputMin = document.getElementById(`run_min_${diaKey}`);

  if (inputKm) inputKm.value = '';
  if (inputMin) inputMin.value = '';

  if (currentData && currentData.registros_corrida) {
    delete currentData.registros_corrida[diaKey];
  }

  await salvarRunDia(diaKey);
}

async function resetCardioSemanal() {
  if (!currentData) return;

  currentData.registros_corrida = {};
  currentData.corridas = [];

  const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  dias.forEach(d => {
    const elKm = document.getElementById(`run_km_${d}`);
    const elMin = document.getElementById(`run_min_${d}`);
    const elPace = document.getElementById(`run_pace_display_${d}`);

    if (elKm) elKm.value = '';
    if (elMin) elMin.value = '';
    if (elPace) elPace.innerHTML = '⏱ Pace do dia: <span>--\'--"</span> /km';
  });

  setupCorrida(currentData);

  try {
    await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: "POST",
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {}
}

function setupCorrida(data) {
  const presContainer = document.getElementById('corridaPrescricaoList');
  const histContainer = document.getElementById('corridaHistoryList');

  if (!presContainer || !histContainer) return;

  presContainer.innerHTML = '';
  histContainer.innerHTML = '';

  const cardioContainer = document.getElementById('cardioGoalsBody');
  if (cardioContainer) {
    const customCardio = (data && (data.cardio_guidelines || data.prescricao_cardio)) || '';
    if (customCardio.trim()) {
      cardioContainer.innerHTML = escapeHtml(customCardio).replace(/\n/g, '<br>');
    } else {
      cardioContainer.innerHTML = `Aguardando prescrição de cardio pelo treinador.`;
    }
  }

  const prescricao = data.prescricao_corrida || {};
  const registros = data.registros_corrida || data.corridas || {};

  const dias = [
    { key: 'seg', nome: 'Segunda-Feira' },
    { key: 'ter', nome: 'Terça-Feira' },
    { key: 'qua', nome: 'Quarta-Feira' },
    { key: 'qui', nome: 'Quinta-Feira' },
    { key: 'sex', nome: 'Sexta-Feira' },
    { key: 'sab', nome: 'Sábado' },
    { key: 'dom', nome: 'Domingo' }
  ];

  let totalKm = 0;
  let totalMin = 0;
  let totalRegistros = 0;

  dias.forEach(d => {
    const pData = prescricao[d.key] || {};
    let treinoInstrucao = "Descanso ou treino livre";
    
    if (typeof pData === 'object' && pData !== null) {
      if (pData.desc || pData.km || pData.min) {
        const infoKm = pData.km ? `${pData.km} km` : '';
        const infoMin = pData.min ? `${pData.min} min` : '';
        const infoInt = pData.intensidade ? `[${pData.intensidade}]` : '';
        const detalhe = pData.desc || '';
        treinoInstrucao = `${infoKm} ${infoMin} ${infoInt} - ${detalhe}`.trim();
      }
    } else if (typeof pData === 'string' && pData.trim() !== '') {
      treinoInstrucao = pData;
    }

    const regDia = registros[d.key] || [];
    const ultimoReg = Array.isArray(regDia) ? regDia[regDia.length - 1] : regDia;

    const kmVal = ultimoReg?.km || '';
    const minVal = ultimoReg?.min || ultimoReg?.minutos || '';
    const paceDiaStr = (kmVal && minVal) ? calcularPaceTexto(kmVal, minVal) : "--'--\"";

    const card = document.createElement('div');
    card.className = 'run-item';
    card.innerHTML = `
      <div class="run-day-title">${d.nome}</div>
      <div class="run-day-desc">📋 <b>Orientação:</b> ${escapeHtml(treinoInstrucao)}</div>
      <div style="display:flex; gap:6px; align-items:center; margin-top:8px;">
        <input type="number" step="0.1" id="run_km_${d.key}" class="input-field" style="font-size:12px; padding:6px; height:36px;" placeholder="Km (Ex: 5.0)" value="${escapeHtml(kmVal)}">
        <input type="number" id="run_min_${d.key}" class="input-field" style="font-size:12px; padding:6px; height:36px;" placeholder="Min (Ex: 25)" value="${escapeHtml(minVal)}">
        <button type="button" class="btn-login btn-blue" style="width:70px; min-height:36px; padding:0; font-size:11px; margin-top:0;" onclick="salvarRunDia('${d.key}')">Salvar</button>
        <button type="button" class="btn-login" style="width:36px; min-height:36px; padding:0; font-size:12px; margin-top:0; background:var(--panel); border:1px solid var(--line); color:var(--signal-light);" title="Apagar registro do dia" onclick="apagarRunDia('${d.key}')">🗑️</button>
      </div>
      <div id="run_pace_display_${d.key}" style="font-size:11.5px; font-weight:700; color:var(--blue); margin-top:6px;">
        ⏱ Pace do dia: <span>${paceDiaStr}</span> /km
      </div>
    `;
    presContainer.appendChild(card);
  });

  const nomesDiasMap = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };
  const keysDias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

  if (Array.isArray(registros)) {
    registros.slice(-4).forEach(c => {
      const km = parseFloat(c.km) || 0;
      const min = parseFloat(c.minutos || c.min) || 0;
      totalKm += km;
      totalMin += min;
      totalRegistros++;

      const paceStr = calcularPaceTexto(km, min);

      const div = document.createElement('div');
      div.className = 'run-item';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:700; font-size:13px; color:var(--ink);">
          <span>📅 ${escapeHtml(c.data || 'Treino')}</span>
          <span style="color:var(--blue);">Pace: ${paceStr} /km</span>
        </div>
        <div style="font-size:11.5px; color:var(--ink-dim); margin-top:4px;">
          Distância: <b>${km} km</b> | Duração: <b>${min} min</b>
        </div>
      `;
      histContainer.appendChild(div);
    });
  } else if (typeof registros === 'object') {
    keysDias.forEach(key => {
      let hDia = registros[key];
      if (!hDia) return;
      if (!Array.isArray(hDia)) hDia = [hDia];

      if (hDia.length > 4) hDia = hDia.slice(-4);

      hDia.forEach((c) => {
        const km = parseFloat(c.km) || 0;
        const min = parseFloat(c.min || c.minutos) || 0;
        totalKm += km;
        totalMin += min;
        totalRegistros++;

        const paceStr = calcularPaceTexto(km, min);

        const div = document.createElement('div');
        div.className = 'run-item';
        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-weight:700; font-size:13px; color:var(--ink);">
            <span>🏃 ${nomesDiasMap[key]} (${escapeHtml(c.data || 'Recente')})</span>
            <span style="color:var(--blue); font-size:12px;">Pace: ${paceStr} /km</span>
          </div>
          <div style="font-size:11.5px; color:var(--ink-dim); margin-top:4px;">
            ${km > 0 ? `Distância: <b>${km} km</b> | Tempo: <b>${min} min</b>` : 'Treino registrado'}
          </div>
        `;
        histContainer.appendChild(div);
      });
    });
  }

  if (totalRegistros === 0) {
    histContainer.innerHTML = `<div style="font-size:12px; color:var(--ink-dim); text-align:center; padding:14px;">Nenhuma corrida realizada nas últimas 4 semanas.</div>`;
  }

  document.getElementById('runTotalKm').textContent = `${totalKm.toFixed(1)} km`;
  const paceMedioGlobal = calcularPaceTexto(totalKm, totalMin);
  document.getElementById('runPaceMedio').textContent = paceMedioGlobal;
}

function setupWorkout(days) {
  currentData.days = days;
  renderTreinoDayList();

  const proximoIdx = currentData.ultimo_treino_idx !== undefined ? (currentData.ultimo_treino_idx) % days.length : 0;
  selectTreinoDay(proximoIdx);
}

function renderTreinoDayList() {
  const listContainer = document.getElementById('treinoDayList');
  listContainer.innerHTML = '';

  const days = (currentData && currentData.days) || [];

  if (!days || days.length === 0) {
    listContainer.innerHTML = '<div style="font-size:13px; color:var(--ink-dim); text-align:center; padding:20px;">Seu treino está sendo montado pelo personal.</div>';
    return;
  }

  days.forEach((day, dayIdx) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'select-card';
    card.innerHTML = `
      <div>
        <div class="select-card-title">${escapeHtml(day.title)}</div>
        <div class="select-card-sub">${(day.exercicios || []).length} Exercícios</div>
      </div>
      <span class="select-card-arrow">›</span>
    `;
    card.onclick = () => selectTreinoDay(dayIdx);
    listContainer.appendChild(card);
  });
}

function selectTreinoDay(dayIdx) {
  currentTreinoDayIdx = dayIdx;
  document.getElementById('treinoListView').classList.add('hidden');
  document.getElementById('treinoDetailView').classList.remove('hidden');
  renderTreinoDetail();
}

function openTreinoSelectionMenu() {
  document.getElementById('treinoDetailView').classList.add('hidden');
  document.getElementById('treinoListView').classList.remove('hidden');
}

function toggleCheckSerie(btn) {
  if (!workoutTimerRunning) {
    alert("⚠️ Clique em '▶ INICIAR TREINO' antes de começar a marcar as séries!");
    return;
  }
  btn.classList.toggle('done');
  if (btn.classList.contains('done')) {
    btn.textContent = "✓ Feito";
  } else {
    btn.textContent = "Série " + btn.dataset.num;
  }
}

async function concluirTreinoDoDia() {
  if (!currentData) return;

  const keyStart = `workout_start_time_${loggedUserCode}`;
  const startTimeStr = localStorage.getItem(keyStart);
  let durationSeconds = 0;

  if (startTimeStr) {
    durationSeconds = Math.floor((Date.now() - parseInt(startTimeStr)) / 1000);
    localStorage.removeItem(keyStart);
  }

  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  workoutTimerRunning = false;

  const m = Math.floor(durationSeconds / 60);
  const s = durationSeconds % 60;
  const tempoTexto = m > 0 ? `${m} min e ${s} seg` : `${s} seg`;

  document.getElementById('summaryTimeDisplay').textContent = tempoTexto;

  const summaryList = document.getElementById('summaryProgressionList');
  summaryList.innerHTML = "";

  const day = currentData.days?.[currentTreinoDayIdx];
  let evolucoes = [];
  let volumeToneladoTotal = 0;

  if (day && day.exercicios) {
    day.exercicios.forEach((ex, exIdx) => {
      const keyLog = `${currentTreinoDayIdx}_${exIdx}`;
      const exKeySanitized = sanitizeExKey(ex.nome);
      const historico = currentData.weekly_logs?.[exKeySanitized] || currentData.weekly_logs?.[keyLog] || [];
      const ultimoReg = historico.length > 0 ? historico[historico.length - 1] : null;

      let cMax = 0;
      let rTotal = 0;
      let seriesCount = 0;

      for (let s = 1; s <= 5; s++) {
        const cVal = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_s${s}`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_s${s}`]);
        const rVal = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_s${s}`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_s${s}`]);

        if (!isNaN(cVal) && cVal > cMax) cMax = cVal;
        if (!isNaN(rVal)) { 
          rTotal += rVal; 
          seriesCount++; 
          if (!isNaN(cVal)) volumeToneladoTotal += (cVal * rVal);
        }
      }

      const cAtiv = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_ativ`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_ativ`]);
      const rAtiv = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_ativ`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_ativ`]);
      if (!isNaN(cAtiv) && cAtiv > cMax) cMax = cAtiv;
      if (!isNaN(rAtiv)) { 
        rTotal += rAtiv; 
        seriesCount++; 
        if (!isNaN(cAtiv)) volumeToneladoTotal += (cAtiv * rAtiv);
      }

      const cCl = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_cl_peso`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_cl_peso`]);
      const rCl = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_cl_lastreps`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_cl_lastreps`]);
      if (!isNaN(cCl) && cCl > cMax) cMax = cCl;
      if (!isNaN(rCl)) { 
        rTotal += rCl; 
        seriesCount++; 
        if (!isNaN(cCl)) volumeToneladoTotal += (cCl * rCl);
      }

      const cBo = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_bo`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_bo`]);
      const rBo = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_bo`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_bo`]);
      if (!isNaN(cBo) && cBo > cMax) cMax = cBo;
      if (!isNaN(rBo)) { 
        rTotal += rBo; 
        seriesCount++; 
        if (!isNaN(cBo)) volumeToneladoTotal += (cBo * rBo);
      }

      const rMed = seriesCount > 0 ? Math.round(rTotal / seriesCount) : 0;

      if (cMax > 0 || rMed > 0) {
        let statusText = "✨ Treino registrado";
        let statusColor = "var(--mark)";

        if (ultimoReg) {
          const cargaAnt = parseFloat(ultimoReg.cargaMax) || 0;
          const repsAnt = Math.round(parseFloat(ultimoReg.repsMed) || 0);

          if (cMax > cargaAnt) {
            const diff = (cMax - cargaAnt).toFixed(1);
            statusText = `🚀 +${diff}kg de carga!`;
            statusColor = "var(--good)";
          } else if (cMax === cargaAnt && rMed > repsAnt) {
            const diffReps = rMed - repsAnt;
            statusText = `📈 +${diffReps} rep${diffReps > 1 ? 's' : ''} com a mesma carga!`;
            statusColor = "var(--blue)";
          }
        }

        evolucoes.push({
          nome: ex.nome,
          carga: cMax,
          reps: rMed,
          status: statusText,
          color: statusColor
        });
      }
    });
  }

  document.getElementById('summaryVolumeDisplay').textContent = `${Math.round(volumeToneladoTotal)} kg`;

  if (evolucoes.length === 0) {
    summaryList.innerHTML = `<div style="color:var(--ink-dim); font-size:12px; text-align:center;">Preencha suas cargas para visualizar a evolução!</div>`;
  } else {
    evolucoes.forEach(item => {
      summaryList.innerHTML += `
        <div class="progression-item">
          <b style="color:var(--ink);">${escapeHtml(item.nome)}</b>
          <span style="color:${item.color}; font-weight:700;">${item.status}</span> 
          <span style="color:var(--ink-dim); font-size:11px;">Carga máx: ${item.carga}kg | Média: ${item.reps} reps</span>
        </div>
      `;
    });
  }

  if (!currentData.historico_sessoes) currentData.historico_sessoes = [];
  const obsEl = document.getElementById(`input_obs_${currentTreinoDayIdx}`);
  const obsAtualSessao = obsEl ? obsEl.value.trim() : "";

  currentData.historico_sessoes.push({
    data: new Date().toISOString(),
    treinoTitulo: day ? day.title : "Treino",
    duracaoMinutos: m,
    observacoes: obsAtualSessao ? [obsAtualSessao] : []
  });

  if (currentData.historico_sessoes.length > 15) {
    currentData.historico_sessoes = currentData.historico_sessoes.slice(-15);
  }

  if (!currentData.logs) currentData.logs = {};

  Object.keys(currentData.logs).forEach(key => {
    if (key.startsWith('ex_done_')) {
      delete currentData.logs[key];
    }
  });

  if (day && day.exercicios) {
    day.exercicios.forEach((ex, exIdx) => {
      const exKeySanitized = sanitizeExKey(ex.nome);
      delete currentData.logs[`ex_done_${currentTreinoDayIdx}_${exIdx}`];
      
      for (let s = 1; s <= 5; s++) {
        delete currentData.logs[`log_c_${exKeySanitized}_s${s}`];
        delete currentData.logs[`log_r_${exKeySanitized}_s${s}`];
        delete currentData.logs[`log_c_${currentTreinoDayIdx}_${exIdx}_s${s}`];
        delete currentData.logs[`log_r_${currentTreinoDayIdx}_${exIdx}_s${s}`];
      }
      delete currentData.logs[`log_c_${exKeySanitized}_ativ`];
      delete currentData.logs[`log_r_${exKeySanitized}_ativ`];
      delete currentData.logs[`log_c_${exKeySanitized}_cl_peso`];
      delete currentData.logs[`log_r_${exKeySanitized}_cl_lastreps`];
      delete currentData.logs[`log_b_${exKeySanitized}_cl_blocos`];
      delete currentData.logs[`log_c_${exKeySanitized}_bo`];
      delete currentData.logs[`log_r_${exKeySanitized}_bo`];
    });
  }
  
  delete currentData.logs[`obs_day_${currentTreinoDayIdx}`];

  if (loggedUserCode) {
    localStorage.removeItem(`draft_obs_${loggedUserCode}_${currentTreinoDayIdx}`);
    localStorage.setItem(`draft_student_logs_${loggedUserCode}`, JSON.stringify(currentData.logs));
  }

  const totalDays = (currentData.days || []).length;
  let proximoTreino = currentTreinoDayIdx;

  if (totalDays > 0) {
    proximoTreino = (currentTreinoDayIdx + 1) % totalDays;
    if (proximoTreino === 0) {
      let semanaAtual = currentData.semana_rotacao || 1;
      currentData.semana_rotacao = (semanaAtual % 5) + 1;
      await resetCardioSemanal();
    }
  }

  currentData.ultimo_treino_idx = proximoTreino;

  document.querySelectorAll('.btn-check-serie').forEach(btn => {
    btn.classList.remove('done');
    btn.textContent = "Série " + (btn.dataset.num || '');
  });
  document.querySelectorAll('.btn-check-exercise').forEach(btn => {
    btn.classList.remove('done');
    btn.textContent = 'Marcar Concluído';
  });
  document.querySelectorAll('.item').forEach(card => {
    card.classList.remove('exercise-done');
  });

  try {
    await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: "POST",
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {
    console.error("Erro ao sincronizar término de treino com o servidor:", e);
  }

  document.getElementById('modalTreinoConcluido').classList.remove('hidden');
}

function fecharModalConclusao() {
  document.getElementById('modalTreinoConcluido').classList.add('hidden');
  
  document.getElementById('workoutTimerClock').textContent = "00:00:00";
  document.getElementById('btnWorkoutTimer').textContent = "▶ INICIAR TREINO";
  document.getElementById('btnWorkoutTimer').style.background = "var(--good)";
  setInputsLockState(true);

  const proximoIdx = currentData.ultimo_treino_idx !== undefined ? currentData.ultimo_treino_idx : 0;
  selectTreinoDay(proximoIdx);
}

function toggleTrainerGoals() {
  const body = document.getElementById('trainerGoalsBody');
  const arrow = document.getElementById('arrowGoals');
  if (!body || !arrow) return;

  body.classList.toggle('collapsed');
  arrow.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
}

function toggleCardioGoals() {
  const body = document.getElementById('cardioGoalsBody');
  const arrow = document.getElementById('arrowCardio');
  if (!body || !arrow) return;

  body.classList.toggle('collapsed');
  arrow.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
}

function renderTreinoDetail() {
  const days = (currentData && currentData.days) || [];
  const day = days[currentTreinoDayIdx];
  if (!day) return openTreinoSelectionMenu();

  document.getElementById('treinoDetailTitle').textContent = day.title;

  const goalsContainer = document.getElementById('trainerGoalsBody');
  if (goalsContainer) {
    const customGuidelines = (currentData && (currentData.trainer_guidelines || currentData.diretrizes_treinador)) || '';
    if (customGuidelines.trim()) {
      goalsContainer.innerHTML = escapeHtml(customGuidelines).replace(/\n/g, '<br>');
    } else {
      goalsContainer.innerHTML = `Siga o plano de execução, respeite os tempos de descanso e registre suas cargas.`;
    }
  }

  const quickSwitch = document.getElementById('treinoQuickSwitch');
  quickSwitch.innerHTML = '';
  days.forEach((d, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `quick-switch-chip ${idx === currentTreinoDayIdx ? 'active' : ''}`;
    chip.textContent = d.title;
    chip.onclick = () => selectTreinoDay(idx);
    quickSwitch.appendChild(chip);
  });

  const exercisesContainer = document.getElementById('exercisesList');
  exercisesContainer.innerHTML = '';
  renderExercisesForDay(day, currentTreinoDayIdx, exercisesContainer);

  const keyObs = `obs_day_${currentTreinoDayIdx}`;
  const savedObs = (currentData.logs && currentData.logs[keyObs]) || 
                   localStorage.getItem(`draft_obs_${loggedUserCode}_${currentTreinoDayIdx}`) || '';

  const obsDiv = document.createElement('div');
  obsDiv.style.cssText = "margin-top:16px; background:var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:14px;";
  obsDiv.innerHTML = `
    <label class="label-fdb" style="color:var(--mark); font-size:12px;">📝 Observações / Como foi a sessão hoje?</label>
    <textarea class="input-field" id="input_obs_${currentTreinoDayIdx}" rows="2" style="font-size:14px; margin-top:4px;" 
      placeholder="Ex: Leve desconforto no ombro, noites mal dormidas, cansaço..." 
      oninput="salvarObservacaoTreino('${keyObs}', this.value, ${currentTreinoDayIdx})">${escapeHtml(savedObs)}</textarea>
    <div style="font-size:10px; color:var(--ink-dim); margin-top:4px;">Enviado diretamente ao Personal ao finalizar o treino.</div>
  `;
  exercisesContainer.appendChild(obsDiv);

  checkAndRestoreWorkoutTimer();
}

function salvarObservacaoTreino(keyObs, valor, dayIdx) {
  if (!currentData.logs) currentData.logs = {};
  currentData.logs[keyObs] = valor;

  if (loggedUserCode) {
    localStorage.setItem(`draft_obs_${loggedUserCode}_${dayIdx}`, valor);
    localStorage.setItem(`draft_student_logs_${loggedUserCode}`, JSON.stringify(currentData.logs));
  }

  const ind = document.getElementById('saveIndicator');
  if (ind) ind.style.display = 'block';

  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  autoSaveTimer = setTimeout(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
        method: "POST",
        headers: authHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
      });
      if (ind) ind.style.display = 'none';
    } catch (e) {
      if (ind) ind.style.display = 'none';
    }
  }, 1200);
}

function createLogInputAttr(nameKey) {
  return `type="text" inputmode="decimal" form="none" name="workout_${nameKey}" autocomplete="off" data-lpignore="true" data-form-type="other" aria-autocomplete="none"`;
}

function changeExerciseMode(dayIdx, exIdx, selectedMode) {
  if (!currentData.exercise_modes) currentData.exercise_modes = {};
  currentData.exercise_modes[`${dayIdx}_${exIdx}`] = selectedMode;

  const exercisesContainer = document.getElementById('exercisesList');
  if (exercisesContainer) {
    exercisesContainer.innerHTML = '';
    renderExercisesForDay(currentData.days[dayIdx], dayIdx, exercisesContainer);
    scheduleAutoSave(`mode_${dayIdx}_${exIdx}`, selectedMode);
    setInputsLockState(!workoutTimerRunning);
  }
}

function renderExercisesForDay(day, dayIdx, container) {
  (day.exercicios || []).forEach((ex, exIdx) => {
    const modeKey = `${dayIdx}_${exIdx}`;
    const savedUserMode = (currentData.exercise_modes && currentData.exercise_modes[modeKey]) || null;

    const keyExDone = `ex_done_${dayIdx}_${exIdx}`;
    const isExDone = (currentData.logs && currentData.logs[keyExDone]) === 'true';

    const exName = ex.nome || '';
    const exMeta = ex.reps || ex.repeticoes || '';
    const seriesStr = String(ex.series || '').toLowerCase().trim();

    const tem2x = seriesStr.includes('2x') || seriesStr === '2';
    const tem3x = seriesStr.includes('3x') || seriesStr === '3';
    const temPuraSeries = /^(\d+)x?$/i.test(seriesStr);

    let isStrict1x = seriesStr.includes('1x') || seriesStr === '1';

    const tAdmin = String(ex.tecnica || ex.tecnica_prescrita || '').toLowerCase().trim();
    let tecnicaAdminFixa = null;

    if (tAdmin.includes('cluster') && tAdmin.includes('back')) {
      tecnicaAdminFixa = 'cluster_backoff';
    } else if (tAdmin.includes('back')) {
      tecnicaAdminFixa = 'backoff_2x';
    } else if (tAdmin.includes('cluster')) {
      tecnicaAdminFixa = 'cluster';
    } else if (tAdmin.includes('myo')) {
      tecnicaAdminFixa = 'myoreps';
    } else if (isStrict1x) {
      tecnicaAdminFixa = 'convencional';
    }

    const podeAlterarTecnica = currentData.pode_alterar_tecnica === true && !tecnicaAdminFixa && temPuraSeries;

    let activeMode = tecnicaAdminFixa ? tecnicaAdminFixa : (savedUserMode || 'convencional');

    let cleanName = exName.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    let numSeriesPrescritas = tem3x ? 3 : (tem2x ? 2 : (parseInt(seriesStr) || 3));
    if (isNaN(numSeriesPrescritas) || numSeriesPrescritas <= 0) numSeriesPrescritas = 3;

    const div = document.createElement('div');
    div.className = `item ${isExDone ? 'exercise-done' : ''}`;

    let selectHtml = '';

    if (tecnicaAdminFixa) {
      const nomesExibicao = {
        'convencional': isStrict1x ? '1 Série Única' : `${numSeriesPrescritas}x Convencional`,
        'backoff_2x': '⚙️ 2x + Back-Off Set',
        'cluster': '⚙ Cluster Set',
        'cluster_backoff': '⚙️ Cluster + Back-Off',
        'myoreps': '⚙ Myo-Reps'
      };
      const rotulo = nomesExibicao[activeMode] || 'Técnica Prescrita';
      selectHtml = `<span style="font-size:11px; font-weight:700; color:var(--mark); padding:2px 6px; border:1px solid var(--mark-dim); border-radius:4px; background:var(--panel);">${rotulo}</span>`;
    } else if (podeAlterarTecnica) {
      if (tem2x) {
        selectHtml = `
          <select class="mode-select" onchange="changeExerciseMode(${dayIdx}, ${exIdx}, this.value)">
            <option value="convencional" ${activeMode === 'convencional' ? 'selected' : ''}>2x Convencional</option>
            <option value="cluster" ${activeMode === 'cluster' ? 'selected' : ''}>Cluster Set</option>
          </select>
        `;
      } else {
        selectHtml = `
          <select class="mode-select" onchange="changeExerciseMode(${dayIdx}, ${exIdx}, this.value)">
            <option value="convencional" ${activeMode === 'convencional' ? 'selected' : ''}>${numSeriesPrescritas}x Convencional</option>
            <option value="backoff_2x" ${activeMode === 'backoff_2x' ? 'selected' : ''}>2x + Back-Off Set</option>
            <option value="cluster_backoff" ${activeMode === 'cluster_backoff' ? 'selected' : ''}>Cluster + Back-Off</option>
            <option value="myoreps" ${activeMode === 'myoreps' ? 'selected' : ''}>Myo-Reps</option>
          </select>
        `;
      }
    } else {
      const exibicaoGeral = ex.tecnica || ex.tecnica_prescrita || `${numSeriesPrescritas}x Convencional`;
      selectHtml = `<span style="font-size:11px; font-weight:700; color:var(--mark); padding:2px 6px; border:1px solid var(--mark-dim); border-radius:4px; background:var(--panel);">${escapeHtml(exibicaoGeral)}</span>`;
    }

    const exKeySanitized = sanitizeExKey(cleanName);
    const keyLog = `${dayIdx}_${exIdx}`;
    const historicoEx = (currentData.weekly_logs && (currentData.weekly_logs[exKeySanitized] || currentData.weekly_logs[keyLog])) || [];
    const ultimoRegistro = historicoEx.length > 0 ? historicoEx[historicoEx.length - 1] : null;

    let prevBadgeHtml = "";
    if (ultimoRegistro) {
      const cAnt = ultimoRegistro.cargaMax ? `${ultimoRegistro.cargaMax} kg` : '--';
      const rAnt = ultimoRegistro.repsMed ? `${ultimoRegistro.repsMed} reps` : '--';
      const tAnt = ultimoRegistro.tecnica ? `| Técnica: ${ultimoRegistro.tecnica}` : '';
      prevBadgeHtml = `<div class="previous-log-badge">📈 Último treino — Carga: <b>${cAnt}</b> | Média: <b>${rAnt}</b> ${tAnt}</div>`;
    } else {
      prevBadgeHtml = `<div class="previous-log-badge">📈 Último treino: Sem registro prévio</div>`;
    }

    let html = `
      <div class="item-header">
        <div class="item-title">${escapeHtml(cleanName)}</div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${selectHtml}
          <button type="button" class="btn-check-exercise ${isExDone ? 'done' : ''}" 
            onclick="toggleCheckExercise(this, ${dayIdx}, ${exIdx})">
            ${isExDone ? '✓ Concluído' : 'Marcar Concluído'}
          </button>
        </div>
      </div>
      ${prevBadgeHtml}
      <div class="series-container">
    `;

    if (activeMode === 'myoreps') {
      const keyAtivC = `log_c_${exKeySanitized}_ativ`;
      const keyAtivR = `log_r_${exKeySanitized}_ativ`;
      const valAtivC = (currentData.logs && currentData.logs[keyAtivC]) || '';
      const valAtivR = (currentData.logs && currentData.logs[keyAtivR]) || '';

      const keyBoC = `log_c_${exKeySanitized}_bo`;
      const keyBoR = `log_r_${exKeySanitized}_bo`;
      const valBoC = (currentData.logs && currentData.logs[keyBoC]) || '';
      const valBoR = (currentData.logs && currentData.logs[keyBoR]) || '';

      const nAtiv = parseFloat(valAtivC) || 0;
      let c20Myo = nAtiv > 0 ? Math.round(nAtiv * 0.80) : 0;
      let c30Myo = nAtiv > 0 ? Math.round(nAtiv * 0.70) : 0;

      html += `
        <div class="series-row" style="background:var(--mark-dim); border:1px solid var(--mark); border-left:2px solid var(--mark);">
          <button type="button" class="btn-check-serie" data-num="1" onclick="toggleCheckSerie(this)">Ativação</button>
          <input id="input_ativ_${exKeySanitized}" ${createLogInputAttr(keyAtivC)} class="input-field input-log" style="width:55px;" placeholder="Kg" value="${escapeHtml(valAtivC)}" oninput="atualizarBackoffLiveMyo('${exKeySanitized}', ${dayIdx}, ${exIdx}); scheduleAutoSave('${keyAtivC}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">kg</span>
          <input ${createLogInputAttr(keyAtivR)} class="input-field input-log" style="width:65px;" placeholder="${exMeta || '8-12'}" value="${escapeHtml(valAtivR)}" oninput="scheduleAutoSave('${keyAtivR}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>
        <div style="font-size:10px; color:var(--mark); margin:3px 0 5px 4px; font-weight:700;">
          ⏱ Myo-Reps (Mini-séries com 15-20s de descanso).
        </div>
        <div style="background:var(--signal-dim); border:1px solid var(--signal-light); border-radius:6px; padding:8px; margin-top:4px;">
          <div style="font-size:11px; font-weight:600; color:var(--signal-light); margin-bottom:4px;">⚙️ Back-off Set (Redução de 20% a 30%):</div>
          <div id="calc_backoff_box_myo_${exKeySanitized}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
            ${nAtiv > 0 ? `
              <div style="display:flex; gap:4px; width:100%;">
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--mark); color:var(--mark);" 
                  onclick="aplicarCargaBackoff('${keyBoC}',${c20Myo}, ${dayIdx},${exIdx})">
                  -20% (${c20Myo}kg)
                </button>
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
                  onclick="aplicarCargaBackoff('${keyBoC}',${c30Myo}, ${dayIdx},${exIdx})">
                  -30% (${c30Myo}kg)
                </button>
              </div>
            ` : `<span style="font-size:10px; color:var(--ink-dim);">Digite a carga de ativação para calcular o Back-off</span>`}
          </div>
          <div class="series-row" style="background:var(--panel); border:1px solid var(--line);">
            <button type="button" class="btn-check-serie" data-num="2" onclick="toggleCheckSerie(this)">Back-off</button>
            <input id="input_${keyBoC}" ${createLogInputAttr(keyBoC)} class="input-field input-log" style="width:55px; border-color:var(--signal-light) !important;" placeholder="Kg" value="${escapeHtml(valBoC)}" oninput="scheduleAutoSave('${keyBoC}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">kg</span>
            <input ${createLogInputAttr(keyBoR)} class="input-field input-log" style="width:65px; border-color:var(--signal-light) !important;" placeholder="${exMeta || '10-12'}" value="${escapeHtml(valBoR)}" oninput="scheduleAutoSave('${keyBoR}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">reps</span>
          </div>
        </div>
      `;
    } else if (activeMode === 'cluster') {
      const keyClC = `log_c_${exKeySanitized}_cl_peso`;
      const keyClB = `log_b_${exKeySanitized}_cl_blocos`;
      const keyClR = `log_r_${exKeySanitized}_cl_lastreps`;

      const valClC = (currentData.logs && currentData.logs[keyClC]) || '';
      const valClB = (currentData.logs && currentData.logs[keyClB]) || '';
      const valClR = (currentData.logs && currentData.logs[keyClR]) || '';

      html += `
        <div class="series-row" style="background:var(--good-dim); border:1px solid var(--good); border-left:2px solid var(--good);">
          <button type="button" class="btn-check-serie" data-num="1" onclick="toggleCheckSerie(this)">Cluster</button>
          <input ${createLogInputAttr(keyClC)} class="input-field input-log" style="width:55px; border-color:var(--good) !important;" placeholder="Kg" value="${escapeHtml(valClC)}" oninput="scheduleAutoSave('${keyClC}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">kg</span>
          <input ${createLogInputAttr(keyClB)} class="input-field input-log" style="width:55px; border-color:var(--good) !important;" placeholder="Blocos" value="${escapeHtml(valClB)}" oninput="scheduleAutoSave('${keyClB}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit" style="font-size:9px;">blocos</span>
          <input ${createLogInputAttr(keyClR)} class="input-field input-log" style="width:65px; border-color:var(--good) !important;" placeholder="${exMeta || 'Últ. Bloco'}" value="${escapeHtml(valClR)}" oninput="scheduleAutoSave('${keyClR}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>
      `;
    } else if (activeMode === 'cluster_backoff') {
      const keyClC = `log_c_${exKeySanitized}_cl_peso`;
      const keyClB = `log_b_${exKeySanitized}_cl_blocos`;
      const keyClR = `log_r_${exKeySanitized}_cl_lastreps`;
      const keyBoC = `log_c_${exKeySanitized}_s2`;
      const keyBoR = `log_r_${exKeySanitized}_s2`;

      const valClC = (currentData.logs && currentData.logs[keyClC]) || '';
      const valClB = (currentData.logs && currentData.logs[keyClB]) || '';
      const valClR = (currentData.logs && currentData.logs[keyClR]) || '';
      const valBoC = (currentData.logs && currentData.logs[keyBoC]) || '';
      const valBoR = (currentData.logs && currentData.logs[keyBoR]) || '';

      const nCl = parseFloat(valClC) || 0;
      let carga20Cl = nCl > 0 ? Math.round(nCl * 0.80) : 0;
      let carga30Cl = nCl > 0 ? Math.round(nCl * 0.70) : 0;

      html += `
        <div class="series-row" style="background:var(--good-dim); border:1px solid var(--good); border-left:2px solid var(--good);">
          <button type="button" class="btn-check-serie" data-num="1" onclick="toggleCheckSerie(this)">Cluster</button>
          <input ${createLogInputAttr(keyClC)} class="input-field input-log" style="width:55px; border-color:var(--good) !important;" placeholder="Kg" value="${escapeHtml(valClC)}" oninput="atualizarBackoffLive('${exKeySanitized}', 'cl', ${dayIdx}, ${exIdx}); scheduleAutoSave('${keyClC}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">kg</span>
          <input ${createLogInputAttr(keyClB)} class="input-field input-log" style="width:55px; border-color:var(--good) !important;" placeholder="Blocos" value="${escapeHtml(valClB)}" oninput="scheduleAutoSave('${keyClB}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit" style="font-size:9px;">blocos</span>
          <input ${createLogInputAttr(keyClR)} class="input-field input-log" style="width:65px; border-color:var(--good) !important;" placeholder="${exMeta || 'Últ. Bloco'}" value="${escapeHtml(valClR)}" oninput="scheduleAutoSave('${keyClR}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>
        <div style="background:var(--signal-dim); border:1px solid var(--signal-light); border-radius:6px; padding:8px; margin-top:4px;">
          <div style="font-size:11px; font-weight:600; color:var(--signal-light); margin-bottom:4px;">⚙️ Back-off Set (Redução de 20% a 30%):</div>
          <div id="calc_backoff_box_${exKeySanitized}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
            ${nCl > 0 ? `
              <div style="display:flex; gap:4px; width:100%;">
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--mark); color:var(--mark);" 
                  onclick="aplicarCargaBackoff('${keyBoC}',${carga20Cl}, ${dayIdx},${exIdx})">
                  -20% (${carga20Cl}kg)
                </button>
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
                  onclick="aplicarCargaBackoff('${keyBoC}',${carga30Cl}, ${dayIdx},${exIdx})">
                  -30% (${carga30Cl}kg)
                </button>
              </div>
            ` : `<span style="font-size:10px; color:var(--ink-dim);">Digite a carga no Cluster para calcular o peso ideal do Back-off</span>`}
          </div>
          <div class="series-row" style="background:var(--panel); border:1px solid var(--line);">
            <button type="button" class="btn-check-serie" data-num="2" onclick="toggleCheckSerie(this)">Back-off</button>
            <input id="input_${keyBoC}" ${createLogInputAttr(keyBoC)} class="input-field input-log" style="width:55px; border-color:var(--signal-light) !important;" placeholder="Kg" value="${escapeHtml(valBoC)}" oninput="scheduleAutoSave('${keyBoC}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">kg</span>
            <input ${createLogInputAttr(keyBoR)} class="input-field input-log" style="width:65px; border-color:var(--signal-light) !important;" placeholder="${exMeta || '10-12'}" value="${escapeHtml(valBoR)}" oninput="scheduleAutoSave('${keyBoR}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">reps</span>
          </div>
        </div>
      `;
    } else if (activeMode === 'backoff_2x') {
      const keyS1C = `log_c_${exKeySanitized}_s1`;
      const keyS1R = `log_r_${exKeySanitized}_s1`;
      const keyS2C = `log_c_${exKeySanitized}_s2`;
      const keyS2R = `log_r_${exKeySanitized}_s2`;
      const keyBoC = `log_c_${exKeySanitized}_bo`;
      const keyBoR = `log_r_${exKeySanitized}_bo`;

      const valS1C = (currentData.logs && currentData.logs[keyS1C]) || '';
      const valS1R = (currentData.logs && currentData.logs[keyS1R]) || '';
      const valS2C = (currentData.logs && currentData.logs[keyS2C]) || '';
      const valS2R = (currentData.logs && currentData.logs[keyS2R]) || '';
      const valBoC = (currentData.logs && currentData.logs[keyBoC]) || '';
      const valBoR = (currentData.logs && currentData.logs[keyBoR]) || '';

      const nS1 = parseFloat(valS1C) || 0;
      const nS2 = parseFloat(valS2C) || 0;
      const maiorCarga = Math.max(nS1, nS2);
      let c20 = maiorCarga > 0 ? Math.round(maiorCarga * 0.80) : 0;
      let c30 = maiorCarga > 0 ? Math.round(maiorCarga * 0.70) : 0;

      html += `
        <div class="series-row">
          <button type="button" class="btn-check-serie" data-num="1" onclick="toggleCheckSerie(this)">Série 1</button>
          <input id="input_log_c_${exKeySanitized}_s1" ${createLogInputAttr(keyS1C)} class="input-field input-log" style="width:55px;" placeholder="Kg" value="${escapeHtml(valS1C)}" oninput="atualizarBackoffLive('${exKeySanitized}', 'norm', ${dayIdx}, ${exIdx}); scheduleAutoSave('${keyS1C}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">kg</span>
          <input ${createLogInputAttr(keyS1R)} class="input-field input-log" style="width:65px;" placeholder="${exMeta || 'Reps'}" value="${escapeHtml(valS1R)}" oninput="scheduleAutoSave('${keyS1R}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>
        <div class="series-row">
          <button type="button" class="btn-check-serie" data-num="2" onclick="toggleCheckSerie(this)">Série 2</button>
          <input id="input_log_c_${exKeySanitized}_s2" ${createLogInputAttr(keyS2C)} class="input-field input-log" style="width:55px;" placeholder="Kg" value="${escapeHtml(valS2C)}" oninput="atualizarBackoffLive('${exKeySanitized}', 'norm', ${dayIdx}, ${exIdx}); scheduleAutoSave('${keyS2C}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">kg</span>
          <input ${createLogInputAttr(keyS2R)} class="input-field input-log" style="width:65px;" placeholder="${exMeta || 'Reps'}" value="${escapeHtml(valS2R)}" oninput="scheduleAutoSave('${keyS2R}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>
        <div style="background:var(--signal-dim); border:1px solid var(--signal-light); border-radius:6px; padding:8px; margin-top:4px;">
          <div style="font-size:11px; font-weight:600; color:var(--signal-light); margin-bottom:4px;">⚙️ Back-off Set (Redução de 20% a 30%):</div>
          <div id="calc_backoff_box_${exKeySanitized}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
            ${maiorCarga > 0 ? `
              <div style="display:flex; gap:4px; width:100%;">
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--mark); color:var(--mark);" 
                  onclick="aplicarCargaBackoff('${keyBoC}', ${c20}, ${dayIdx}, ${exIdx})">
                  -20% (${c20}kg)
                </button>
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
                  onclick="aplicarCargaBackoff('${keyBoC}', ${c30}, ${dayIdx}, ${exIdx})">
                  -30% (${c30}kg)
                </button>
              </div>
            ` : `<span style="font-size:10px; color:var(--ink-dim);">Digite a carga nas séries convencionais para calcular o Back-off</span>`}
          </div>
          <div class="series-row" style="background:var(--panel); border:1px solid var(--line);">
            <button type="button" class="btn-check-serie" data-num="3" onclick="toggleCheckSerie(this)">Back-off</button>
            <input id="input_${keyBoC}" ${createLogInputAttr(keyBoC)} class="input-field input-log" style="width:55px; border-color:var(--signal-light) !important;" placeholder="Kg" value="${escapeHtml(valBoC)}" oninput="scheduleAutoSave('${keyBoC}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">kg</span>
            <input ${createLogInputAttr(keyBoR)} class="input-field input-log" style="width:65px; border-color:var(--signal-light) !important;" placeholder="${exMeta || '10-12'}" value="${escapeHtml(valBoR)}" oninput="scheduleAutoSave('${keyBoR}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">reps</span>
          </div>
        </div>
      `;
    } else {
      for (let s = 1; s <= numSeriesPrescritas; s++) {
        const keyLoad = `log_c_${exKeySanitized}_s${s}`;
        const keyReps = `log_r_${exKeySanitized}_s${s}`;
        const savedLoad = (currentData.logs && currentData.logs[keyLoad]) || '';
        const savedReps = (currentData.logs && currentData.logs[keyReps]) || '';

        html += `
          <div class="series-row">
            <button type="button" class="btn-check-serie" data-num="${s}" onclick="toggleCheckSerie(this)">Série ${s}</button>
            <input ${createLogInputAttr(keyLoad)} class="input-field input-log" style="width:55px;" placeholder="Kg" value="${escapeHtml(savedLoad)}" oninput="scheduleAutoSave('${keyLoad}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">kg</span>
            <input ${createLogInputAttr(keyReps)} class="input-field input-log" style="width:65px;" placeholder="${exMeta || 'Reps'}" value="${escapeHtml(savedReps)}" oninput="scheduleAutoSave('${keyReps}', this.value, ${dayIdx}, ${exIdx})">
            <span class="unit">reps</span>
          </div>
        `;
      }
    }

    html += `</div>`;
    div.innerHTML = html;
    container.appendChild(div);
  });
}

function atualizarBackoffLive(exKeySanitized, tipo, dayIdx, exIdx) {
  const box = document.getElementById(`calc_backoff_box_${exKeySanitized}`);
  if (!box) return;

  let maiorCarga = 0;
  const elS1 = document.getElementById(`input_log_c_${exKeySanitized}_s1`);
  const elS2 = document.getElementById(`input_log_c_${exKeySanitized}_s2`);
  const v1 = elS1 ? (parseFloat(elS1.value) || 0) : 0;
  const v2 = elS2 ? (parseFloat(elS2.value) || 0) : 0;
  maiorCarga = Math.max(v1, v2);
  const keyBoC = `log_c_${exKeySanitized}_bo`;

  if (maiorCarga > 0) {
    const c20 = Math.round(maiorCarga * 0.80);
    const c30 = Math.round(maiorCarga * 0.70);

    box.innerHTML = `
      <div style="display:flex; gap:4px; width:100%;">
        <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--mark); color:var(--mark);" 
          onclick="aplicarCargaBackoff('${keyBoC}', ${c20}, ${dayIdx}, ${exIdx})">
          -20% (${c20}kg)
        </button>
        <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
          onclick="aplicarCargaBackoff('${keyBoC}', ${c30}, ${dayIdx}, ${exIdx})">
          -30% (${c30}kg)
        </button>
      </div>
    `;
  } else {
    box.innerHTML = `<span style="font-size:10px; color:var(--ink-dim);">Digite a carga nas séries convencionais para calcular o Back-off</span>`;
  }
}

function atualizarBackoffLiveMyo(exKeySanitized, dayIdx, exIdx) {
  const box = document.getElementById(`calc_backoff_box_myo_${exKeySanitized}`);
  if (!box) return;

  const elAtiv = document.getElementById(`input_ativ_${exKeySanitized}`);
  const cargaAtiv = elAtiv ? (parseFloat(elAtiv.value) || 0) : 0;
  const keyBoC = `log_c_${exKeySanitized}_bo`;

  if (cargaAtiv > 0) {
    const c20 = Math.round(cargaAtiv * 0.80);
    const c30 = Math.round(cargaAtiv * 0.70);

    box.innerHTML = `
      <div style="display:flex; gap:4px; width:100%;">
        <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--mark); color:var(--mark);" 
          onclick="aplicarCargaBackoff('${keyBoC}', ${c20}, ${dayIdx}, ${exIdx})">
          -20% (${c20}kg)
        </button>
        <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
          onclick="aplicarCargaBackoff('${keyBoC}', ${c30}, ${dayIdx}, ${exIdx})">
          -30% (${c30}kg)
        </button>
      </div>
    `;
  } else {
    box.innerHTML = `<span style="font-size:10px; color:var(--ink-dim);">Digite a carga de ativação para calcular o Back-off</span>`;
  }
}

function scheduleAutoSave(key, value, dayIdx, exIdx) {
  if (!workoutTimerRunning) {
    alert("⚠️ Clique em '▶ INICIAR TREINO' antes de registrar dados!");
    return;
  }

  if (!currentData.logs) currentData.logs = {};
  currentData.logs[key] = value;

  if (loggedUserCode) {
    localStorage.setItem(`draft_student_logs_${loggedUserCode}`, JSON.stringify(currentData.logs));
  }

  if (dayIdx !== undefined && exIdx !== undefined) {
    calculateAndStoreWeeklyLog(dayIdx, exIdx);
  }

  const ind = document.getElementById('saveIndicator');
  if (ind) ind.style.display = 'block';

  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  autoSaveTimer = setTimeout(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
        method: "POST",
        headers: authHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
      });
      if (ind) ind.style.display = 'none';
    } catch (e) {
      if (ind) ind.style.display = 'none';
    }
  }, 1200);
}

function calculateAndStoreWeeklyLog(dayIdx, exIdx) {
  if (!currentData.weekly_logs) currentData.weekly_logs = {};
  
  if (!currentData.days || !currentData.days[dayIdx] || !currentData.days[dayIdx].exercicios[exIdx]) return;

  const exObj = currentData.days[dayIdx].exercicios[exIdx];
  const cleanExName = (exObj.nome || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  const exKeySanitized = sanitizeExKey(cleanExName);
  const keyLog = `${dayIdx}_${exIdx}`;

  const seriesStr = String(exObj.series || '').toLowerCase();
  const isStrict1x = seriesStr.includes('1x') || seriesStr.trim() === '1';
  const numSeries = isStrict1x ? 1 : (parseInt(exObj.series) || 3);

  const modeKey = `${dayIdx}_${exIdx}`;
  const savedUserMode = (currentData.exercise_modes && currentData.exercise_modes[modeKey]) || 'convencional';
  
  const nomesTecnica = {
    'convencional': isStrict1x ? 'Série Única' : 'Convencional',
    'myoreps': 'Myo-Reps',
    'cluster': 'Cluster Set',
    'cluster_backoff': 'Cluster + Back-Off',
    'backoff_2x': '2x + Back-Off'
  };
  const tecnicaUsada = nomesTecnica[savedUserMode] || 'Convencional';

  let maxCarga = 0;
  let totalReps = 0;
  let seriesPreenchidas = 0;

  for (let s = 1; s <= numSeries + 2; s++) {
    const cVal = parseFloat(currentData.logs[`log_c_${exKeySanitized}_s${s}`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_s${s}`]);
    const rVal = parseFloat(currentData.logs[`log_r_${exKeySanitized}_s${s}`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_s${s}`]);

    if (!isNaN(cVal) && cVal > maxCarga) maxCarga = cVal;
    if (!isNaN(rVal)) {
      totalReps += rVal;
      seriesPreenchidas++;
    }
  }

  const cAtiv = parseFloat(currentData.logs[`log_c_${exKeySanitized}_ativ`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_ativ`]);
  const rAtiv = parseFloat(currentData.logs[`log_r_${exKeySanitized}_ativ`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_ativ`]);
  if (!isNaN(cAtiv) && cAtiv > maxCarga) maxCarga = cAtiv;
  if (!isNaN(rAtiv)) { totalReps += rAtiv; seriesPreenchidas++; }

  const cCl = parseFloat(currentData.logs[`log_c_${exKeySanitized}_cl_peso`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_cl_peso`]);
  const rCl = parseFloat(currentData.logs[`log_r_${exKeySanitized}_cl_lastreps`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_cl_lastreps`]);
  if (!isNaN(cCl) && cCl > maxCarga) maxCarga = cCl;
  if (!isNaN(rCl)) { totalReps += rCl; seriesPreenchidas++; }

  const cBo = parseFloat(currentData.logs[`log_c_${exKeySanitized}_bo`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_bo`]);
  const rBo = parseFloat(currentData.logs[`log_r_${exKeySanitized}_bo`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_bo`]);
  if (!isNaN(cBo) && cBo > maxCarga) maxCarga = cBo;
  if (!isNaN(rBo)) { totalReps += rBo; seriesPreenchidas++; }

  if (maxCarga > 0) {
    const mediaReps = seriesPreenchidas > 0 ? Math.round(totalReps / seriesPreenchidas) : "-";
    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    if (!currentData.weekly_logs[exKeySanitized]) currentData.weekly_logs[exKeySanitized] = [];

    let hist = currentData.weekly_logs[exKeySanitized];
    
    const idxHoje = hist.findIndex(item => item.data === dataHoje);
    if (idxHoje !== -1) {
      hist[idxHoje] = { data: dataHoje, cargaMax: maxCarga, repsMed: mediaReps, tecnica: tecnicaUsada };
    } else {
      hist.push({ data: dataHoje, cargaMax: maxCarga, repsMed: mediaReps, tecnica: tecnicaUsada });
    }

    if (hist.length > 4) hist = hist.slice(-4);
    currentData.weekly_logs[exKeySanitized] = hist;
    currentData.weekly_logs[keyLog] = hist;
  }
}

function parseDietaAluno(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const abas = [];
  const rawAbas = rawText.split(/(?=\[\s*ABA\s*\]|\[\s*CICLO\s*\]|---)/gi);

  rawAbas.forEach((rawAba, abaIdx) => {
    const cleanAba = rawAba.trim();
    if (!cleanAba || cleanAba === '---') return;

    let abaNome = `Ciclo ${abaIdx + 1}`;
    let textContent = cleanAba;

    if (/^(\[\s*ABA\s*\]|\[\s*CICLO\s*\])/i.test(cleanAba)) {
      const linesAba = cleanAba.split('\n');
      abaNome = linesAba[0].replace(/\[\s*ABA\s*\]|\[\s*CICLO\s*\]/gi, '').trim();

      let startIdx = 1;
      if (linesAba.length > 1 && linesAba[1].toLowerCase().trim().startsWith('dias:')) {
        startIdx = 2;
      }
      textContent = linesAba.slice(startIdx).join('\n').trim();
    }

    const regexTitulosRefeicao = /(?=\[\s*REFEIÇÃO\s*\]|\[\s*DIETA BASE\s*\]|\d+ª\s*Refeição|Refeição\s*\d+|REF\s*\d+|CAFÉ DA MANHÃ|ALMOÇO|LANCHE PÓS CORRIDA|CAFÉ DA TARDE|JANTAR|CEIA)/gi;
    const rawMeals = textContent.split(regexTitulosRefeicao);
    const meals = [];

    rawMeals.forEach(bloco => {
      const clean = bloco.trim();
      if (!clean) return;

      const lines = clean.split('\n').map(l => l.trim()).filter(l => l !== '' && l.toLowerCase() !== 'a gosto' && l.toLowerCase() !== 'qtd');
      if (lines.length === 0) return;

      let title = lines[0].replace(/^\[.*?\]\s*/, '').trim();

      if (title.toLowerCase() === 'plano alimentar') {
        if (lines.length > 1) {
          title = lines[1].replace(/^\[.*?\]\s*/, '').trim();
          lines.splice(0, 1);
        } else {
          return;
        }
      }

      let days = "";
      const baseItems = [];
      const trocasCarbo = [];
      const trocasProt = [];

      lines.slice(1).forEach(line => {
        let lineClean = line.replace(/\[\s*\]/g, '').trim();
        const lineLower = lineClean.toLowerCase();
        
        if (lineLower.startsWith('dias:') || lineLower.startsWith('dias da semana:')) {
          days = lineClean.replace(/^dias(\s*da\s*semana)?:/i, '📅 Dias:').trim();
          if (!days.startsWith('📅')) days = '📅 ' + days;
        } else if (lineClean.includes('↳') || lineClean.includes('(Opção de troca)') || lineClean.includes('(Troca)') || lineClean.includes('Trocas de') || lineClean.includes('Carboidratos:') || lineClean.includes('Proteínas')) {
          let itemTxt = lineClean.replace(/↳|Opção de Troca|\(Carboidrato\):|\(Proteína\):|\(Opção de troca\)|\(Troca\)/gi, '').replace(/^[-•*]\s*/, '').trim();
          if (!itemTxt || itemTxt.toLowerCase().includes('trocas de')) return;
          
          itemTxt = itemTxt.replace(/\[\s*CARBO\s*\]/gi, '').replace(/\[\s*PROT\s*\]/gi, '').replace(/\[\s*\]/g, '').trim();

          if (lineClean.toUpperCase().includes('[CARBO]') || lineClean.toLowerCase().includes('carbo') || lineClean.toLowerCase().includes('carboidrato')) {
            trocasCarbo.push(itemTxt);
          } else if (lineClean.toUpperCase().includes('[PROT]') || lineClean.toLowerCase().includes('prot') || lineClean.toLowerCase().includes('proteína') || lineClean.toLowerCase().includes('proteina')) {
            trocasProt.push(itemTxt);
          } else {
            trocasCarbo.push(itemTxt);
          }
        } else {
          const cleanItem = lineClean.replace(/^[-•*]\s*/, '').trim();
          if (cleanItem && cleanItem.toLowerCase() !== 'plano alimentar') {
            baseItems.push(cleanItem);
          }
        }
      });

      meals.push({
        mealTitle: title,
        days: days,
        baseItems: baseItems,
        trocasCarbo: trocasCarbo,
        trocasProt: trocasProt
      });
    });

    if (meals.length > 0) {
      abas.push({ abaNome: abaNome || `Opção ${abaIdx + 1}`, meals: meals, fullText: cleanAba.toLowerCase() });
    }
  });

  if (abas.length === 0 && rawText.trim() !== '') {
    abas.push({
      abaNome: "Plano Alimentar",
      meals: [{
        mealTitle: "Refeição Diária",
        days: "",
        baseItems: rawText.split('\n').map(l => l.trim()).filter(l => l !== ''),
        trocasCarbo: [],
        trocasProt: []
      }],
      fullText: rawText.toLowerCase()
    });
  }

  return abas;
}

function trocarAbaDieta(valIndex) {
  activeAlunoDietAbaIndex = parseInt(valIndex) || 0;
  renderDietaAluno(currentData.refeicoes || currentData.dieta || []);
}

function renderDietaAluno(refeicoesData) {
  const categoryList = document.getElementById('dietCategoryList');
  const selectAba = document.getElementById('dietAbaSelect');
  const dayLabel = document.getElementById('dietCurrentDayLabel');

  if (!categoryList) return;
  categoryList.innerHTML = "";

  let rawText = "";
  if (Array.isArray(refeicoesData)) {
    refeicoesData.forEach(r => {
      if (typeof r === 'string') {
        rawText += `${r}\n\n`;
      } else if (r.titulo || r.alimentos || r.mealTitle) {
        const t = r.titulo || r.mealTitle || 'Refeição';
        const a = r.alimentos || (r.baseItems ? r.baseItems.join('\n') : '');
        rawText += `[REFEIÇÃO] ${t}\n${a}\n\n`;
      }
    });
  } else if (typeof refeicoesData === 'string') {
    rawText = refeicoesData;
  }

  let abas = parseDietaAluno(rawText);

  if (abas.length > 1) {
    abas = abas.filter(aba => {
      const nomeUpper = (aba.abaNome || '').trim().toUpperCase();
      return nomeUpper !== 'PLANO ALIMENTAR' && nomeUpper !== 'PLANO PRINCIPAL';
    });
  }

  if (!abas || abas.length === 0) {
    categoryList.innerHTML = `<div style="font-size:13px; color:var(--ink-dim); text-align:center; padding:20px;">Nenhum ciclo alimentar cadastrado para hoje.</div>`;
    return;
  }

  const diaHojeKey = obterDiaSemanaNormalizado();
  const nomeHojeFmt = obterNomeDiaSemanaFormatado();
  let abaIndexHoje = -1;

  abas.forEach((aba, idx) => {
    const textoAbaNorm = (aba.fullText || (aba.abaNome + " " + JSON.stringify(aba.meals))).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (textoAbaNorm.includes(diaHojeKey)) {
      abaIndexHoje = idx;
    }
  });

  if (abaIndexHoje === -1) abaIndexHoje = 0;

  if (activeAlunoDietAbaIndex === null || activeAlunoDietAbaIndex === undefined || activeAlunoDietAbaIndex >= abas.length) {
    activeAlunoDietAbaIndex = abaIndexHoje;
  }

  if (dayLabel) {
    dayLabel.innerHTML = `📅 Hoje (${nomeHojeFmt})`;
  }

  if (selectAba) {
    selectAba.innerHTML = "";
    abas.forEach((aba, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      const ehHoje = (idx === abaIndexHoje);
      option.textContent = `${aba.abaNome || 'Ciclo ' + (idx + 1)} ${ehHoje ? '📌 (Hoje)' : ''}`;
      if (idx === activeAlunoDietAbaIndex) option.selected = true;
      selectAba.appendChild(option);
    });
  }

  const currentAba = abas[activeAlunoDietAbaIndex] || abas[0];
  if (currentAba && currentAba.meals) {
    currentAba.meals.forEach((meal, idx) => {
      if ((meal.mealTitle || '').trim().toUpperCase() === 'PLANO ALIMENTAR' && currentAba.meals.length > 1) return;

      const card = document.createElement('div');
      card.style.cssText = "background:var(--panel-2); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:12px;";

      const uniqueId = `trocas_aluno_${activeAlunoDietAbaIndex}_${idx}`;

      let html = `
        <div style="border-bottom:1px solid var(--line); padding-bottom:8px; margin-bottom:10px;">
          <h3 style="color:var(--mark); font-size:15px; font-weight:800;">🍽 ${escapeHtml(meal.mealTitle || 'Refeição')}</h3>
          ${meal.days ? `<span style="font-size:11px; color:var(--blue); font-weight:700;">${escapeHtml(meal.days)}</span>` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
      `;

      (meal.baseItems || []).forEach(item => {
        html += `<div style="font-size:13px; color:var(--ink); font-weight:600;">• ${escapeHtml(item)}</div>`;
      });

      html += `</div>`;

      if ((meal.trocasCarbo && meal.trocasCarbo.length > 0) || (meal.trocasProt && meal.trocasProt.length > 0)) {
        html += `
          <div style="border-top:1px dashed var(--line); padding-top:8px;">
            <button type="button" onclick="const el = document.getElementById('${uniqueId}'); if(el) el.classList.toggle('hidden');" style="background:var(--panel); border:1px solid var(--mark); color:var(--mark); width:100%; padding:8px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer;">
              🔄 VER OPÇÕES DE TROCA / SUBSTITUIÇÃO ▾
            </button>
            
            <div id="${uniqueId}" class="hidden" style="margin-top:8px; background:var(--bg); padding:10px; border-radius:8px;">
        `;

        if (meal.trocasCarbo && meal.trocasCarbo.length > 0) {
          html += `<div style="font-size:11px; color:var(--blue); font-weight:800; margin-bottom:4px;">🌾 Trocas de Carboidratos:</div>`;
          meal.trocasCarbo.forEach(subC => {
            html += `<div class="sub-item-box carbo">• ${escapeHtml(subC)}</div>`;
          });
        }

        if (meal.trocasProt && meal.trocasProt.length > 0) {
          html += `<div style="font-size:11px; color:var(--good); font-weight:800; margin-top:6px; margin-bottom:4px;">🥩 Trocas de Proteínas / Gorduras:</div>`;
          meal.trocasProt.forEach(subP => {
            html += `<div class="sub-item-box prot">• ${escapeHtml(subP)}</div>`;
          });
        }

        html += `</div></div>`;
      }

      card.innerHTML = html;
      categoryList.appendChild(card);
    });
  }
}

const TAB_ORDER = ['treino', 'dieta', 'corrida', 'iaChat', 'feedback'];

function showTab(tab) {
  TAB_ORDER.forEach(t => {
    const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`btn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (el) el.classList.add('hidden');
    if (btn) btn.classList.remove('active');
  });

  const activeTab = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  const activeBtn = document.getElementById(`btn${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) activeBtn.classList.add('active');

  const restWidget = document.getElementById('restTimerWidget');
  if (restWidget) {
    if (tab === 'treino') {
      restWidget.classList.add('visible');
    } else {
      restWidget.classList.remove('visible');
    }
  }
}

let swipeNavReady = false;

function setupSwipeNavigation() {
  if (swipeNavReady) return;
  swipeNavReady = true;

  const viewport = document.getElementById('swipeViewport');
  if (!viewport) return;

  let startX = 0, startY = 0, tracking = false;
  const SWIPE_THRESHOLD = 55;

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;

    const activeIdx = TAB_ORDER.findIndex(t => {
      const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      return el && !el.classList.contains('hidden');
    });
    if (activeIdx === -1) return;

    let nextIdx = activeIdx;
    if (deltaX < 0 && activeIdx < TAB_ORDER.length - 1) nextIdx = activeIdx + 1;
    if (deltaX > 0 && activeIdx > 0) nextIdx = activeIdx - 1;

    if (nextIdx !== activeIdx) showTab(TAB_ORDER[nextIdx]);
  }, { passive: true });
}

async function sendStudentChatMessage() {
  const input = document.getElementById('studentChatInput');
  const history = document.getElementById('studentChatHistory');
  const btn = document.getElementById('btnSendIaChat');
  const text = input ? input.value.trim() : '';

  if (!text) return;

  const headers = authHeaders();
  if (!headers['Authorization']) {
    alert("Sua sessão expirou ou o token de acesso é inválido. Faça login novamente no aplicativo.");
    return;
  }

  history.innerHTML += `
    <div style="background:var(--signal-dim); padding:10px; border-radius:6px; font-size:12.5px; color:var(--ink); align-self:flex-end; border:1px solid var(--signal-light); max-width:85%;">
      <b>Você:</b> ${escapeHtml(text)}
    </div>
  `;
  if (input) input.value = '';

  const loadingId = 'loading_ia_' + Date.now();
  history.innerHTML += `
    <div id="${loadingId}" style="background:var(--panel-2); padding:10px; border-radius:6px; font-size:12.5px; color:var(--ink-dim); border:1px solid var(--line); align-self:flex-start; max-width:85%;">
      <b>Assistente:</b> <i>Gerando resposta...</i>
    </div>
  `;
  history.scrollTop = history.scrollHeight;

  if (btn) btn.disabled = true;

  const systemPrompt = "Você é o assistente virtual do Personal Jhonata. Responda à dúvida do aluno de forma clara, direta e objetiva. Ao final de TODA resposta, adicione exatamente este texto em uma nova linha: 'Mas caso ainda esteja com alguma dúvida em relação a isso é só chamar o Jhonata Personal no Wpp ou pela própria aba Feedbacks aqui do aplicativo.'";

  try {
    const res = await fetch(`${BACKEND_URL}/api/aluno/chat-ia`, {
      method: 'POST',
      headers: headers,
      cache: 'no-cache',
      body: JSON.stringify({ 
        mensagem: text, 
        contexto: currentData || {},
        systemPrompt: systemPrompt
      })
    });

    const data = await res.json();
    const loadingElem = document.getElementById(loadingId);

    if (res.ok && data.resposta) {
      let respostaTexto = data.resposta;
      const avisoFinal = "Mas caso ainda esteja com alguma dúvida em relação a isso é só chamar o Jhonata Personal no Wpp ou pela própria aba Feedbacks aqui do aplicativo.";
      
      if (!respostaTexto.includes("chamar o Jhonata Personal")) {
        respostaTexto += `\n\n${avisoFinal}`;
      }

      if (loadingElem) {
        loadingElem.style.color = "var(--ink)";
        loadingElem.innerHTML = `<b>Assistente:</b> ${escapeHtml(respostaTexto).replace(/\n/g, '<br>')}`;
      }
    } else {
      if (loadingElem) {
        loadingElem.innerHTML = `<span style="color:var(--signal-light);"><b>Assistente:</b> ${escapeHtml(data.error || 'Serviço indisponível no momento.')}</span>`;
      }
    }
  } catch (e) {
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) {
      loadingElem.innerHTML = `<span style="color:var(--signal-light);"><b>Assistente:</b> Erro de conexão com o servidor.</span>`;
    }
  } finally {
    if (btn) btn.disabled = false;
    history.scrollTop = history.scrollHeight;
  }
}

function previewFeedbackPhotos(event) {
  const files = Array.from(event.target.files);
  const previewContainer = document.getElementById('feedbackPhotoPreview');
  if (!previewContainer) return;
  previewContainer.innerHTML = '';
  selectedFeedbackFiles = files;

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width: 55px; height: 55px; object-fit: cover; border-radius: 6px; border: 1px solid var(--mark);';
      previewContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function renderFeedbackHistory() {
  const container = document.getElementById('alunoFeedbackHistory');
  if (!container) return;
  container.innerHTML = '';

  const feedbacks = (currentData && currentData.feedbacks) || [];

  if (feedbacks.length === 0) {
    container.innerHTML = '<div style="font-size:11.5px; color:var(--ink-dim); text-align:center; padding:12px;">Envie seu primeiro feedback semanal ou foto ao Personal abaixo!</div>';
    return;
  }

  feedbacks.forEach(f => {
    const isAluno = f.autor === "ALUNO";
    container.innerHTML += `
      <div style="background:${isAluno ? 'var(--signal-dim)' : 'var(--panel-2)'}; padding:8px 12px; border-radius:8px; font-size:12.5px; color:var(--ink); align-self:${isAluno ? 'flex-end' : 'flex-start'}; border:1px solid ${isAluno ? 'var(--signal-light)' : 'var(--line)'}; max-width:85%;">
        <b>${isAluno ? 'Você' : 'Personal Jhonata'}:</b> ${escapeHtml(f.mensagem)}
      </div>
    `;
  });
  container.scrollTop = container.scrollHeight;
}

async function enviarFeedbackAlunoApp() {
  const input = document.getElementById('alunoFeedbackInput');
  const msg = input ? input.value.trim() : '';
  const btn = document.getElementById('btnSendFeedbackPhotos');
  const nomeAluno = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;

  if (!msg && selectedFeedbackFiles.length === 0) {
    return alert("Escreva um relato ou selecione ao menos uma foto.");
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Enviando para o Drive...";
  }

  // Upload das fotos diretamente para o Google Drive
  let driveUrls = [];
  if (selectedFeedbackFiles.length > 0) {
    for (let i = 0; i < selectedFeedbackFiles.length; i++) {
      const file = selectedFeedbackFiles[i];
      const driveUrl = await enviarArquivoParaGoogleDrive(nomeAluno, file, `Feedback_${new Date().toISOString().split('T')[0]}_Foto_${i + 1}`);
      if (driveUrl) driveUrls.push(driveUrl);
    }
  }

  try {
    const token = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BACKEND_URL}/api/aluno/salvar-feedback`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        codigo: loggedUserCode,
        mensagem: msg,
        fotosDrive: driveUrls
      })
    });

    if (res.ok) {
      alert("Feedback e fotos enviados com sucesso para o seu arquivo no Google Drive!");
      if (input) input.value = '';
      selectedFeedbackFiles = [];
      const previewContainer = document.getElementById('feedbackPhotoPreview');
      if (previewContainer) previewContainer.innerHTML = '';
      const photoInput = document.getElementById('feedbackPhotoInput');
      if (photoInput) photoInput.value = '';
      
      if (!currentData.feedbacks) currentData.feedbacks = [];
      currentData.feedbacks.push({ autor: "ALUNO", mensagem: msg + (driveUrls.length > 0 ? " (Fotos anexadas no Drive)" : ""), data: new Date().toISOString() });
      renderFeedbackHistory();
    } else {
      alert("Feedback enviado, mas falhou ao sincronizar histórico.");
    }
  } catch (e) {
    alert("Erro na conexão com o servidor ao salvar o feedback.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enviar";
    }
  }
}

function sendWhatsAppFeedback() {
  const input = document.getElementById('alunoFeedbackInput');
  const text = input ? input.value.trim() : "";

  const nome = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;
  const msg = `*MENSAGEM DE FEEDBACK — ALUNO*%0A%0A*Aluno:* ${nome}%0A*Relatório:*%0A${encodeURIComponent(text || 'Olá Jhonata, gostaria de tirar uma dúvida!')}`;
  window.open(`https://wa.me/5551990169026?text=${msg}`, '_blank');
}

function logout() {
  localStorage.removeItem('logged_user');
  localStorage.removeItem('aluno_token');
  localStorage.removeItem('token');
  localStorage.removeItem('tokenAluno');
  
  currentData = null;
  loggedUserCode = "";
  currentTreinoDayIdx = 0;

  const restWidget = document.getElementById('restTimerWidget');
  if (restWidget) restWidget.classList.remove('visible');

  document.body.classList.remove('app-mode');
  document.getElementById('mainContent').classList.add('hidden');
  document.getElementById('anamneseScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');

  const errDiv = document.getElementById('loginError');
  if (errDiv) errDiv.classList.add('hidden');

  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, document.title, window.location.pathname);
  }
}
