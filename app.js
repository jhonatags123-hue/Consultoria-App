const BACKEND_URL = "[https://consultoria-backend-kbqi.onrender.com](https://consultoria-backend-kbqi.onrender.com)";

const ASAAS_LINKS = {
  'COMPLETA_ANUAL': "[https://www.asaas.com/c/5gd9tb7c0szjdwbd](https://www.asaas.com/c/5gd9tb7c0szjdwbd)",
  'COMPLETA_SEMESTRAL': "[https://www.asaas.com/c/oky8it88u28d4vat](https://www.asaas.com/c/oky8it88u28d4vat)",
  'COMPLETA_TRIMESTRAL': "[https://www.asaas.com/c/lvfk6qle0ufq0t57](https://www.asaas.com/c/lvfk6qle0ufq0t57)",
  'COMPLETA_MENSAL': "[https://www.asaas.com/c/5gd9tb7c0szjdwbd](https://www.asaas.com/c/5gd9tb7c0szjdwbd)",
  'COMPLETA_DUPLA_ANUAL': "[https://www.asaas.com/000/c/z4zlsoe009fz8tgu](https://www.asaas.com/000/c/z4zlsoe009fz8tgu)",
  'TREINO_ANUAL': "[https://www.asaas.com/c/v36oz63i4jg0cg2u](https://www.asaas.com/c/v36oz63i4jg0cg2u)",
  'TREINO_DUPLA_ANUAL': "[https://www.asaas.com/c/omsltaq25btnizvo](https://www.asaas.com/c/omsltaq25btnizvo)"
};

const DETALHES_PLANOS = {
  'COMPLETA_ANUAL': { valor: '12x R$ 85,00/mês', sub: 'Acompanhamento completo individual com treino + dieta.' },
  'COMPLETA_SEMESTRAL': { valor: '6x R$ 110,00/mês', sub: 'Protocolo completo semestral com suporte contínuo.' },
  'COMPLETA_TRIMESTRAL': { valor: '3x R$ 130,00/mês', sub: 'Acompanhamento trimestral focado em metas rápidas.' },
  'COMPLETA_DUPLA_ANUAL': { valor: '12x R$ 140,00/mês', sub: 'Plano em Dupla: apenas R$ 70,00 por mês para cada pessoa.' },
  'TREINO_ANUAL': { valor: '12x R$ 55,00/mês', sub: 'Ficha de treino contínua individual com ajuste de cargas.' },
  'TREINO_DUPLA_ANUAL': { valor: '12x R$ 80,00/mês', sub: 'Apenas R$ 40,00 por mês por pessoa para treinar em dupla.' }
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

function getAuthToken() {
  let token = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');
  if (!token) return null;
  token = token.trim().replace(/^"|"$/g, '');
  return token || null;
}

function authHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
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
  document.getElementById('resumoPlanoValor').textContent = info.valor;
  document.getElementById('resumoPlanoSub').textContent = info.sub;
}

function abrirModalIndique() { document.getElementById('modalIndique').classList.remove('hidden'); }
function fecharModalIndique() { document.getElementById('modalIndique').classList.add('hidden'); }
function abrirModalSenha() { document.getElementById('modalSenha').classList.remove('hidden'); }
function fecharModalSenha() { document.getElementById('modalSenha').classList.add('hidden'); }

function compartilharIndicaoWpp() {
  const nome = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;
  const msg = `*CONSULTORIA JHONATA PERSONAL*%0A%0AOlá! Estou treinando com a consultoria do Jhonata Personal e recomendo demais. Acesse o link para conhecer e fazer sua anamnese:%0A[https://jhonataconsultoria.com.br/app.html?modo=anamnese%0A%0A_Indicação](https://jhonataconsultoria.com.br/app.html?modo=anamnese%0A%0A_Indicação) do aluno: ${nome}_`;
  window.open(`[https://wa.me/?text=$](https://wa.me/?text=$){msg}`, '_blank');
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
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sábado'];
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
  widget.classList.remove('timer-finished-glow');

  updateTimerDisplay();

  restTimerInterval = setInterval(() => {
    restSecondsLeft--;
    updateTimerDisplay();

    if (restSecondsLeft <= 0) {
      clearInterval(restTimerInterval);
      widget.classList.add('timer-finished-glow');
      playBipSound();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      setTimeout(() => {
        widget.classList.remove('timer-finished-glow');
      }, 5000);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
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
    document.getElementById('workoutTimerClock').textContent = "00:00:00";
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

    btn.textContent = "⏹️ PAUSAR";
    btn.style.background = "var(--signal-light)";

    setInputsLockState(false);

    if (workoutTimerInterval) clearInterval(workoutTimerInterval);
    workoutTimerInterval = setInterval(updateWorkoutTimerDisplay, 1000);
    updateWorkoutTimerDisplay();
  } else {
    workoutTimerRunning = false;
    localStorage.removeItem(keyStart);
    if (workoutTimerInterval) clearInterval(workoutTimerInterval);

    btn.textContent = "▶ INICIAR TREINO";
    btn.style.background = "var(--good)";

    setInputsLockState(true);
  }
}

function updateWorkoutTimerDisplay() {
  const keyStart = `workout_start_time_${loggedUserCode}`;
  const startTimeStr = localStorage.getItem(keyStart);

  if (!startTimeStr) {
    document.getElementById('workoutTimerClock').textContent = "00:00:00";
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - parseInt(startTimeStr)) / 1000);
  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = elapsedSeconds % 60;

  const fmt = n => String(n).padStart(2, '0');
  document.getElementById('workoutTimerClock').textContent = `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
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
      document.getElementById('anamMainTitle').textContent = "Anamnese de Treino";
      document.getElementById('anamMainSub').textContent = "Preencha com atenção para a montagem da sua ficha personalizada de treino";
      
      const selectPlano = document.getElementById('anamTipoConsultoria');
      if (selectPlano && !isConvidadoDuplaMode) {
        selectPlano.innerHTML = `
          <option value="TREINO_ANUAL" selected>Consultoria de Treino Anual — 12x R$ 55,00/mês</option>
          <option value="TREINO_DUPLA_ANUAL">Promocional Treino para 2 Pessoas (Anual) — 12x R$ 80,00/mês</option>
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
  const alunoToken = getAuthToken();

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

  for (let i = 1; i <= 10; i++) document.getElementById(`anamStep${i}`).classList.add('hidden');
  document.getElementById(`anamStep${step}`).classList.remove('hidden');
  
  document.getElementById('progressBar').style.width = `${(step/10)*100}%`;
  document.getElementById('stepCounter').textContent = `Etapa ${step} de 10`;
  
  const btnVoltarStep10 = document.getElementById('btnVoltarStep10');
  if (btnVoltarStep10) {
    btnVoltarStep10.setAttribute('onclick', isApenasTreinoMode ? 'nextAnamStep(6)' : 'nextAnamStep(9)');
  }

  if (step === 10) atualizarResumoPrecoAnamnese();
}

function togglePaymentView() {
  const option = document.getElementById('anamFormaPagamento').value;
  const pixBox = document.getElementById('pixDiretoBox');
  if (option === 'PIX_DIRETO') pixBox.classList.remove('hidden');
  else pixBox.classList.add('hidden');
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

      const rawToken = String(result.token || '').trim();

      localStorage.setItem('logged_user', user);
      localStorage.setItem('aluno_token', rawToken);
      localStorage.setItem('token', rawToken);
      localStorage.setItem('tokenAluno', rawToken);
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

  if (pixInput && pixInput.files && pixInput.files[0]) {
    if (btn) {
      btn.textContent = "🤖 Analisando Comprovante...";
      btn.disabled = true;
    }

    const formData = new FormData();
    formData.append('comprovante', pixInput.files[0]);
    formData.append('dadosAnamnese', JSON.stringify(anamneseData));

    try {
      const res = await fetch(`${BACKEND_URL}/api/anamnese/processar-comprovante`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        document.getElementById('anamneseScreen').innerHTML = `
          <div style="text-align:center; padding:24px 10px;">
            <div style="font-size:48px; margin-bottom:12px;">✅</div>
            <h2 style="font-size:24px; font-weight:700; color:var(--good); font-family:var(--font-display);">
              Pagamento Confirmado!
            </h2>
            <p style="font-size:13.5px; color:var(--ink); margin-top:10px; line-height:1.6;">
              Seu comprovante foi validado e sua pasta de acompanhamento no Google Drive já foi criada!
            </p>
          </div>
        `;
        return;
      } else {
        alert(data.error || "Não foi possível validar o comprovante.");
        if (btn) {
          btn.textContent = "Finalizar e enviar";
          btn.disabled = false;
        }
        return;
      }
    } catch (e) {
      alert("Erro na conexão com o servidor.");
      if (btn) {
        btn.textContent = "Finalizar e enviar";
        btn.disabled = false;
      }
      return;
    }
  }

  if (btn) {
    btn.textContent = "Processando...";
    btn.disabled = true;
  }

  try {
    await fetch(`${BACKEND_URL}/api/anamnese/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: 'no-cache',
      body: JSON.stringify(anamneseData)
    });

    const redirectUrl = (formaPagamento === 'ASAAS_LINK' && !isConvidadoDuplaMode) 
      ? ASAAS_LINKS[tipoConsultoria] 
      : null;

    if (redirectUrl) {
      window.location.href = redirectUrl;
    } else {
      document.getElementById('anamneseScreen').innerHTML = `
        <div style="text-align:center; padding:24px 10px;">
          <div style="font-size:48px; margin-bottom:12px;">✅</div>
          <h2 style="font-size:26px; font-weight:700; color:var(--ink); font-family:var(--font-display);">
            Obrigado pela confiança
          </h2>
          <p style="font-size:13.5px; color:#e0d0d3; margin-top:10px; line-height:1.6;">
            Anamnese recebida com sucesso!
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
        Envie o comprovante no WhatsApp para reativar seu acesso na hora!
      </div>
      <a href="[https://wa.me/5551990169026?text=Ol%C3%A1%20Jhonata!%20Efetuei%20o%20pagamento%20da%20minha%20renova%C3%A7%C3%A3o](https://wa.me/5551990169026?text=Ol%C3%A1%20Jhonata!%20Efetuei%20o%20pagamento%20da%20minha%20renova%C3%A7%C3%A3o):" 
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

  document.getElementById('congratsText').textContent = `Parabéns! Você aumentou sua força em média +${data.evolucao_carga_pct}% em relação ao ciclo anterior.`;
  document.getElementById('congratsBox').classList.remove('hidden');
}

fecharCardEvolucao = function() {
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
        <input type="number" step="0.1" id="run_km_${d.key}" class="input-field" style="font-size:12px; padding:6px; height:36px;" placeholder="Km" value="${escapeHtml(kmVal)}">
        <input type="number" id="run_min_${d.key}" class="input-field" style="font-size:12px; padding:6px; height:36px;" placeholder="Min" value="${escapeHtml(minVal)}">
        <button type="button" class="btn-login btn-blue" style="width:70px; min-height:36px; padding:0; font-size:11px; margin-top:0;" onclick="salvarRunDia('${d.key}')">Salvar</button>
        <button type="button" class="btn-login" style="width:36px; min-height:36px; padding:0; font-size:12px; margin-top:0; background:var(--panel); border:1px solid var(--line); color:var(--signal-light);" title="Apagar" onclick="apagarRunDia('${d.key}')">🗑️</button>
      </div>
      <div id="run_pace_display_${d.key}" style="font-size:11.5px; font-weight:700; color:var(--blue); margin-top:6px;">
        ⏱ Pace do dia: <span>${paceDiaStr}</span> /km
      </div>
    `;
    presContainer.appendChild(card);
  });

  document.getElementById('runTotalKm').textContent = `${totalKm.toFixed(1)} km`;
  document.getElementById('runPaceMedio').textContent = calcularPaceTexto(totalKm, totalMin);
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
    listContainer.innerHTML = '<div style="font-size:13px; color:var(--ink-dim); text-align:center; padding:20px;">Treino em montagem.</div>';
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
    alert("⚠️ Clique em '▶ INICIAR TREINO' antes de começar!");
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
  document.getElementById('summaryTimeDisplay').textContent = m > 0 ? `${m} min e ${s} seg` : `${s} seg`;

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

      const rMed = seriesCount > 0 ? Math.round(rTotal / seriesCount) : 0;
      if (cMax > 0 || rMed > 0) {
        evolucoes.push({ nome: ex.nome, carga: cMax, reps: rMed, status: "✨ Treino registrado", color: "var(--mark)" });
      }
    });
  }

  document.getElementById('summaryVolumeDisplay').textContent = `${Math.round(volumeToneladoTotal)} kg`;
  if (evolucoes.length === 0) {
    summaryList.innerHTML = `<div style="color:var(--ink-dim); font-size:12px; text-align:center;">Preencha suas cargas!</div>`;
  } else {
    evolucoes.forEach(item => {
      summaryList.innerHTML += `
        <div class="progression-item">
          <b style="color:var(--ink);">${escapeHtml(item.nome)}</b>
          <span style="color:${item.color}; font-weight:700;">${item.status}</span> 
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

  const totalDays = (currentData.days || []).length;
  let proximoTreino = currentTreinoDayIdx;

  if (totalDays > 0) {
    proximoTreino = (currentTreinoDayIdx + 1) % totalDays;
    if (proximoTreino === 0) {
      currentData.semana_rotacao = ((currentData.semana_rotacao || 1) % 5) + 1;
      await resetCardioSemanal();
    }
  }

  currentData.ultimo_treino_idx = proximoTreino;

  try {
    await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      method: "POST",
      headers: authHeaders(),
      cache: 'no-cache',
      body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {}

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
    goalsContainer.innerHTML = customGuidelines.trim() ? escapeHtml(customGuidelines).replace(/\n/g, '<br>') : `Siga o plano de execução e registre suas cargas.`;
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
  const savedObs = (currentData.logs && currentData.logs[keyObs]) || localStorage.getItem(`draft_obs_${loggedUserCode}_${currentTreinoDayIdx}`) || '';

  const obsDiv = document.createElement('div');
  obsDiv.style.cssText = "margin-top:16px; background:var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:14px;";
  obsDiv.innerHTML = `
    <label class="label-fdb" style="color:var(--mark); font-size:12px;">📝 Observações / Como foi a sessão hoje?</label>
    <textarea class="input-field" id="input_obs_${currentTreinoDayIdx}" rows="2" style="font-size:14px; margin-top:4px;" 
      placeholder="Ex: Leve desconforto..." 
      oninput="salvarObservacaoTreino('${keyObs}', this.value, ${currentTreinoDayIdx})">${escapeHtml(savedObs)}</textarea>
  `;
  exercisesContainer.appendChild(obsDiv);

  checkAndRestoreWorkoutTimer();
}

function salvarObservacaoTreino(keyObs, valor, dayIdx) {
  if (!currentData.logs) currentData.logs = {};
  currentData.logs[keyObs] = valor;

  if (loggedUserCode) {
    localStorage.setItem(`draft_obs_${loggedUserCode}_${dayIdx}`, valor);
  }

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
        method: "POST",
        headers: authHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
      });
    } catch (e) {}
  }, 1200);
}

function createLogInputAttr(nameKey) {
  return `type="text" inputmode="decimal" form="none" name="workout_${nameKey}" autocomplete="off"`;
}

function renderExercisesForDay(day, dayIdx, container) {
  (day.exercicios || []).forEach((ex, exIdx) => {
    const keyExDone = `ex_done_${dayIdx}_${exIdx}`;
    const isExDone = (currentData.logs && currentData.logs[keyExDone]) === 'true';

    const exName = ex.nome || '';
    const exMeta = ex.reps || '';
    const seriesStr = String(ex.series || '3').toLowerCase().trim();
    const numSeriesPrescritas = parseInt(seriesStr) || 3;

    let cleanName = exName.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
    const exKeySanitized = sanitizeExKey(cleanName);

    const div = document.createElement('div');
    div.className = `item ${isExDone ? 'exercise-done' : ''}`;

    let html = `
      <div class="item-header">
        <div class="item-title">${escapeHtml(cleanName)}</div>
        <button type="button" class="btn-check-exercise ${isExDone ? 'done' : ''}" onclick="toggleCheckExercise(this, ${dayIdx}, ${exIdx})">
          ${isExDone ? '✓ Concluído' : 'Marcar Concluído'}
        </button>
      </div>
      <div class="series-container">
    `;

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

    html += `</div>`;
    div.innerHTML = html;
    container.appendChild(div);
  });
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

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
        method: "POST",
        headers: authHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
      });
    } catch (e) {}
  }, 1200);
}

function parseDietaAluno(rawText) {
  if (!rawText || !rawText.trim()) return [];
  return [{
    abaNome: "Plano Alimentar",
    meals: [{
      mealTitle: "Refeição",
      days: "",
      baseItems: rawText.split('\n').map(l => l.trim()).filter(l => l !== ''),
      trocasCarbo: [],
      trocasProt: []
    }],
    fullText: rawText.toLowerCase()
  }];
}

function renderDietaAluno(refeicoesData) {
  const categoryList = document.getElementById('dietCategoryList');
  if (!categoryList) return;
  categoryList.innerHTML = "";

  let rawText = "";
  if (Array.isArray(refeicoesData)) {
    refeicoesData.forEach(r => {
      if (typeof r === 'string') rawText += `${r}\n\n`;
      else if (r.titulo || r.alimentos) rawText += `${r.titulo}\n${r.alimentos}\n\n`;
    });
  } else if (typeof refeicoesData === 'string') {
    rawText = refeicoesData;
  }

  categoryList.innerHTML = `
    <div style="background:var(--panel-2); border:1px solid var(--line); border-radius:12px; padding:14px;">
      <h3 style="color:var(--mark); font-size:15px; font-weight:800; margin-bottom:8px;">🍽 Sua Dieta</h3>
      <p style="font-size:13px; color:var(--ink); white-space: pre-line;">${escapeHtml(rawText || 'Nenhuma dieta cadastrada.')}</p>
    </div>
  `;
}

// ABAS SEM A IA DO ALUNO (Apenas Treino, Dieta, Corrida, Feedbacks)
const TAB_ORDER = ['treino', 'dieta', 'corrida', 'feedback'];

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
    if (tab === 'treino') restWidget.classList.add('visible');
    else restWidget.classList.remove('visible');
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

  if (!msg && selectedFeedbackFiles.length === 0) {
    return alert("Escreva um relato ou selecione ao menos uma foto.");
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "...";
  }

  const formData = new FormData();
  formData.append('codigo', loggedUserCode);
  formData.append('texto', msg);

  selectedFeedbackFiles.forEach(f => formData.append('fotos', f));

  try {
    const token = getAuthToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BACKEND_URL}/api/feedback/drive`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      alert("Feedback e fotos enviados com sucesso!");
      if (input) input.value = '';
      selectedFeedbackFiles = [];
      const previewContainer = document.getElementById('feedbackPhotoPreview');
      if (previewContainer) previewContainer.innerHTML = '';
      const photoInput = document.getElementById('feedbackPhotoInput');
      if (photoInput) photoInput.value = '';
      
      // Atualiza os dados locais de feedback
      if (data.feedbacks) currentData.feedbacks = data.feedbacks;
      renderFeedbackHistory();
    } else {
      alert(data.error || "Erro ao enviar feedback.");
    }
  } catch (e) {
    alert("Erro na conexão com o servidor.");
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
  const msg = `*MENSAGEM DE FEEDBACK — ALUNO*%0A%0A*Aluno:* ${nome}%0A*Relatório:*%0A${encodeURIComponent(text || 'Olá Jhonata!')}`;
  window.open(`[https://wa.me/5551990169026?text=$](https://wa.me/5551990169026?text=$){msg}`, '_blank');
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
