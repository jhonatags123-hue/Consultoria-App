Const BACKEND_URL = "https://consultoria-backend-kbqi.onrender.com";
Const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxR_uk51E_dUevVLAKiu1bF7jZ2SSG3aIQXksjY_a_V5sy9qnO0NqLzJA78Lz_GrGIU/exec";

Const CHECKOUT_LINKS = {
  COMPLETA_TRIMESTRAL: {
    Cartao: "https://www.asaas.com/000/c/lvfk6qle0ufq0t57",
    Pix:    "https://www.asaas.com/000/c/k9pnu5cry59ts60b"
  },
  COMPLETA_SEMESTRAL: {
    Cartao: "https://www.asaas.com/000/c/oky8it88u28d4vat",
    Pix:    "https://www.asaas.com/000/c/vmplvn41acefxh6q"
  },
  COMPLETA_ANUAL: {
    Cartao: "https://www.asaas.com/000/c/5gd9tb7c0szjdwbd",
    Pix:    "https://www.asaas.com/000/c/d3g2zgxzvigjnpam"
  },
  TREINO_ANUAL: {
    Cartao: "https://www.asaas.com/000/c/v36oz63i4jg0cg2u",
    Pix:    "https://www.asaas.com/000/c/3rzicld44lby9g6b"
  },
  COMPLETA_DUPLA: {
    Cartao: "https://www.asaas.com/000/c/z4zlsoe009fz8tgu",
    Pix:    "https://www.asaas.com/000/c/52mqr2awi4hzl61n"
  },
  TREINO_DUPLA: {
    Cartao: "https://www.asaas.com/000/c/omsltaq25btnizvo",
    Pix:    "https://www.asaas.com/000/c/ke2r2emle6sfnmif"
  }
};

Const DETALHES_PLANOS = {
  'COMPLETA_ANUAL': { valor: 'R$ 85,00/mês no Cartão Recorrente ou R$ 900,00 no PIX', sub: 'Acompanhamento completo individual com treino + dieta.' },
  'COMPLETA_SEMESTRAL': { valor: 'R$ 110,00/mês no Cartão Recorrente ou R$ 600,00 no PIX', sub: 'Protocolo completo semestral com suporte contínuo.' },
  'COMPLETA_TRIMESTRAL': { valor: 'R$ 120,00/mês no Cartão Recorrente ou R$ 330,00 no PIX', sub: 'Acompanhamento trimestral focado em metas rápidas.' },
  'COMPLETA_DUPLA': { valor: 'R$ 140,00/mês no Cartão Recorrente ou R$ 1.560,00 no PIX', sub: 'Plano em Dupla: apenas R$ 70,00 por mês para cada pessoa.' },
  'TREINO_ANUAL': { valor: 'R$ 55,00/mês no Cartão Recorrente ou R$ 540,00 no PIX', sub: 'Ficha de treino contínua individual com ajuste de cargas.' },
  'TREINO_DUPLA': { valor: 'R$ 90,00/mês no Cartão Recorrente ou R$ 960,00 no PIX', sub: 'Apenas R$ 45,00 por mês por pessoa para treinar em dupla.' }
};

Let currentData = null;
Let loggedUserCode = "";
Let autoSaveTimer = null;
Let currentTreinoDayIdx = 0;
Let activeAlunoDietAbaIndex = null;
Let isApenasTreinoMode = false;
Let isConvidadoDuplaMode = false;

Let workoutTimerInterval = null;
Let workoutTimerRunning = false;
Let selectedFeedbackFiles = [];

// Cronômetro de Inatividade (20 Minutos)
Let inactivityTimer = null;
Const INACTIVITY_LIMIT_MS = 20 * 60 * 1000;

Function resetInactivityTimer() {
  If (inactivityTimer) clearTimeout(inactivityTimer);

  If (workoutTimerRunning) {
    InactivityTimer = setTimeout(() => {
      If (workoutTimerRunning) {
        ToggleWorkoutTimer();
        Alert("⏱️ O treino foi pausado automaticamente após 20 minutos de inatividade.");
      }
    }, INACTIVITY_LIMIT_MS);
  }
}

['click', 'touchstart', 'mousemove', 'keypress', 'scroll'].forEach(evt => {
  Window.addEventListener(evt, resetInactivityTimer, { passive: true });
});

Async function enviarArquivoParaGoogleDrive(nomeAluno, file, customFileName) {
  Return new Promise((resolve, reject) => {
    If (!file) return resolve(null);

    Const reader = new FileReader();
    Reader.onload = async function() {
      Const base64String = reader.result.split(',')[1];

      Const payload = {
        Nome: nomeAluno,
        FileName: customFileName || file.name,
        MimeType: file.type,
        FileData: base64String
      };

      Try {
        Const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          Method: "POST",
          Body: JSON.stringify(payload)
        });
        Const result = await response.json();
        If (result.success) {
          Resolve(result.url);
        } else {
          Console.error("Erro no Apps Script:", result.error);
          Resolve(null);
        }
      } catch (err) {
        Console.error("Erro ao enviar arquivo para o Drive:", err);
        Resolve(null);
      }
    };
    Reader.onerror = error => reject(error);
    Reader.readAsDataURL(file);
  });
}

Function mascaraDataNascimento(input) {
  Let v = input.value.replace(/\D/g, '');
  If (v.length > 8) v = v.slice(0, 8);
  
  If (v.length > 4) {
    Input.value = `${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`;
  } else if (v.length > 2) {
    Input.value = `${v.slice(0,2)}/${v.slice(2)}`;
  } else {
    Input.value = v;
  }
}

Function sanitizeExKey(nome) {
  If (!nome) return "ex";
  Return nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
}

Function atualizarResumoPrecoAnamnese() {
  Const plano = document.getElementById('anamTipoConsultoria').value;
  Const info = DETALHES_PLANOS[plano] || { valor: 'Consulte o plano', sub: '' };
  Const elValor = document.getElementById('resumoPlanoValor');
  Const elSub = document.getElementById('resumoPlanoSub');
  If (elValor) elValor.textContent = info.valor;
  If (elSub) elSub.textContent = info.sub;
}

Function abrirModalIndique() { document.getElementById('modalIndique').classList.remove('hidden'); }
Function fecharModalIndique() { document.getElementById('modalIndique').classList.add('hidden'); }
Function abrirModalSenha() { document.getElementById('modalSenha').classList.remove('hidden'); }
Function fecharModalSenha() { document.getElementById('modalSenha').classList.add('hidden'); }

Function compartilharIndicaoWpp() {
  Const nome = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;
  Const msg = `*CONSULTORIA JHONATA PERSONAL*%0A%0AOlá! Estou treinando com a consultoria do Jhonata Personal e recomendo demais. Acesse o link para conhecer e fazer sua anamnese:%0Ahttps://jhonataconsultoria.com.br/anamnese.html%0A%0A_Indicação do aluno: ${encodeURIComponent(nome)}_`;
  Window.open(`https://wa.me/?text=${msg}`, '_blank');
}

Async function alterarSenhaAlunoModal() {
  Const novaSenha = document.getElementById('alunoNovaSenhaModal').value.trim();
  If (!novaSenha) return alert("Digite uma nova senha.");

  CurrentData.senha = novaSenha;

  Try {
    Const res = await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      Method: "POST",
      Headers: authHeaders(),
      Cache: 'no-cache',
      Body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });

    If (res.ok) {
      Alert("Senha alterada com sucesso.");
      Document.getElementById('alunoNovaSenhaModal').value = "";
      FecharModalSenha();
    }
  } catch (e) {
    Alert("Erro ao alterar senha.");
  }
}

Function escapeHtml(str) {
  If (!str || typeof str !== 'string') return '';
  Return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

Function obterDiaSemanaNormalizado() {
  Const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  Return dias[new Date().getDay()];
}

Function obterNomeDiaSemanaFormatado() {
  Const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sábado'];
  Return dias[new Date().getDay()];
}

Function calcularPaceTexto(kmNum, minNum) {
  Const km = parseFloat(kmNum) || 0;
  Const min = parseFloat(minNum) || 0;
  If (km <= 0 || min <= 0) return "--'--\"";
  Const paceFloat = min / km;
  Const paceMin = Math.floor(paceFloat);
  Const paceSec = Math.round((paceFloat - paceMin) * 60);
  Return `${paceMin}'${paceSec < 10 ? '0' : ''}${paceSec}"`;
}

Let restTimerInterval = null;
Let restSecondsLeft = 0;
Let audioCtx = null;

Function initAudioContext() {
  If (!audioCtx) {
    Const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    If (AudioContextClass) audioCtx = new AudioContextClass();
  }
  If (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

Function playBipSound() {
  Try {
    InitAudioContext();
    If (!audioCtx) return;
    Const osc = audioCtx.createOscillator();
    Const gain = audioCtx.createGain();
    Osc.type = 'sine';
    Osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    Gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    Osc.connect(gain);
    Gain.connect(audioCtx.destination);
    Osc.start();
    Osc.stop(audioCtx.currentTime + 0.4);
  } catch(e){}
}

Function startRestTimer(seconds) {
  InitAudioContext();
  If (restTimerInterval) clearInterval(restTimerInterval);
  RestSecondsLeft = seconds;

  Const widget = document.getElementById('restTimerWidget');
  If (widget) widget.classList.remove('timer-finished-glow');

  UpdateTimerDisplay();

  RestTimerInterval = setInterval(() => {
    RestSecondsLeft--;
    UpdateTimerDisplay();

    If (restSecondsLeft <= 0) {
      ClearInterval(restTimerInterval);
      If (widget) widget.classList.add('timer-finished-glow');
      PlayBipSound();
      If (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      SetTimeout(() => {
        If (widget) widget.classList.remove('timer-finished-glow');
      }, 5000);
    }
  }, 1000);
}

Function updateTimerDisplay() {
  Const display = document.getElementById('timerDisplay');
  If (!display) return;
  Const m = Math.floor(restSecondsLeft / 60);
  Const s = restSecondsLeft % 60;
  Display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

Function checkAndRestoreWorkoutTimer() {
  Const keyElapsed = `workout_elapsed_${loggedUserCode}`;
  Const keyStart = `workout_start_time_${loggedUserCode}`;
  
  Const startTimeStr = localStorage.getItem(keyStart);
  Const btn = document.getElementById('btnWorkoutTimer');

  If (startTimeStr) {
    WorkoutTimerRunning = true;
    If (btn) {
      Btn.textContent = "⏹️ PAUSAR";
      Btn.style.background = "var(--signal-light)";
    }
    SetInputsLockState(false);

    If (workoutTimerInterval) clearInterval(workoutTimerInterval);
    WorkoutTimerInterval = setInterval(updateWorkoutTimerDisplay, 1000);
    UpdateWorkoutTimerDisplay();
    ResetInactivityTimer();
  } else {
    WorkoutTimerRunning = false;
    If (btn) {
      Btn.textContent = "▶ INICIAR TREINO";
      Btn.style.background = "var(--good)";
    }
    SetInputsLockState(true);
    
    Const elapsed = parseInt(localStorage.getItem(keyElapsed) || "0");
    RenderClockTime(elapsed);
  }
}

Function setInputsLockState(locked) {
  Document.querySelectorAll('.input-log, .btn-check-serie, .btn-check-exercise').forEach(el => {
    El.disabled = locked;
  });
}

Function toggleWorkoutTimer() {
  Const btn = document.getElementById('btnWorkoutTimer');
  Const keyStart = `workout_start_time_${loggedUserCode}`;
  Const keyElapsed = `workout_elapsed_${loggedUserCode}`;

  If (!workoutTimerRunning) {
    WorkoutTimerRunning = true;
    LocalStorage.setItem(keyStart, Date.now().toString());

    If (btn) {
      Btn.textContent = "⏹️ PAUSAR";
      Btn.style.background = "var(--signal-light)";
    }

    SetInputsLockState(false);

    If (workoutTimerInterval) clearInterval(workoutTimerInterval);
    WorkoutTimerInterval = setInterval(updateWorkoutTimerDisplay, 1000);
    UpdateWorkoutTimerDisplay();
    ResetInactivityTimer();
  } else {
    WorkoutTimerRunning = false;
    
    Const startTimeStr = localStorage.getItem(keyStart);
    If (startTimeStr) {
      Const currentRun = Math.floor((Date.now() - parseInt(startTimeStr)) / 1000);
      Const prevElapsed = parseInt(localStorage.getItem(keyElapsed) || "0");
      LocalStorage.setItem(keyElapsed, (prevElapsed + currentRun).toString());
    }

    LocalStorage.removeItem(keyStart);
    If (workoutTimerInterval) clearInterval(workoutTimerInterval);
    If (inactivityTimer) clearTimeout(inactivityTimer);

    If (btn) {
      Btn.textContent = "▶ RETOMAR TREINO";
      Btn.style.background = "var(--good)";
    }

    SetInputsLockState(true);
  }
}

Function updateWorkoutTimerDisplay() {
  Const keyStart = `workout_start_time_${loggedUserCode}`;
  Const keyElapsed = `workout_elapsed_${loggedUserCode}`;
  
  Const startTimeStr = localStorage.getItem(keyStart);
  Const prevElapsed = parseInt(localStorage.getItem(keyElapsed) || "0");

  If (!startTimeStr) {
    RenderClockTime(prevElapsed);
    Return;
  }

  Const currentRun = Math.floor((Date.now() - parseInt(startTimeStr)) / 1000);
  Const totalElapsed = prevElapsed + currentRun;
  
  RenderClockTime(totalElapsed);
}

Function renderClockTime(totalSeconds) {
  Const clock = document.getElementById('workoutTimerClock');
  If (!clock) return;

  Const h = Math.floor(totalSeconds / 3600);
  Const m = Math.floor((totalSeconds % 3600) / 60);
  Const s = totalSeconds % 60;

  Const fmt = n => String(n).padStart(2, '0');
  Clock.textContent = `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
}

Function aplicarCargaBackoff(keyInput, valorCarga, dayIdx, exIdx) {
  If (!workoutTimerRunning) {
    Alert("⚠️ Clique em '▶ INICIAR TREINO' para registrar cargas!");
    Return;
  }
  Const el = document.getElementById(`input_${keyInput}`);
  If (el) el.value = valorCarga;
  ScheduleAutoSave(keyInput, String(valorCarga), dayIdx, exIdx);
}

Function authHeaders() {
  Const token = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');
  Const headers = { 'Content-Type': 'application/json' };
  If (token) headers['Authorization'] = `Bearer ${token}`;
  Return headers;
}

Document.addEventListener("DOMContentLoaded", async () => {
  Fetch(`${BACKEND_URL}/ping`, { cache: 'no-cache' }).catch(() => {});

  Const params = new URLSearchParams(window.location.search);
  Const paramAluno = params.get('aluno');
  If (paramAluno && document.getElementById('loginUser')) {
    Document.getElementById('loginUser').value = paramAluno;
  }

  Const modo = params.get('modo');
  Const tipo = params.get('tipo');

  If (tipo === 'treino' || modo === 'anamnese_treino') {
    IsApenasTreinoMode = true;
  }

  If (modo === 'anamnese_convidado') {
    IsConvidadoDuplaMode = true;
  }

  If (modo === 'anamnese' || modo === 'anamnese_treino' || modo === 'anamnese_convidado' || isApenasTreinoMode) {
    Document.getElementById('loginScreen').classList.add('hidden');
    Document.getElementById('anamneseScreen').classList.remove('hidden');

    Const restWidget = document.getElementById('restTimerWidget');
    If (restWidget) restWidget.classList.remove('visible');

    If (isApenasTreinoMode) {
      Const anamTitle = document.getElementById('anamMainTitle');
      Const anamSub = document.getElementById('anamMainSub');
      If (anamTitle) anamTitle.textContent = "Anamnese de Treino";
      If (anamSub) anamSub.textContent = "Preencha com atenção para a montagem da sua ficha personalizada de treino";
      
      Const selectPlano = document.getElementById('anamTipoConsultoria');
      If (selectPlano && !isConvidadoDuplaMode) {
        SelectPlano.innerHTML = `
          <option value="TREINO_ANUAL" selected>Consultoria de Treino Anual — R$ 55/mês ou R$ 540 no PIX</option>
          <option value="TREINO_DUPLA">Promocional Treino em Dupla (Anual) — R$ 90/mês ou R$ 960 no PIX</option>
        `;
      }
    }

    Const planoParam = params.get('plano');
    Const selectPlano = document.getElementById('anamTipoConsultoria');

    If (planoParam && selectPlano && !isConvidadoDuplaMode) {
      If (CHECKOUT_LINKS[planoParam] || DETALHES_PLANOS[planoParam]) {
        SelectPlano.value = planoParam;
      }
      SelectPlano.disabled = true;
      SelectPlano.style.opacity = '0.85';
      SelectPlano.style.background = 'var(--panel)';
    }

    If (isConvidadoDuplaMode) {
      Const selectPagamento = document.getElementById('anamFormaPagamento');
      Const pixBox = document.getElementById('pixDiretoBox');

      If (selectPlano) {
        SelectPlano.innerHTML = `<option value="DUPLA_CONVIDADO_INCLUSO" selected>Consultoria em Dupla (Incluso no Plano do Titular)</option>`;
        SelectPlano.disabled = true;
      }
      If (selectPagamento) {
        SelectPagamento.innerHTML = `<option value="INCLUSO_NO_PLANO_DUPLA" selected>Incluso no Plano em Dupla (Já Pago)</option>`;
        SelectPagamento.disabled = true;
      }
      If (pixBox) pixBox.classList.add('hidden');
    }

    AtualizarResumoPrecoAnamnese();
    Return;
  }

  Const loggedUser = localStorage.getItem('logged_user');
  Const alunoToken = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');

  If (loggedUser && alunoToken) {
    Try {
      Const res = await fetch(`${BACKEND_URL}/api/aluno/${loggedUser}`, {
        Headers: authHeaders(),
        Cache: 'no-cache'
      });
      If (res.ok) {
        Const data = await res.json();
        LoggedUserCode = loggedUser;
        LoadStudentData(data);
      } else {
        Logout();
      }
    } catch (e) {
      Logout();
    }
  } else {
    Document.getElementById('loginScreen').classList.remove('hidden');
    Document.getElementById('mainContent').classList.add('hidden');
    Document.getElementById('anamneseScreen').classList.add('hidden');

    Const restWidget = document.getElementById('restTimerWidget');
    If (restWidget) restWidget.classList.remove('visible');
  }
});

Function nextAnamStep(step) {
  If (isApenasTreinoMode) {
    If (step === 7 || step === 8) {
      Step = 9;
    }
  }

  For (let i = 1; i <= 10; i++) {
    Const elStep = document.getElementById(`anamStep${i}`);
    If (elStep) elStep.classList.add('hidden');
  }
  Const currentStepEl = document.getElementById(`anamStep${step}`);
  If (currentStepEl) currentStepEl.classList.remove('hidden');
  
  Const progressBar = document.getElementById('progressBar');
  Const stepCounter = document.getElementById('stepCounter');
  If (progressBar) progressBar.style.width = `${(step/10)*100}%`;
  If (stepCounter) stepCounter.textContent = `Etapa ${step} de 10`;
  
  Const btnVoltarStep10 = document.getElementById('btnVoltarStep10');
  If (btnVoltarStep10) {
    BtnVoltarStep10.setAttribute('onclick', isApenasTreinoMode ? 'nextAnamStep(6)' : 'nextAnamStep(9)');
  }

  If (step === 10) atualizarResumoPrecoAnamnese();
}

Async function handleLogin(e) {
  E.preventDefault();
  Const btn = document.getElementById('btnLoginSubmit');
  Const user = document.getElementById('loginUser').value.trim().toLowerCase();
  Const pass = document.getElementById('loginPass').value.trim();
  Const errorDiv = document.getElementById('loginError');

  ErrorDiv.classList.add('hidden');
  Btn.textContent = "Conectando ao servidor...";
  Btn.disabled = true;

  Const tentarConexao = async (tentativasRestantes) => {
    Try {
      Const res = await fetch(`${BACKEND_URL}/api/aluno/login`, {
        Method: 'POST',
        Headers: { 'Content-Type': 'application/json' },
        Cache: 'no-cache',
        Body: JSON.stringify({ codigo: user, senha: pass })
      });

      Const result = await res.json();

      If (!res.ok) {
        ErrorDiv.textContent = result.error || "Erro de login.";
        ErrorDiv.classList.remove('hidden');
        Btn.textContent = "Entrar";
        Btn.disabled = false;
        Return;
      }

      LocalStorage.setItem('logged_user', user);
      LocalStorage.setItem('aluno_token', result.token);
      LocalStorage.setItem('token', result.token);
      LocalStorage.setItem('tokenAluno', result.token);
      LoggedUserCode = user;

      If (window.history.replaceState) {
        Window.history.replaceState({}, document.title, window.location.pathname);
      }

      LoadStudentData(result.data);
    } catch (err) {
      If (tentativasRestantes > 0) {
        Btn.textContent = "Iniciando servidor, aguarde...";
        SetTimeout(() => tentarConexao(tentativasRestantes - 1), 3500);
      } else {
        ErrorDiv.textContent = "O servidor demorou a responder. Aguarde alguns segundos e tente novamente.";
        ErrorDiv.classList.remove('hidden');
        Btn.textContent = "Entrar";
        Btn.disabled = false;
      }
    }
  };

  TentarConexao(3);
}

Function renderizarCheckoutFinalPlano(tipoConsultoria) {
  Const checkoutInfo = CHECKOUT_LINKS[tipoConsultoria] || CHECKOUT_LINKS.COMPLETA_SEMESTRAL;

  Return `
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

      <a href="https://wa.me/5551990169026?text=${encodeURIComponent('Olá Jhonata! Acabei de preencher minha Anamnese!')}" target="_blank" class="btn-login btn-wpp" style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:20px; text-decoration:none;">
          Falar com o personal no WhatsApp
      </a>
    </div>
  `;
}

Async function sendAnamneseAppDirect() {
  Const nome = document.getElementById('anamNome').value.trim();
  Const nascimento = document.getElementById('anamNascimento').value.trim();
  Const idade = document.getElementById('anamIdade').value.trim();
  Const email = document.getElementById('anamEmail').value.trim();
  Const cpf = document.getElementById('anamCpf').value.trim();
  Const telefone = document.getElementById('anamTelefone').value.trim();
  Const tipoConsultoria = document.getElementById('anamTipoConsultoria').value;
  Const btn = document.getElementById('btnSubmitAnam');

  If (!nome || !nascimento || !idade || !email || !cpf || !telefone) {
    Return alert("Preencha nome, data de nascimento, idade, e-mail, CPF e WhatsApp.");
  }

  Const userCode = nome.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  Const anamneseData = {
    Codigo: userCode,
    Nome: nome,
    ClientName: nome,
    Nascimento: nascimento,
    Idade: idade,
    Email: email,
    Cpf: cpf,
    TipoConsultoria: tipoConsultoria,
    Telefone: telefone,
    Peso: document.getElementById('anamPeso').value.trim(),
    Altura: document.getElementById('anamAltura').value.trim(),
    Objetivo: document.getElementById('anamObjetivo').value,
    TempoTreino: document.getElementById('anamTempoTreino').value.trim(),
    DiasSemana: document.getElementById('anamDiasSemana').value.trim(),
    PreferenciaDias: document.getElementById('anamPreferenciaDias').value.trim(),
    TempoTreinoMin: document.getElementById('anamTempoTreinoMin').value.trim(),
    TempoDescanso: document.getElementById('anamTempoDescanso').value,
    OutrasAtividades: document.getElementById('anamOutrasAtividades').value.trim(),
    Lesoes: document.getElementById('anamLesoes').value.trim(),
    Doencas: document.getElementById('anamDoencas').value.trim(),
    Rotina: document.getElementById('anamRotina').value.trim(),
    HorasSono: document.getElementById('anamHorasSono').value.trim(),
    QualidadeSono: document.getElementById('anamQualidadeSono').value.trim(),
    Alcool: document.getElementById('anamAlcool').value.trim(),
    Tabagismo: document.getElementById('anamTabagismo').value.trim(),
    NumRefeicoes: isApenasTreinoMode ? "" : document.getElementById('anamNumRefeicoes').value.trim(),
    Alergias: isApenasTreinoMode ? "" : document.getElementById('anamAlergias').value.trim(),
    AlimentosOdiados: isApenasTreinoMode ? "" : document.getElementById('anamAlimentosOdiados').value.trim(),
    GostaCarbos: isApenasTreinoMode ? "" : document.getElementById('anamGostaCarbos').value.trim(),
    GostaProteinas: isApenasTreinoMode ? "" : document.getElementById('anamGostaProteinas').value.trim(),
    GostaLegumes: isApenasTreinoMode ? "" : document.getElementById('anamGostaLegumes').value.trim(),
    Orcamento: isApenasTreinoMode ? "" : document.getElementById('anamOrcamento').value.trim(),
    Suplementos: isApenasTreinoMode ? "" : document.getElementById('anamSuplementos').value.trim(),
    FimDeSemana: isApenasTreinoMode ? "" : document.getElementById('anamFimDeSemana').value.trim(),
    ApenasTreino: isApenasTreinoMode || tipoConsultoria.includes('TREINO')
  };

  If (btn) {
    Btn.textContent = "Processando...";
    Btn.disabled = true;
  }

  Try {
    Await fetch(`${BACKEND_URL}/api/anamnese/iniciar`, {
      Method: "POST",
      Headers: { "Content-Type": "application/json" },
      Cache: 'no-cache',
      Body: JSON.stringify(anamneseData)
    });

    If (!isConvidadoDuplaMode) {
      Document.getElementById('anamneseScreen').innerHTML = renderizarCheckoutFinalPlano(tipoConsultoria);
    } else {
      Document.getElementById('anamneseScreen').innerHTML = `
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
    Alert("Erro ao conectar.");
    If (btn) {
      Btn.textContent = "Finalizar e enviar";
      Btn.disabled = false;
    }
  }
}

Function loadStudentData(data) {
  Document.getElementById('loginScreen').classList.add('hidden');
  Document.getElementById('anamneseScreen').classList.add('hidden');
  Document.getElementById('mainContent').classList.remove('hidden');
  Document.body.classList.add('app-mode');

  CurrentData = data;

  If (currentData.logs) {
    Object.keys(currentData.logs).forEach(k => {
      If (k.startsWith('ex_done_')) delete currentData.logs[k];
    });
  }

  Const localLogs = localStorage.getItem(`draft_student_logs_${loggedUserCode}`);
  If (localLogs) {
    Try {
      Const parsed = JSON.parse(localLogs);
      Object.keys(parsed).forEach(k => {
        If (k.startsWith('ex_done_')) delete parsed[k];
      });
      CurrentData.logs = Object.assign({}, currentData.logs || {}, parsed);
    } catch(e) {}
  }

  Document.getElementById('clientName').textContent = data.clientName || 'Aluno';

  Const btnDieta = document.getElementById('btnDieta');
  Const btnErgogenicos = document.getElementById('btnErgogenicos');

  If (data.apenasTreino === true || data.liberarDieta === false) {
    If (btnDieta) btnDieta.classList.add('hidden');
  } else {
    If (btnDieta) btnDieta.classList.remove('hidden');
    RenderDietaAluno(data.refeicoes || data.dieta || []);
  }

  Const temErgogenicos = data.liberarErgogenicos === true || data.ergogenicos || data.protocolo_ergogenico || data.protocoloErgogenicos || data.ergogenicos_texto;
  If (temErgogenicos) {
    If (btnErgogenicos) btnErgogenicos.classList.remove('hidden');
    RenderErgogenicosAluno(data);
  } else {
    If (btnErgogenicos) btnErgogenicos.classList.add('hidden');
  }

  If (data.corredor === true) {
    Document.getElementById('btnCorrida').classList.remove('hidden');
    SetupCorrida(data);
  } else {
    Document.getElementById('btnCorrida').classList.add('hidden');
  }

  VerificarCardEvolucao(data);
  VerificarNotificacaoFeedback(data);
  SetupWorkout(data.days || []);
  RenderFeedbackHistory();
  SetupSwipeNavigation();

  ShowTab('treino');
}

Function renderErgogenicosAluno(payloadData) {
  Const container = document.getElementById('ergogenicosContent') || document.getElementById('ergogenicosBody');
  If (!container) return;

  Let textoProtocolo = "";
  If (typeof payloadData === 'string') {
    TextoProtocolo = payloadData;
  } else if (payloadData && typeof payloadData === 'object') {
    TextoProtocolo = payloadData.ergogenicos || 
                     PayloadData.protocolo_ergogenico || 
                     PayloadData.protocoloErgogenicos || 
                     PayloadData.ergogenicos_texto || "";
  }

  If (textoProtocolo && textoProtocolo.trim()) {
    Container.innerHTML = escapeHtml(textoProtocolo).replace(/\n/g, '<br>');
  } else {
    Container.innerHTML = `<div style="color:var(--ink-dim); text-align:center; padding:12px;">Nenhum protocolo ou orientação cadastrada no momento.</div>`;
  }
}

Function toggleCheckExercise(btn, dayIdx, exIdx) {
  Const card = btn.closest('.item');
  Const isDone = btn.classList.toggle('done');
  
  If (isDone) {
    If (!workoutTimerRunning) {
      Btn.classList.remove('done');
      Alert("⚠️ Clique em '▶ INICIAR TREINO' antes de marcar o exercício!");
      Return;
    }
    Btn.textContent = '✓ Concluído';
    If (card) card.classList.add('exercise-done');
    If (navigator.vibrate) navigator.vibrate(50);
  } else {
    Btn.textContent = 'Marcar Concluído';
    If (card) card.classList.remove('exercise-done');
  }

  Const keyExDone = `ex_done_${dayIdx}_${exIdx}`;
  ScheduleAutoSave(keyExDone, isDone ? 'true' : 'false');
}

Function verificarNotificacaoFeedback(alunoData) {
  Const feedbacks = alunoData.feedbacks || [];
  Const notifyBox = document.getElementById('feedbackNotifyBox');
  Const notifyText = document.getElementById('feedbackNotifyText');
  If (!notifyBox || feedbacks.length === 0) return;

  Const ultimasMensagens = feedbacks.filter(f => f.autor === "PERSONAL");
  If (ultimasMensagens.length === 0) return;

  Const ultima = ultimasMensagens[ultimasMensagens.length - 1];
  Const keyVisto = `fb_last_seen_${loggedUserCode}`;
  Const vistoId = localStorage.getItem(keyVisto);
  Const msgId = ultima.data || ultima.mensagem;

  If (vistoId !== msgId) {
    NotifyText.textContent = `"${ultima.mensagem}"`;
    NotifyBox.classList.remove('hidden');
  }
}

Function dismissFeedbackNotify() {
  Const notifyBox = document.getElementById('feedbackNotifyBox');
  If (notifyBox) notifyBox.classList.add('hidden');

  Const feedbacks = (currentData && currentData.feedbacks) || [];
  Const ultimas = feedbacks.filter(f => f.autor === "PERSONAL");
  If (ultimas.length > 0) {
    Const ultima = ultimas[ultimas.length - 1];
    LocalStorage.setItem(`fb_last_seen_${loggedUserCode}`, ultima.data || ultima.mensagem);
  }
}

Function irParaFeedbackChat() {
  DismissFeedbackNotify();
  ShowTab('feedback');
}

Function verificarCardEvolucao(data) {
  If (!data.evolucao_carga_pct || data.evolucao_carga_pct <= 0) return;

  Const keyStorage = `congrats_closed_${loggedUserCode}`;
  Const timestampFechado = localStorage.getItem(keyStorage);
  Const agora = new Date().getTime();

  If (timestampFechado && (agora - parseInt(timestampFechado)) < 86400000) {
    Document.getElementById('congratsBox').classList.add('hidden');
    Return;
  }

  Document.getElementById('congratsText').textContent = `Parabéns! Você aumentou sua força em média +${data.evolucao_carga_pct}% em relação ao ciclo anterior. Excelente evolução!`;
  Document.getElementById('congratsBox').classList.remove('hidden');
}

Function fecharCardEvolucao() {
  Document.getElementById('congratsBox').classList.add('hidden');
  LocalStorage.setItem(`congrats_closed_${loggedUserCode}`, new Date().getTime().toString());
}

Async function salvarRunDia(diaKey) {
  If (!currentData) return;

  Const inputKm = document.getElementById(`run_km_${diaKey}`);
  Const inputMin = document.getElementById(`run_min_${diaKey}`);

  Const kmVal = inputKm ? InputKm.value.trim() : "";
  Const minVal = inputMin ? InputMin.value.trim() : "";

  If (!currentData.registros_corrida) currentData.registros_corrida = {};

  Const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  If (kmVal || minVal) {
    CurrentData.registros_corrida[diaKey] = [{
      Data: dataHoje,
      Km: kmVal,
      Min: minVal
    }];
  } else {
    Delete currentData.registros_corrida[diaKey];
  }

  Const paceStr = (kmVal && minVal) ? CalcularPaceTexto(kmVal, minVal) : "--'--\"";
  Const displayPace = document.getElementById(`run_pace_display_${diaKey}`);
  If (displayPace) {
    DisplayPace.innerHTML = `⏱ Pace do dia: <span>${paceStr}</span> /km`;
  }

  SetupCorrida(currentData);

  Const ind = document.getElementById('saveIndicator');
  If (ind) ind.style.display = 'block';

  Try {
    Await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      Method: "POST",
      Headers: authHeaders(),
      Cache: 'no-cache',
      Body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {
    Console.error("Erro ao salvar cardio:", e);
  } finally {
    If (ind) ind.style.display = 'none';
  }
}

Async function apagarRunDia(diaKey) {
  If (!confirm(`Deseja apagar o registro de cardio deste dia?`)) return;

  Const inputKm = document.getElementById(`run_km_${diaKey}`);
  Const inputMin = document.getElementById(`run_min_${diaKey}`);

  If (inputKm) inputKm.value = '';
  If (inputMin) inputMin.value = '';

  If (currentData && currentData.registros_corrida) {
    Delete currentData.registros_corrida[diaKey];
  }

  Await salvarRunDia(diaKey);
}

Async function resetCardioSemanal() {
  If (!currentData) return;

  CurrentData.registros_corrida = {};
  CurrentData.corridas = [];

  Const dias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  Dias.forEach(d => {
    Const elKm = document.getElementById(`run_km_${d}`);
    Const elMin = document.getElementById(`run_min_${d}`);
    Const elPace = document.getElementById(`run_pace_display_${d}`);

    If (elKm) elKm.value = '';
    If (elMin) elMin.value = '';
    If (elPace) elPace.innerHTML = '⏱ Pace do dia: <span>--\'--"</span> /km';
  });

  SetupCorrida(currentData);

  Try {
    Await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      Method: "POST",
      Headers: authHeaders(),
      Cache: 'no-cache',
      Body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {}
}

Function setupCorrida(data) {
  Const presContainer = document.getElementById('corridaPrescricaoList');
  Const histContainer = document.getElementById('corridaHistoryList');

  If (!presContainer || !histContainer) return;

  PresContainer.innerHTML = '';
  HistContainer.innerHTML = '';

  Const cardioContainer = document.getElementById('cardioGoalsBody');
  If (cardioContainer) {
    Const customCardio = (data && (data.cardio_guidelines || data.prescricao_cardio)) || '';
    If (customCardio.trim()) {
      CardioContainer.innerHTML = escapeHtml(customCardio).replace(/\n/g, '<br>');
    } else {
      CardioContainer.innerHTML = `Aguardando prescrição de cardio pelo treinador.`;
    }
  }

  Const prescricao = data.prescricao_corrida || {};
  Const registros = data.registros_corrida || data.corridas || {};

  Const dias = [
    { key: 'seg', nome: 'Segunda-Feira' },
    { key: 'ter', nome: 'Terça-Feira' },
    { key: 'qua', nome: 'Quarta-Feira' },
    { key: 'qui', nome: 'Quinta-Feira' },
    { key: 'sex', nome: 'Sexta-Feira' },
    { key: 'sab', nome: 'Sábado' },
    { key: 'dom', nome: 'Domingo' }
  ];

  Let totalKm = 0;
  Let totalMin = 0;
  Let totalRegistros = 0;

  Dias.forEach(d => {
    Const pData = prescricao[d.key] || {};
    Let treinoInstrucao = "Descanso ou treino livre";
    
    If (typeof pData === 'object' && pData !== null) {
      If (pData.desc || pData.km || pData.min) {
        Const infoKm = pData.km ? `${pData.km} km` : '';
        Const infoMin = pData.min ? `${pData.min} min` : '';
        Const infoInt = pData.intensidade ? `[${pData.intensidade}]` : '';
        Const detalhe = pData.desc || '';
        TreinoInstrucao = `${infoKm} ${infoMin} ${infoInt} - ${detalhe}`.trim();
      }
    } else if (typeof pData === 'string' && pData.trim() !== '') {
      TreinoInstrucao = pData;
    }

    Const regDia = registros[d.key] || [];
    Const ultimoReg = Array.isArray(regDia) ? RegDia[regDia.length - 1] : regDia;

    Const kmVal = ultimoReg?.km || '';
    Const minVal = ultimoReg?.min || ultimoReg?.minutos || '';
    Const paceDiaStr = (kmVal && minVal) ? CalcularPaceTexto(kmVal, minVal) : "--'--\"";

    Const card = document.createElement('div');
    Card.className = 'run-item';
    Card.innerHTML = `
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
    PresContainer.appendChild(card);
  });

  Const keysDias = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  Const nomesDiasMap = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };

  If (typeof registros === 'object') {
    KeysDias.forEach(key => {
      Let hDia = registros[key];
      If (!hDia) return;
      If (!Array.isArray(hDia)) hDia = [hDia];

      HDia.forEach((c) => {
        Const km = parseFloat(c.km) || 0;
        Const min = parseFloat(c.min || c.minutos) || 0;
        TotalKm += km;
        TotalMin += min;
        TotalRegistros++;

        Const paceStr = calcularPaceTexto(km, min);

        Const div = document.createElement('div');
        Div.className = 'run-item';
        Div.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-weight:700; font-size:13px; color:var(--ink);">
            <span>🏃 ${nomesDiasMap[key]} (${escapeHtml(c.data || 'Recente')})</span>
            <span style="color:var(--blue); font-size:12px;">Pace: ${paceStr} /km</span>
          </div>
          <div style="font-size:11.5px; color:var(--ink-dim); margin-top:4px;">
            ${km > 0 ? `Distância: <b>${km} km</b> | Tempo: <b>${min} min</b>` : 'Treino registrado'}
          </div>
        `;
        HistContainer.appendChild(div);
      });
    });
  }

  If (totalRegistros === 0) {
    HistContainer.innerHTML = `<div style="font-size:12px; color:var(--ink-dim); text-align:center; padding:14px;">Nenhuma corrida realizada nas últimas 4 semanas.</div>`;
  }

  Document.getElementById('runTotalKm').textContent = `${totalKm.toFixed(1)} km`;
  Const paceMedioGlobal = calcularPaceTexto(totalKm, totalMin);
  Document.getElementById('runPaceMedio').textContent = paceMedioGlobal;
}

Function setupWorkout(days) {
  CurrentData.days = days;
  RenderTreinoDayList();

  Const proximoIdx = currentData.ultimo_treino_idx !== undefined ? (currentData.ultimo_treino_idx) % days.length : 0;
  SelectTreinoDay(proximoIdx);
}

Function renderTreinoDayList() {
  Const listContainer = document.getElementById('treinoDayList');
  ListContainer.innerHTML = '';

  Const days = (currentData && currentData.days) || [];

  If (!days || days.length === 0) {
    ListContainer.innerHTML = '<div style="font-size:13px; color:var(--ink-dim); text-align:center; padding:20px;">Seu treino está sendo montado pelo personal.</div>';
    Return;
  }

  Days.forEach((day, dayIdx) => {
    Const card = document.createElement('button');
    Card.type = 'button';
    Card.className = 'select-card';
    Card.innerHTML = `
      <div>
        <div class="select-card-title">${escapeHtml(day.title)}</div>
        <div class="select-card-sub">${(day.exercicios || []).length} Exercícios</div>
      </div>
      <span class="select-card-arrow">›</span>
    `;
    Card.onclick = () => selectTreinoDay(dayIdx);
    ListContainer.appendChild(card);
  });
}

Function selectTreinoDay(dayIdx) {
  CurrentTreinoDayIdx = dayIdx;
  Document.getElementById('treinoListView').classList.add('hidden');
  Document.getElementById('treinoDetailView').classList.remove('hidden');
  RenderTreinoDetail();
}

Function openTreinoSelectionMenu() {
  Document.getElementById('treinoDetailView').classList.add('hidden');
  Document.getElementById('treinoListView').classList.remove('hidden');
}

Function toggleCheckSerie(btn) {
  If (!workoutTimerRunning) {
    Alert("⚠️ Clique em '▶ INICIAR TREINO' antes de começar a marcar as séries!");
    Return;
  }
  Btn.classList.toggle('done');
  If (btn.classList.contains('done')) {
    Btn.textContent = "✓ Feito";
  } else {
    Btn.textContent = "Série " + btn.dataset.num;
  }
}

Async function concluirTreinoDoDia() {
  If (!currentData) return;

  Const keyStart = `workout_start_time_${loggedUserCode}`;
  Const keyElapsed = `workout_elapsed_${loggedUserCode}`;
  
  Const startTimeStr = localStorage.getItem(keyStart);
  Const prevElapsed = parseInt(localStorage.getItem(keyElapsed) || "0");
  Let durationSeconds = prevElapsed;

  If (startTimeStr) {
    DurationSeconds += Math.floor((Date.now() - parseInt(startTimeStr)) / 1000);
  }

  LocalStorage.removeItem(keyStart);
  LocalStorage.removeItem(keyElapsed);

  If (workoutTimerInterval) clearInterval(workoutTimerInterval);
  If (inactivityTimer) clearTimeout(inactivityTimer);
  WorkoutTimerRunning = false;

  Const m = Math.floor(durationSeconds / 60);
  Const s = durationSeconds % 60;
  Const tempoTexto = m > 0 ? `${m} min e ${s} seg` : `${s} seg`;

  Document.getElementById('summaryTimeDisplay').textContent = tempoTexto;

  Const summaryList = document.getElementById('summaryProgressionList');
  SummaryList.innerHTML = "";

  Const day = currentData.days?.[currentTreinoDayIdx];
  Let evolucoes = [];
  Let volumeToneladoTotal = 0;

  If (day && day.exercicios) {
    Day.exercicios.forEach((ex, exIdx) => {
      Const exKeySanitized = sanitizeExKey(ex.nome);
      Const keyLog = `${currentTreinoDayIdx}_${exIdx}`;
      Const historico = currentData.weekly_logs?.[exKeySanitized] || currentData.weekly_logs?.[keyLog] || [];
      Const ultimoReg = historico.length > 0 ? Historico[historico.length - 1] : null;

      Let cMax = 0;
      Let rTotal = 0;
      Let seriesCount = 0;

      For (let s = 1; s <= 5; s++) {
        Const cVal = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_s${s}`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_s${s}`]);
        Const rVal = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_s${s}`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_s${s}`]);

        If (!isNaN(cVal) && cVal > cMax) cMax = cVal;
        If (!isNaN(rVal)) { 
          RTotal += rVal; 
          SeriesCount++; 
          If (!isNaN(cVal)) volumeToneladoTotal += (cVal * rVal);
        }
      }

      Const cMyo = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_ativ`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_ativ`]);
      Const rMyoAtiv = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_ativ`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_ativ`]);
      Const bMyo = parseFloat(currentData.logs?.[`log_b_${exKeySanitized}_myo_blocos`]);
      Const rMyoBloco = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_myo_repsbloco`]);

      If (!isNaN(cMyo) && cMyo > cMax) cMax = cMyo;

      If (!isNaN(rMyoAtiv)) {
        Let totalRepsMyo = rMyoAtiv;
        If (!isNaN(bMyo) && !isNaN(rMyoBloco)) {
          TotalRepsMyo += (bMyo * rMyoBloco);
        }
        RTotal += totalRepsMyo;
        SeriesCount++;
        If (!isNaN(cMyo)) volumeToneladoTotal += (cMyo * totalRepsMyo);
      }

      Const cCl = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_cl_peso`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_cl_peso`]);
      Const rCl = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_cl_lastreps`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_cl_lastreps`]);
      If (!isNaN(cCl) && cCl > cMax) cMax = cCl;
      If (!isNaN(rCl)) { 
        RTotal += rCl; 
        SeriesCount++; 
        If (!isNaN(cCl)) volumeToneladoTotal += (cCl * rCl);
      }

      Const cBo = parseFloat(currentData.logs?.[`log_c_${exKeySanitized}_bo`] || currentData.logs?.[`log_c_${currentTreinoDayIdx}_${exIdx}_bo`]);
      Const rBo = parseFloat(currentData.logs?.[`log_r_${exKeySanitized}_bo`] || currentData.logs?.[`log_r_${currentTreinoDayIdx}_${exIdx}_bo`]);
      If (!isNaN(cBo) && cBo > cMax) cMax = cBo;
      If (!isNaN(rBo)) { 
        RTotal += rBo; 
        SeriesCount++; 
        If (!isNaN(cBo)) volumeToneladoTotal += (cBo * rBo);
      }

      Const rMed = seriesCount > 0 ? Math.round(rTotal / seriesCount) : 0;

      If (cMax > 0 || rMed > 0) {
        Let statusText = "✨ Treino registrado";
        Let statusColor = "var(--mark)";

        If (ultimoReg) {
          Const cargaAnt = parseFloat(ultimoReg.cargaMax) || 0;
          Const repsAnt = Math.round(parseFloat(ultimoReg.repsMed) || 0);

          If (cMax > cargaAnt) {
            Const diff = (cMax - cargaAnt).toFixed(1);
            StatusText = `🚀 +${diff}kg de carga!`;
            StatusColor = "var(--good)";
          } else if (cMax === cargaAnt && rMed > repsAnt) {
            Const diffReps = rMed - repsAnt;
            StatusText = `📈 +${diffReps} rep${diffReps > 1 ? 's' : ''} com a mesma carga!`;
            StatusColor = "var(--blue)";
          }
        }

        Evolucoes.push({
          Nome: ex.nome,
          Carga: cMax,
          Reps: rMed,
          Status: statusText,
          Color: statusColor
        });
      }
    });
  }

  Document.getElementById('summaryVolumeDisplay').textContent = `${Math.round(volumeToneladoTotal)} kg`;

  If (evolucoes.length === 0) {
    SummaryList.innerHTML = `<div style="color:var(--ink-dim); font-size:12px; text-align:center;">Preencha suas cargas para visualizar a evolução!</div>`;
  } else {
    Evolucoes.forEach(item => {
      SummaryList.innerHTML += `
        <div class="progression-item">
          <b style="color:var(--ink);">${escapeHtml(item.nome)}</b>
          <span style="color:${item.color}; font-weight:700;">${item.status}</span> 
          <span style="color:var(--ink-dim); font-size:11px;">Carga máx: ${item.carga}kg | Média: ${item.reps} reps</span>
        </div>
      `;
    });
  }

  If (!currentData.historico_sessoes) currentData.historico_sessoes = [];
  Const obsEl = document.getElementById(`input_obs_${currentTreinoDayIdx}`);
  Const obsAtualSessao = obsEl ? ObsEl.value.trim() : "";

  CurrentData.historico_sessoes.push({
    Data: new Date().toISOString(),
    TreinoTitulo: day ? Day.title : "Treino",
    DuracaoMinutos: m,
    Observacoes: obsAtualSessao ? [obsAtualSessao] : []
  });

  If (currentData.historico_sessoes.length > 15) {
    CurrentData.historico_sessoes = currentData.historico_sessoes.slice(-15);
  }

  If (!currentData.logs) currentData.logs = {};

  Object.keys(currentData.logs).forEach(key => {
    If (key.startsWith('ex_done_')) delete currentData.logs[key];
  });

  If (day && day.exercicios) {
    Day.exercicios.forEach((ex, exIdx) => {
      Const exKeySanitized = sanitizeExKey(ex.nome);
      Delete currentData.logs[`ex_done_${currentTreinoDayIdx}_${exIdx}`];
      
      For (let s = 1; s <= 5; s++) {
        Delete currentData.logs[`log_c_${exKeySanitized}_s${s}`];
        Delete currentData.logs[`log_r_${exKeySanitized}_s${s}`];
        Delete currentData.logs[`log_c_${currentTreinoDayIdx}_${exIdx}_s${s}`];
        Delete currentData.logs[`log_r_${currentTreinoDayIdx}_${exIdx}_s${s}`];
      }
      Delete currentData.logs[`log_c_${exKeySanitized}_ativ`];
      Delete currentData.logs[`log_r_${exKeySanitized}_ativ`];
      Delete currentData.logs[`log_b_${exKeySanitized}_myo_blocos`];
      Delete currentData.logs[`log_r_${exKeySanitized}_myo_repsbloco`];
      Delete currentData.logs[`log_c_${exKeySanitized}_cl_peso`];
      Delete currentData.logs[`log_r_${exKeySanitized}_cl_lastreps`];
      Delete currentData.logs[`log_b_${exKeySanitized}_cl_blocos`];
      Delete currentData.logs[`log_c_${exKeySanitized}_bo`];
      Delete currentData.logs[`log_r_${exKeySanitized}_bo`];
    });
  }
  
  Delete currentData.logs[`obs_day_${currentTreinoDayIdx}`];

  If (loggedUserCode) {
    LocalStorage.removeItem(`draft_obs_${loggedUserCode}_${currentTreinoDayIdx}`);
    LocalStorage.setItem(`draft_student_logs_${loggedUserCode}`, JSON.stringify(currentData.logs));
  }

  Const totalDays = (currentData.days || []).length;
  Let proximoTreino = currentTreinoDayIdx;

  If (totalDays > 0) {
    ProximoTreino = (currentTreinoDayIdx + 1) % totalDays;
    If (proximoTreino === 0) {
      Let semanaAtual = currentData.semana_rotacao || 1;
      CurrentData.semana_rotacao = (semanaAtual % 5) + 1;
      Await resetCardioSemanal();
    }
  }

  CurrentData.ultimo_treino_idx = proximoTreino;

  Document.querySelectorAll('.btn-check-serie').forEach(btn => {
    Btn.classList.remove('done');
    Btn.textContent = "Série " + (btn.dataset.num || '');
  });
  Document.querySelectorAll('.btn-check-exercise').forEach(btn => {
    Btn.classList.remove('done');
    Btn.textContent = 'Marcar Concluído';
  });
  Document.querySelectorAll('.item').forEach(card => {
    Card.classList.remove('exercise-done');
  });

  Try {
    Await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
      Method: "POST",
      Headers: authHeaders(),
      Cache: 'no-cache',
      Body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
    });
  } catch (e) {
    Console.error("Erro ao sincronizar término de treino com o servidor:", e);
  }

  Document.getElementById('modalTreinoConcluido').classList.remove('hidden');
}

Function fecharModalConclusao() {
  Document.getElementById('modalTreinoConcluido').classList.add('hidden');
  
  Document.getElementById('workoutTimerClock').textContent = "00:00:00";
  Document.getElementById('btnWorkoutTimer').textContent = "▶ INICIAR TREINO";
  Document.getElementById('btnWorkoutTimer').style.background = "var(--good)";
  SetInputsLockState(true);

  Const proximoIdx = currentData.ultimo_treino_idx !== undefined ? CurrentData.ultimo_treino_idx : 0;
  SelectTreinoDay(proximoIdx);
}

Function toggleTrainerGoals() {
  Const body = document.getElementById('trainerGoalsBody');
  Const arrow = document.getElementById('arrowGoals');
  If (!body || !arrow) return;

  Body.classList.toggle('collapsed');
  Arrow.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
}

Function toggleCardioGoals() {
  Const body = document.getElementById('cardioGoalsBody');
  Const arrow = document.getElementById('arrowCardio');
  If (!body || !arrow) return;

  Body.classList.toggle('collapsed');
  Arrow.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
}

Function renderTreinoDetail() {
  Const days = (currentData && currentData.days) || [];
  Const day = days[currentTreinoDayIdx];
  If (!day) return openTreinoSelectionMenu();

  Document.getElementById('treinoDetailTitle').textContent = day.title;

  Const goalsContainer = document.getElementById('trainerGoalsBody');
  If (goalsContainer) {
    Const customGuidelines = (currentData && (currentData.trainer_guidelines || currentData.diretrizes_treinador)) || '';
    If (customGuidelines.trim()) {
      GoalsContainer.innerHTML = escapeHtml(customGuidelines).replace(/\n/g, '<br>');
    } else {
      GoalsContainer.innerHTML = `Siga o plano de execução, respeite os tempos de descanso e registre suas cargas.`;
    }
  }

  Const quickSwitch = document.getElementById('treinoQuickSwitch');
  QuickSwitch.innerHTML = '';
  Days.forEach((d, idx) => {
    Const chip = document.createElement('button');
    Chip.type = 'button';
    Chip.className = `quick-switch-chip ${idx === currentTreinoDayIdx ? 'active' : ''}`;
    Chip.textContent = d.title;
    Chip.onclick = () => selectTreinoDay(idx);
    QuickSwitch.appendChild(chip);
  });

  Const exercisesContainer = document.getElementById('exercisesList');
  ExercisesContainer.innerHTML = '';
  RenderExercisesForDay(day, currentTreinoDayIdx, exercisesContainer);

  Const keyObs = `obs_day_${currentTreinoDayIdx}`;
  Const savedObs = (currentData.logs && currentData.logs[keyObs]) || 
                   LocalStorage.getItem(`draft_obs_${loggedUserCode}_${currentTreinoDayIdx}`) || '';

  Const obsDiv = document.createElement('div');
  ObsDiv.style.cssText = "margin-top:16px; background:var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:14px;";
  ObsDiv.innerHTML = `
    <label class="label-fdb" style="color:var(--mark); font-size:12px;">📝 Observações / Como foi a sessão hoje?</label>
    <textarea class="input-field" id="input_obs_${currentTreinoDayIdx}" rows="2" style="font-size:14px; margin-top:4px;" 
      Placeholder="Ex: Leve desconforto no ombro, noites mal dormidas, cansaço..." 
      Oninput="salvarObservacaoTreino('${keyObs}', this.value, ${currentTreinoDayIdx})">${escapeHtml(savedObs)}</textarea>
    <div style="font-size:10px; color:var(--ink-dim); margin-top:4px;">Enviado diretamente ao Personal ao finalizar o treino.</div>
  `;
  ExercisesContainer.appendChild(obsDiv);

  CheckAndRestoreWorkoutTimer();
}

Function salvarObservacaoTreino(keyObs, valor, dayIdx) {
  If (!currentData.logs) currentData.logs = {};
  CurrentData.logs[keyObs] = valor;

  If (loggedUserCode) {
    LocalStorage.setItem(`draft_obs_${loggedUserCode}_${dayIdx}`, valor);
    LocalStorage.setItem(`draft_student_logs_${loggedUserCode}`, JSON.stringify(currentData.logs));
  }

  Const ind = document.getElementById('saveIndicator');
  If (ind) ind.style.display = 'block';

  If (autoSaveTimer) clearTimeout(autoSaveTimer);

  AutoSaveTimer = setTimeout(async () => {
    Try {
      Await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
        Method: "POST",
        Headers: authHeaders(),
        Cache: 'no-cache',
        Body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
      });
      If (ind) ind.style.display = 'none';
    } catch (e) {
      If (ind) ind.style.display = 'none';
    }
  }, 1200);
}

Function createLogInputAttr(nameKey) {
  Return `type="text" inputmode="decimal" form="none" name="workout_${nameKey}" autocomplete="off" data-lpignore="true" data-form-type="other" aria-autocomplete="none"`;
}

Function changeExerciseMode(dayIdx, exIdx, selectedMode) {
  If (!currentData.exercise_modes) currentData.exercise_modes = {};
  CurrentData.exercise_modes[`${dayIdx}_${exIdx}`] = selectedMode;

  Const exercisesContainer = document.getElementById('exercisesList');
  If (exercisesContainer) {
    ExercisesContainer.innerHTML = '';
    RenderExercisesForDay(currentData.days[dayIdx], dayIdx, exercisesContainer);
    ScheduleAutoSave(`mode_${dayIdx}_${exIdx}`, selectedMode);
    SetInputsLockState(!workoutTimerRunning);
  }
}

Function renderExercisesForDay(day, dayIdx, container) {
  (day.exercicios || []).forEach((ex, exIdx) => {
    Const modeKey = `${dayIdx}_${exIdx}`;
    Const savedUserMode = (currentData.exercise_modes && currentData.exercise_modes[modeKey]) || null;

    Const keyExDone = `ex_done_${dayIdx}_${exIdx}`;
    Const isExDone = (currentData.logs && currentData.logs[keyExDone]) === 'true';

    Const exName = ex.nome || '';
    Const exMeta = ex.reps || ex.repeticoes || '';
    
    Const rawSeries = String(ex.series || ex.num_series || '3').toLowerCase().trim();
    Const matchDigits = rawSeries.match(/\d+/);
    Let numSeriesPrescritas = matchDigits ? ParseInt(matchDigits[0]) : 3;
    If (isNaN(numSeriesPrescritas) || numSeriesPrescritas <= 0) numSeriesPrescritas = 3;

    Const tem2x = numSeriesPrescritas === 2 || rawSeries.includes('2x');
    Const isStrict1x = numSeriesPrescritas === 1 || rawSeries.includes('1x');

    Const tAdmin = String(ex.tecnica || ex.tecnica_prescrita || '').toLowerCase().trim();
    Let tecnicaAdminFixa = null;

    If (tAdmin.includes('cluster') && tAdmin.includes('back')) {
      TecnicaAdminFixa = 'cluster_backoff';
    } else if (tAdmin.includes('back')) {
      TecnicaAdminFixa = 'backoff_2x';
    } else if (tAdmin.includes('cluster')) {
      TecnicaAdminFixa = 'cluster';
    } else if (tAdmin.includes('myo')) {
      TecnicaAdminFixa = 'myoreps';
    } else if (isStrict1x) {
      TecnicaAdminFixa = 'convencional';
    }

    Const podeAlterarTecnica = (currentData.pode_alterar_tecnica === true || currentData.permitirTecnicas === true) && !tecnicaAdminFixa && !isStrict1x;

    Let activeMode = tecnicaAdminFixa ? TecnicaAdminFixa : (savedUserMode || 'convencional');

    Let cleanName = exName.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();

    Const div = document.createElement('div');
    Div.className = `item ${isExDone ? 'exercise-done' : ''}`;

    Let selectHtml = '';

    If (tecnicaAdminFixa) {
      Const nomesExibicao = {
        'convencional': isStrict1x ? '1 Série Única' : `${numSeriesPrescritas}x Convencional`,
        'backoff_2x': '⚙️ 2x + Back-Off Set',
        'cluster': '⚙ Cluster Set',
        'cluster_backoff': '⚙️ Cluster + Back-Off',
        'myoreps': '⚙ Myo-Reps'
      };
      Const rotulo = nomesExibicao[activeMode] || 'Técnica Prescrita';
      SelectHtml = `<span style="font-size:11px; font-weight:700; color:var(--mark); padding:2px 6px; border:1px solid var(--mark-dim); border-radius:4px; background:var(--panel);">${rotulo}</span>`;
    } else if (podeAlterarTecnica) {
      If (tem2x) {
        SelectHtml = `
          <select class="mode-select" onchange="changeExerciseMode(${dayIdx}, ${exIdx}, this.value)">
            <option value="convencional" ${activeMode === 'convencional' ? 'selected' : ''}>2x Convencional</option>
            <option value="cluster" ${activeMode === 'cluster' ? 'selected' : ''}>Cluster Set</option>
          </select>
        `;
      } else {
        SelectHtml = `
          <select class="mode-select" onchange="changeExerciseMode(${dayIdx}, ${exIdx}, this.value)">
            <option value="convencional" ${activeMode === 'convencional' ? 'selected' : ''}>${numSeriesPrescritas}x Convencional</option>
            <option value="backoff_2x" ${activeMode === 'backoff_2x' ? 'selected' : ''}>2x + Back-Off Set</option>
            <option value="cluster_backoff" ${activeMode === 'cluster_backoff' ? 'selected' : ''}>Cluster + Back-Off</option>
            <option value="myoreps" ${activeMode === 'myoreps' ? 'selected' : ''}>Myo-Reps</option>
          </select>
        `;
      }
    } else {
      Const exibicaoGeral = ex.tecnica || ex.tecnica_prescrita || `${numSeriesPrescritas}x Convencional`;
      SelectHtml = `<span style="font-size:11px; font-weight:700; color:var(--mark); padding:2px 6px; border:1px solid var(--mark-dim); border-radius:4px; background:var(--panel);">${escapeHtml(exibicaoGeral)}</span>`;
    }

    Const exKeySanitized = sanitizeExKey(cleanName);
    Const keyLog = `${dayIdx}_${exIdx}`;
    Const historicoEx = (currentData.weekly_logs && (currentData.weekly_logs[exKeySanitized] || currentData.weekly_logs[keyLog])) || [];
    Const ultimoRegistro = historicoEx.length > 0 ? HistoricoEx[historicoEx.length - 1] : null;

    Let prevBadgeHtml = "";
    If (ultimoRegistro) {
      Const cAnt = ultimoRegistro.cargaMax ? `${ultimoRegistro.cargaMax} kg` : '--';
      Const rAnt = ultimoRegistro.repsMed ? `${ultimoRegistro.repsMed} reps` : '--';
      Const tAnt = ultimoRegistro.tecnica ? `| Técnica: ${ultimoRegistro.tecnica}` : '';
      PrevBadgeHtml = `<div class="previous-log-badge">📈 Último treino — Carga: <b>${cAnt}</b> | Média: <b>${rAnt}</b> ${tAnt}</div>`;
    } else {
      PrevBadgeHtml = `<div class="previous-log-badge">📈 Último treino: Sem registro prévio</div>`;
    }

    Let html = `
      <div class="item-header">
        <div class="item-title">${escapeHtml(cleanName)}</div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${selectHtml}
          <button type="button" class="btn-check-exercise ${isExDone ? 'done' : ''}" 
            Onclick="toggleCheckExercise(this, ${dayIdx}, ${exIdx})">
            ${isExDone ? '✓ Concluído' : 'Marcar Concluído'}
          </button>
        </div>
      </div>
      ${prevBadgeHtml}
      <div class="series-container">
    `;

    If (activeMode === 'myoreps') {
      Const keyAtivC = `log_c_${exKeySanitized}_ativ`;
      Const keyAtivR = `log_r_${exKeySanitized}_ativ`;
      Const keyBlocos = `log_b_${exKeySanitized}_myo_blocos`;
      Const keyRepsBloco = `log_r_${exKeySanitized}_myo_repsbloco`;

      Const valAtivC = (currentData.logs && currentData.logs[keyAtivC]) || '';
      Const valAtivR = (currentData.logs && currentData.logs[keyAtivR]) || '';
      Const valBlocos = (currentData.logs && currentData.logs[keyBlocos]) || '';
      Const valRepsBloco = (currentData.logs && currentData.logs[keyRepsBloco]) || '';

      Html += `
        <div class="series-row" style="background:var(--mark-dim); border:1px solid var(--mark); border-left:4px solid var(--mark);">
          <button type="button" class="btn-check-serie" data-num="1" onclick="toggleCheckSerie(this)">Ativação</button>
          <input id="input_ativ_${exKeySanitized}" ${createLogInputAttr(keyAtivC)} class="input-field input-log" style="width:55px; border-color:var(--mark) !important;" placeholder="Kg" value="${escapeHtml(valAtivC)}" oninput="scheduleAutoSave('${keyAtivC}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">kg</span>
          <input ${createLogInputAttr(keyAtivR)} class="input-field input-log" style="width:65px; border-color:var(--mark) !important;" placeholder="Ativação" value="${escapeHtml(valAtivR)}" oninput="scheduleAutoSave('${keyAtivR}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>

        <div class="series-row" style="margin-top:6px; background:var(--panel-2); border:1px solid var(--line);">
          <button type="button" class="btn-check-serie" data-num="2" onclick="toggleCheckSerie(this)">Mini-Blocos</button>
          <input ${createLogInputAttr(keyBlocos)} class="input-field input-log" style="width:55px; border-color:var(--mark) !important;" placeholder="Blocos" value="${escapeHtml(valBlocos)}" oninput="scheduleAutoSave('${keyBlocos}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit" style="font-size:9px;">blocos</span>
          <input ${createLogInputAttr(keyRepsBloco)} class="input-field input-log" style="width:65px; border-color:var(--mark) !important;" placeholder="Reps/bloco" value="${escapeHtml(valRepsBloco)}" oninput="scheduleAutoSave('${keyRepsBloco}', this.value, ${dayIdx}, ${exIdx})">
          <span class="unit">reps</span>
        </div>
        
        <div style="font-size:10.5px; color:var(--ink-dim); margin:4px 0 0 4px;">
          ⏱ 10 a 15 segundos de descanso entre os mini-blocos com a mesma carga.
        </div>
      `;
    } else if (activeMode === 'cluster') {
      Const keyClC = `log_c_${exKeySanitized}_cl_peso`;
      Const keyClB = `log_b_${exKeySanitized}_cl_blocos`;
      Const keyClR = `log_r_${exKeySanitized}_cl_lastreps`;

      Const valClC = (currentData.logs && currentData.logs[keyClC]) || '';
      Const valClB = (currentData.logs && currentData.logs[keyClB]) || '';
      Const valClR = (currentData.logs && currentData.logs[keyClR]) || '';

      Html += `
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
      Const keyClC = `log_c_${exKeySanitized}_cl_peso`;
      Const keyClB = `log_b_${exKeySanitized}_cl_blocos`;
      Const keyClR = `log_r_${exKeySanitized}_cl_lastreps`;
      Const keyBoC = `log_c_${exKeySanitized}_s2`;
      Const keyBoR = `log_r_${exKeySanitized}_s2`;

      Const valClC = (currentData.logs && currentData.logs[keyClC]) || '';
      Const valClB = (currentData.logs && currentData.logs[keyClB]) || '';
      Const valClR = (currentData.logs && currentData.logs[keyClR]) || '';
      Const valBoC = (currentData.logs && currentData.logs[keyBoC]) || '';
      Const valBoR = (currentData.logs && currentData.logs[keyBoR]) || '';

      Const nCl = parseFloat(valClC) || 0;
      Let carga20Cl = nCl > 0 ? Math.round(nCl * 0.80) : 0;
      Let carga30Cl = nCl > 0 ? Math.round(nCl * 0.70) : 0;

      Html += `
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
                  Onclick="aplicarCargaBackoff('${keyBoC}',${carga20Cl}, ${dayIdx},${exIdx})">
                  -20% (${carga20Cl}kg)
                </button>
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
                  Onclick="aplicarCargaBackoff('${keyBoC}',${carga30Cl}, ${dayIdx},${exIdx})">
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
      Const keyS1C = `log_c_${exKeySanitized}_s1`;
      Const keyS1R = `log_r_${exKeySanitized}_s1`;
      Const keyS2C = `log_c_${exKeySanitized}_s2`;
      Const keyS2R = `log_r_${exKeySanitized}_s2`;
      Const keyBoC = `log_c_${exKeySanitized}_bo`;
      Const keyBoR = `log_r_${exKeySanitized}_bo`;

      Const valS1C = (currentData.logs && currentData.logs[keyS1C]) || '';
      Const valS1R = (currentData.logs && currentData.logs[keyS1R]) || '';
      Const valS2C = (currentData.logs && currentData.logs[keyS2C]) || '';
      Const valS2R = (currentData.logs && currentData.logs[keyS2R]) || '';
      Const valBoC = (currentData.logs && currentData.logs[keyBoC]) || '';
      Const valBoR = (currentData.logs && currentData.logs[keyBoR]) || '';

      Const nS1 = parseFloat(valS1C) || 0;
      Const nS2 = parseFloat(valS2C) || 0;
      Const maiorCarga = Math.max(nS1, nS2);
      Let c20 = maiorCarga > 0 ? Math.round(maiorCarga * 0.80) : 0;
      Let c30 = maiorCarga > 0 ? Math.round(maiorCarga * 0.70) : 0;

      Html += `
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
                  Onclick="aplicarCargaBackoff('${keyBoC}', ${c20}, ${dayIdx}, ${exIdx})">
                  -20% (${c20}kg)
                </button>
                <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
                  Onclick="aplicarCargaBackoff('${keyBoC}', ${c30}, ${dayIdx}, ${exIdx})">
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
      For (let s = 1; s <= numSeriesPrescritas; s++) {
        Const keyLoad = `log_c_${exKeySanitized}_s${s}`;
        Const keyReps = `log_r_${exKeySanitized}_s${s}`;
        Const savedLoad = (currentData.logs && currentData.logs[keyLoad]) || '';
        Const savedReps = (currentData.logs && currentData.logs[keyReps]) || '';

        Html += `
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

    Html += `</div>`;
    Div.innerHTML = html;
    Container.appendChild(div);
  });
}

Function atualizarBackoffLive(exKeySanitized, tipo, dayIdx, exIdx) {
  Const box = document.getElementById(`calc_backoff_box_${exKeySanitized}`);
  If (!box) return;

  Let maiorCarga = 0;
  Const elS1 = document.getElementById(`input_log_c_${exKeySanitized}_s1`);
  Const elS2 = document.getElementById(`input_log_c_${exKeySanitized}_s2`);
  Const v1 = elS1 ? (parseFloat(elS1.value) || 0) : 0;
  Const v2 = elS2 ? (parseFloat(elS2.value) || 0) : 0;
  MaiorCarga = Math.max(v1, v2);
  Const keyBoC = `log_c_${exKeySanitized}_bo`;

  If (maiorCarga > 0) {
    Const c20 = Math.round(maiorCarga * 0.80);
    Const c30 = Math.round(maiorCarga * 0.70);

    Box.innerHTML = `
      <div style="display:flex; gap:4px; width:100%;">
        <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--mark); color:var(--mark);" 
          Onclick="aplicarCargaBackoff('${keyBoC}', ${c20}, ${dayIdx}, ${exIdx})">
          -20% (${c20}kg)
        </button>
        <button type="button" class="rest-timer-btn" style="flex:1; padding:4px 6px; font-size:10.5px; background:var(--panel); border-color:var(--signal-light); color:var(--signal-light);" 
          Onclick="aplicarCargaBackoff('${keyBoC}', ${c30}, ${dayIdx}, ${exIdx})">
          -30% (${c30}kg)
        </button>
      </div>
    `;
  } else {
    Box.innerHTML = `<span style="font-size:10px; color:var(--ink-dim);">Digite a carga nas séries convencionais para calcular o Back-off</span>`;
  }
}

Function scheduleAutoSave(key, value, dayIdx, exIdx) {
  If (!workoutTimerRunning) {
    Alert("⚠️ Clique em '▶ INICIAR TREINO' antes de registrar dados!");
    Return;
  }

  If (!currentData.logs) currentData.logs = {};
  CurrentData.logs[key] = value;

  If (loggedUserCode) {
    LocalStorage.setItem(`draft_student_logs_${loggedUserCode}`, JSON.stringify(currentData.logs));
  }

  If (dayIdx !== undefined && exIdx !== undefined) {
    CalculateAndStoreWeeklyLog(dayIdx, exIdx);
  }

  Const ind = document.getElementById('saveIndicator');
  If (ind) ind.style.display = 'block';

  If (autoSaveTimer) clearTimeout(autoSaveTimer);

  AutoSaveTimer = setTimeout(async () => {
    Try {
      Await fetch(`${BACKEND_URL}/api/aluno/salvar`, {
        Method: "POST",
        Headers: authHeaders(),
        Cache: 'no-cache',
        Body: JSON.stringify({ codigo: loggedUserCode, payload: currentData })
      });
      If (ind) ind.style.display = 'none';
    } catch (e) {
      If (ind) ind.style.display = 'none';
    }
  }, 1200);
}

Function calculateAndStoreWeeklyLog(dayIdx, exIdx) {
  If (!currentData.weekly_logs) currentData.weekly_logs = {};
  
  If (!currentData.days || !currentData.days[dayIdx] || !currentData.days[dayIdx].exercicios[exIdx]) return;

  Const exObj = currentData.days[dayIdx].exercicios[exIdx];
  Const cleanExName = (exObj.nome || '').replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  Const exKeySanitized = sanitizeExKey(cleanExName);
  Const keyLog = `${dayIdx}_${exIdx}`;

  Const seriesStr = String(exObj.series || '').toLowerCase();
  Const isStrict1x = seriesStr.includes('1x') || seriesStr.trim() === '1';
  Const numSeries = isStrict1x ? 1 : (parseInt(exObj.series) || 3);

  Const modeKey = `${dayIdx}_${exIdx}`;
  Const savedUserMode = (currentData.exercise_modes && currentData.exercise_modes[modeKey]) || 'convencional';
  
  Const nomesTecnica = {
    'convencional': isStrict1x ? 'Série Única' : 'Convencional',
    'myoreps': 'Myo-Reps',
    'cluster': 'Cluster Set',
    'cluster_backoff': 'Cluster + Back-Off',
    'backoff_2x': '2x + Back-Off'
  };
  Const tecnicaUsada = nomesTecnica[savedUserMode] || 'Convencional';

  Let maxCarga = 0;
  Let totalReps = 0;
  Let seriesPreenchidas = 0;

  For (let s = 1; s <= numSeries + 2; s++) {
    Const cVal = parseFloat(currentData.logs[`log_c_${exKeySanitized}_s${s}`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_s${s}`]);
    Const rVal = parseFloat(currentData.logs[`log_r_${exKeySanitized}_s${s}`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_s${s}`]);

    If (!isNaN(cVal) && cVal > maxCarga) maxCarga = cVal;
    If (!isNaN(rVal)) {
      TotalReps += rVal;
      SeriesPreenchidas++;
    }
  }

  Const cMyoAtiv = parseFloat(currentData.logs[`log_c_${exKeySanitized}_ativ`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_ativ`]);
  Const rMyoAtiv = parseFloat(currentData.logs[`log_r_${exKeySanitized}_ativ`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_ativ`]);
  Const rMyoBlocos = parseFloat(currentData.logs[`log_b_${exKeySanitized}_myo_blocos`]);
  Const rMyoRepsBloco = parseFloat(currentData.logs[`log_r_${exKeySanitized}_myo_repsbloco`]);

  If (!isNaN(cMyoAtiv) && cMyoAtiv > maxCarga) maxCarga = cMyoAtiv;
  If (!isNaN(rMyoAtiv)) { 
    TotalReps += rMyoAtiv; 
    SeriesPreenchidas++; 
  }
  If (!isNaN(rMyoBlocos) && !isNaN(rMyoRepsBloco)) {
    TotalReps += (rMyoBlocos * rMyoRepsBloco);
  }

  Const cCl = parseFloat(currentData.logs[`log_c_${exKeySanitized}_cl_peso`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_cl_peso`]);
  Const rCl = parseFloat(currentData.logs[`log_r_${exKeySanitized}_cl_lastreps`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_cl_lastreps`]);
  If (!isNaN(cCl) && cCl > maxCarga) maxCarga = cCl;
  If (!isNaN(rCl)) { totalReps += rCl; seriesPreenchidas++; }

  Const cBo = parseFloat(currentData.logs[`log_c_${exKeySanitized}_bo`] || currentData.logs[`log_c_${dayIdx}_${exIdx}_bo`]);
  Const rBo = parseFloat(currentData.logs[`log_r_${exKeySanitized}_bo`] || currentData.logs[`log_r_${dayIdx}_${exIdx}_bo`]);
  If (!isNaN(cBo) && cBo > maxCarga) maxCarga = cBo;
  If (!isNaN(rBo)) { totalReps += rBo; seriesPreenchidas++; }

  If (maxCarga > 0) {
    Const mediaReps = seriesPreenchidas > 0 ? Math.round(totalReps / seriesPreenchidas) : "-";
    Const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    If (!currentData.weekly_logs[exKeySanitized]) currentData.weekly_logs[exKeySanitized] = [];

    Let hist = currentData.weekly_logs[exKeySanitized];
    
    Const idxHoje = hist.findIndex(item => item.data === dataHoje);
    If (idxHoje !== -1) {
      Hist[idxHoje] = { data: dataHoje, cargaMax: maxCarga, repsMed: mediaReps, tecnica: tecnicaUsada };
    } else {
      Hist.push({ data: dataHoje, cargaMax: maxCarga, repsMed: mediaReps, tecnica: tecnicaUsada });
    }

    If (hist.length > 4) hist = hist.slice(-4);
    CurrentData.weekly_logs[exKeySanitized] = hist;
    CurrentData.weekly_logs[keyLog] = hist;
  }
}

Function parseDietaAluno(rawText) {
  If (!rawText || !rawText.trim()) return [];

  Const abas = [];
  Const rawAbas = rawText.split(/(?=\[\s*ABA\s*\]|\[\s*CICLO\s*\]|---)/gi);

  RawAbas.forEach((rawAba, abaIdx) => {
    Const cleanAba = rawAba.trim();
    If (!cleanAba || cleanAba === '---') return;

    Let abaNome = "DIETA BASE";
    Let textContent = cleanAba;

    If (/^(\[\s*ABA\s*\]|\[\s*CICLO\s*\])/i.test(cleanAba)) {
      Const linesAba = cleanAba.split('\n');
      AbaNome = linesAba[0].replace(/\[\s*ABA\s*\]|\[\s*CICLO\s*\]/gi, '').trim() || `Ciclo ${abaIdx + 1}`;

      Let startIdx = 1;
      If (linesAba.length > 1 && linesAba[1].toLowerCase().trim().startsWith('dias:')) {
        StartIdx = 2;
      }
      TextContent = linesAba.slice(startIdx).join('\n').trim();
    }

    Const regexTitulosRefeicao = /(?=\[\s*REFEIÇÃO\s*\]|\[\s*DIETA BASE\s*\]|🍽|\d+ª\s*Refeição|Refeição\s*\d+|REF\s*\d+|CAFÉ DA MANHÃ|ALMOÇO|LANCHE PÓS CORRIDA|CAFÉ DA TARDE|JANTAR|CEIA)/gi;
    Const rawMeals = textContent.split(regexTitulosRefeicao);
    Const meals = [];

    RawMeals.forEach(bloco => {
      Let clean = bloco.trim();
      If (!clean) return;

      Clean = clean.replace(/^\[?\s*REFEIÇÃO\s*\]?\s*/gi, '').replace(/^REFEIÇÃO\]\s*/gi, '').trim();

      Const lines = clean.split('\n').map(l => l.trim()).filter(l => l !== '' && l.toLowerCase() !== 'a gosto' && l.toLowerCase() !== 'qtd');
      If (lines.length === 0) return;

      Let title = lines[0].replace(/^\[.*?\]\s*/, '').replace(/^🍽\s*/, '').trim();
      Const titleLower = title.toLowerCase();

      If (
        TitleLower.includes('plano alimentar') || 
        TitleLower.includes('resumo nutricional') ||
        TitleLower.includes('meta diaria') ||
        TitleLower.includes('metas diarias') ||
        TitleLower.includes('meta diária') ||
        TitleLower.includes('metas diárias') ||
        TitleLower.includes('suplemento') ||
        TitleLower.includes('suplementos') ||
        TitleLower.includes('suplementação') ||
        TitleLower.includes('suplementacao') ||
        TitleLower.includes('gasto estimado')
      ) {
        Return;
      }

      Let days = "";
      Const baseItems = [];
      Const trocasCarbo = [];
      Const trocasProt = [];

      Lines.slice(1).forEach(line => {
        Let lineClean = line.replace(/\[\s*\]/g, '').trim();
        Const lineLower = lineClean.toLowerCase();
        
        If (lineLower.startsWith('dias:') || lineLower.startsWith('dias da semana:')) {
          Days = lineClean.replace(/^dias(\s*da\s*semana)?:/i, '📅 Dias:').trim();
          If (!days.startsWith('📅')) days = '📅 ' + days;
        } else if (lineClean.includes('↳') || lineClean.includes('(Opção de troca)') || lineClean.includes('(Troca)') || lineClean.includes('Trocas de') || lineClean.includes('Carboidratos:') || lineClean.includes('Proteínas')) {
          Let itemTxt = lineClean.replace(/↳|Opção de Troca|\(Carboidrato\):|\(Proteína\):|\(Opção de troca\)|\(Troca\)/gi, '').replace(/^[-•*]\s*/, '').trim();
          If (!itemTxt || itemTxt.toLowerCase().includes('trocas de')) return;
          
          ItemTxt = itemTxt.replace(/\[\s*CARBO\s*\]/gi, '').replace(/\[\s*PROT\s*\]/gi, '').replace(/\[\s*\]/g, '').trim();

          If (lineClean.toUpperCase().includes('[CARBO]') || lineClean.toLowerCase().includes('carbo') || lineClean.toLowerCase().includes('carboidrato')) {
            TrocasCarbo.push(itemTxt);
          } else if (lineClean.toUpperCase().includes('[PROT]') || lineLower.includes('prot') || lineLower.includes('proteína') || lineLower.includes('proteina')) {
            TrocasProt.push(itemTxt);
          } else {
            TrocasCarbo.push(itemTxt);
          }
        } else {
          Const cleanItem = lineClean.replace(/^[-•*]\s*/, '').trim();
          If (cleanItem && cleanItem.toLowerCase() !== 'plano alimentar') {
            BaseItems.push(cleanItem);
          }
        }
      });

      If (title && (baseItems.length > 0 || trocasCarbo.length > 0 || trocasProt.length > 0)) {
        Meals.push({
          MealTitle: title,
          Days: days,
          BaseItems: baseItems,
          TrocasCarbo: trocasCarbo,
          TrocasProt: trocasProt
        });
      }
    });

    If (meals.length > 0) {
      Abas.push({ abaNome: abaNome || `Opção ${abaIdx + 1}`, meals: meals, fullText: cleanAba.toLowerCase() });
    }
  });

  Return abas;
}

Function trocarAbaDieta(valIndex) {
  ActiveAlunoDietAbaIndex = parseInt(valIndex) || 0;
  RenderDietaAluno(currentData.refeicoes || currentData.dieta || []);
}

Function renderDietaAluno(refeicoesData) {
  Const categoryList = document.getElementById('dietCategoryList');
  Const selectAba = document.getElementById('dietAbaSelect');
  Const dayLabel = document.getElementById('dietCurrentDayLabel');

  If (!categoryList) return;
  CategoryList.innerHTML = "";

  Let rawText = "";
  If (Array.isArray(refeicoesData)) {
    RefeicoesData.forEach(r => {
      If (typeof r === 'string') {
        RawText += `${r}\n\n`;
      } else if (r.titulo || r.alimentos || r.mealTitle) {
        Const t = r.titulo || r.mealTitle || 'Refeição';
        Const a = r.alimentos || (r.baseItems ? R.baseItems.join('\n') : '');
        RawText += `[REFEIÇÃO] ${t}\n${a}\n\n`;
      }
    });
  } else if (typeof refeicoesData === 'string') {
    RawText = refeicoesData;
  }

  Let cleanText = rawText.trim();
  Let metasTexto = "";
  Let suplementosList = [];

  Const regexMetas = /(?:🎯|Meta Calórica|Gasto Estimado|Gorduras:|Meta Hídrica:|[SUPLEMENTAÇÃO DIÁRIA])[\s\S]*?(?=(?:🍽\s*REF|\n\s*REF\s*\d+|\[\s*ABA\s*\]|$))/i;
  Const matchMetas = cleanText.match(regexMetas);

  If (matchMetas) {
    Const blocoMetas = matchMetas[0].trim();
    CleanText = cleanText.replace(blocoMetas, '').trim();

    Const linhas = blocoMetas.split('\n').map(l => l.trim()).filter(l => l !== '');
    Let emSuplementos = false;

    Linhas.forEach(linha => {
      Const linhaLower = linha.toLowerCase().trim();

      If (
        LinhaLower.includes('plano alimentar') || 
        LinhaLower.includes('refeição]') || 
        LinhaLower.includes('[refeição]') ||
        LinhaLower.startsWith('🍽')
      ) {
        Return;
      }

      If (
        LinhaLower.includes('[suplementação diária]') || 
        LinhaLower.includes('suplementação')
      ) {
        EmSuplementos = true;
        Return;
      }

      If (emSuplementos) {
        If (linha.startsWith('-') || linha.startsWith('•')) {
          SuplementosList.push(linha.replace(/^[-•*]\s*/, '').trim());
        }
      } else {
        MetasTexto += linha + '\n';
      }
    });
  }

  Let abas = parseDietaAluno(cleanText);

  If (!abas || abas.length === 0) {
    CategoryList.innerHTML = `<div style="font-size:13px; color:var(--ink-dim); text-align:center; padding:20px;">Nenhum ciclo alimentar cadastrado para hoje.</div>`;
    Return;
  }

  Const diaHojeKey = obterDiaSemanaNormalizado();
  Const nomeHojeFmt = obterNomeDiaSemanaFormatado();
  Let abaIndexHoje = -1;

  Abas.forEach((aba, idx) => {
    Const textoAbaNorm = (aba.fullText || (aba.abaNome + " " + JSON.stringify(aba.meals))).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    If (textoAbaNorm.includes(diaHojeKey)) {
      AbaIndexHoje = idx;
    }
  });

  If (abaIndexHoje === -1) abaIndexHoje = 0;

  If (activeAlunoDietAbaIndex === null || activeAlunoDietAbaIndex === undefined || activeAlunoDietAbaIndex >= abas.length) {
    ActiveAlunoDietAbaIndex = abaIndexHoje;
  }

  If (dayLabel) {
    DayLabel.innerHTML = `📅 Hoje (${nomeHojeFmt})`;
  }

  If (selectAba) {
    SelectAba.innerHTML = "";
    Abas.forEach((aba, idx) => {
      Const option = document.createElement('option');
      Option.value = idx;
      Const ehHoje = (idx === abaIndexHoje);
      Option.textContent = `${aba.abaNome || 'Ciclo ' + (idx + 1)} ${ehHoje ? '📌 (Hoje)' : ''}`;
      If (idx === activeAlunoDietAbaIndex) option.selected = true;
      SelectAba.appendChild(option);
    });
  }

  If (metasTexto.trim() || suplementosList.length > 0) {
    Const boxConectado = document.createElement('div');
    BoxConectado.style.cssText = "background: #0d0204; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;";

    Let innerHtml = "";

    If (metasTexto.trim()) {
      InnerHtml += `
        <div style="border-bottom: 1px solid rgba(220,170,58,0.15); padding-bottom: 6px;">
          <div onclick="const el = document.getElementById('sub_metas_app'); if(el) el.classList.toggle('hidden');" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--mark); font-size:12px; font-weight:800;">📊 METAS DIÁRIAS (CALORIAS & ÁGUA)</span>
            <span style="color:var(--mark); font-size:11px; font-weight:700;">Ver ▾</span>
          </div>
          <div id="sub_metas_app" class="hidden" style="margin-top:6px; font-size:11.5px; color:#fff; line-height:1.5; white-space:pre-line;">
            ${escapeHtml(metasTexto.trim())}
          </div>
        </div>
      `;
    }

    If (suplementosList.length > 0) {
      InnerHtml += `
        <div>
          <div onclick="const el = document.getElementById('sub_suple_app'); if(el) el.classList.toggle('hidden');" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#60a5fa; font-size:12px; font-weight:800;">💊 SUPLEMENTAÇÃO DIÁRIA</span>
            <span style="color:#60a5fa; font-size:11px; font-weight:700;">Ver ▾</span>
          </div>
          <div id="sub_suple_app" class="hidden" style="margin-top:6px; font-size:11.5px; color:#fff;">
            <ul style="padding-left:16px; margin:0;">
              ${suplementosList.map(s => `<li style="margin-bottom:3px;">${escapeHtml(s)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    BoxConectado.innerHTML = innerHtml;
    CategoryList.appendChild(boxConectado);
  }

  Const currentAba = abas[activeAlunoDietAbaIndex] || abas[0];
  If (currentAba && currentAba.meals) {
    CurrentAba.meals.forEach((meal, idx) => {
      Const card = document.createElement('div');
      Card.style.cssText = "background:var(--panel-2); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:10px;";

      Const uniqueId = `trocas_aluno_${activeAlunoDietAbaIndex}_${idx}`;

      Let html = `
        <div style="border-bottom:1px solid var(--line); padding-bottom:6px; margin-bottom:8px;">
          <h3 style="color:var(--mark); font-size:14px; font-weight:800; margin:0;">🍽 ${escapeHtml(meal.mealTitle || 'Refeição')}</h3>
          ${meal.days ? `<span style="font-size:10.5px; color:var(--blue); font-weight:700;">${escapeHtml(meal.days)}</span>` : ''}
        </div>
        
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
      `;

      (meal.baseItems || []).forEach(item => {
        Html += `<div style="font-size:12.5px; color:var(--ink); font-weight:600;">• ${escapeHtml(item)}</div>`;
      });

      Html += `</div>`;

      If ((meal.trocasCarbo && meal.trocasCarbo.length > 0) || (meal.trocasProt && meal.trocasProt.length > 0)) {
        Html += `
          <div style="border-top:1px dashed var(--line); padding-top:6px;">
            <button type="button" onclick="const el = document.getElementById('${uniqueId}'); if(el) el.classList.toggle('hidden');" style="background:var(--panel); border:1px solid var(--mark); color:var(--mark); width:100%; padding:6px; border-radius:6px; font-size:10.5px; font-weight:800; cursor:pointer;">
              🔄 VER OPÇÕES DE TROCA ▾
            </button>
            
            <div id="${uniqueId}" class="hidden" style="margin-top:6px; background:var(--bg); padding:8px; border-radius:6px;">
        `;

        If (meal.trocasCarbo && meal.trocasCarbo.length > 0) {
          Html += `<div style="font-size:10.5px; color:var(--blue); font-weight:800; margin-bottom:4px;">🌾 Trocas de Carboidratos:</div>`;
          Meal.trocasCarbo.forEach(subC => {
            Html += `<div class="sub-item-box carbo">• ${escapeHtml(subC)}</div>`;
          });
        }

        If (meal.trocasProt && meal.trocasProt.length > 0) {
          Html += `<div style="font-size:10.5px; color:var(--good); font-weight:800; margin-top:6px; margin-bottom:4px;">🥩 Trocas de Proteínas / Gorduras:</div>`;
          Meal.trocasProt.forEach(subP => {
            Html += `<div class="sub-item-box prot">• ${escapeHtml(subP)}</div>`;
          });
        }

        Html += `</div></div>`;
      }

      Card.innerHTML = html;
      CategoryList.appendChild(card);
    });
  }
}

Const TAB_ORDER = ['treino', 'dieta', 'corrida', 'ergogenicos', 'feedback'];

Function showTab(tab) {
  TAB_ORDER.forEach(t => {
    Const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    Const btn = document.getElementById(`btn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    If (el) el.classList.add('hidden');
    If (btn) btn.classList.remove('active');
  });

  Const activeTab = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  Const activeBtn = document.getElementById(`btn${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  If (activeTab) activeTab.classList.remove('hidden');
  If (activeBtn) activeBtn.classList.add('active');

  Const restWidget = document.getElementById('restTimerWidget');
  If (restWidget) {
    If (tab === 'treino') {
      RestWidget.classList.add('visible');
    } else {
      RestWidget.classList.remove('visible');
    }
  }
}

Let swipeNavReady = false;

Function setupSwipeNavigation() {
  If (swipeNavReady) return;
  SwipeNavReady = true;

  Const viewport = document.getElementById('swipeViewport');
  If (!viewport) return;

  Let startX = 0, startY = 0, tracking = false;
  Const SWIPE_THRESHOLD = 55;

  Viewport.addEventListener('touchstart', (e) => {
    If (e.touches.length !== 1) return;
    StartX = e.touches[0].clientX;
    StartY = e.touches[0].clientY;
    Tracking = true;
  }, { passive: true });

  Viewport.addEventListener('touchend', (e) => {
    If (!tracking) return;
    Tracking = false;

    Const endX = e.changedTouches[0].clientX;
    Const endY = e.changedTouches[0].clientY;
    Const deltaX = endX - startX;
    Const deltaY = endY - startY;

    If (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;

    Const activeIdx = TAB_ORDER.findIndex(t => {
      Const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      Return el && !el.classList.contains('hidden');
    });
    If (activeIdx === -1) return;

    Let nextIdx = activeIdx;
    If (deltaX < 0 && activeIdx < TAB_ORDER.length - 1) nextIdx = activeIdx + 1;
    If (deltaX > 0 && activeIdx > 0) nextIdx = activeIdx - 1;

    If (nextIdx !== activeIdx) showTab(TAB_ORDER[nextIdx]);
  }, { passive: true });
}

Function previewFeedbackPhotos(event) {
  Const files = Array.from(event.target.files);
  Const previewContainer = document.getElementById('feedbackPhotoPreview');
  If (!previewContainer) return;

  SelectedFeedbackFiles = selectedFeedbackFiles.concat(files);
  PreviewContainer.innerHTML = '';

  SelectedFeedbackFiles.forEach((file, index) => {
    Const reader = new FileReader();
    Reader.onload = (e) => {
      Const box = document.createElement('div');
      Box.style.cssText = 'position:relative; display:inline-block; margin:3px;';

      Const img = document.createElement('img');
      Img.src = e.target.result;
      Img.style.cssText = 'width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--mark);';

      Const btnRemove = document.createElement('button');
      BtnRemove.textContent = '✕';
      BtnRemove.type = 'button';
      BtnRemove.style.cssText = 'position:absolute; top:-5px; right:-5px; background:red; color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:10px; cursor:pointer; font-weight:bold;';
      BtnRemove.onclick = () => {
        SelectedFeedbackFiles.splice(index, 1);
        PreviewFeedbackPhotos({ target: { files: [] } });
      };

      Box.appendChild(img);
      Box.appendChild(btnRemove);
      PreviewContainer.appendChild(box);
    };
    Reader.readAsDataURL(file);
  });
}

Function renderFeedbackHistory() {
  Const container = document.getElementById('alunoFeedbackHistory');
  If (!container) return;
  Container.innerHTML = '';

  Const feedbacks = (currentData && currentData.feedbacks) || [];

  If (feedbacks.length === 0) {
    Container.innerHTML = '<div style="font-size:11.5px; color:var(--ink-dim); text-align:center; padding:12px;">Envie seu primeiro feedback semanal ou foto ao Personal abaixo!</div>';
    Return;
  }

  Feedbacks.forEach(f => {
    Const isAluno = f.autor === "ALUNO";
    Container.innerHTML += `
      <div style="background:${isAluno ? 'var(--signal-dim)' : 'var(--panel-2)'}; padding:8px 12px; border-radius:8px; font-size:12.5px; color:var(--ink); align-self:${isAluno ? 'flex-end' : 'flex-start'}; border:1px solid ${isAluno ? 'var(--signal-light)' : 'var(--line)'}; max-width:85%;">
        <b>${isAluno ? 'Você' : 'Personal Jhonata'}:</b> ${escapeHtml(f.mensagem)}
      </div>
    `;
  });
  Container.scrollTop = container.scrollHeight;
}

Async function enviarFeedbackAlunoApp() {
  Const input = document.getElementById('alunoFeedbackInput');
  Const msg = input ? Input.value.trim() : '';
  Const btn = document.getElementById('btnSendFeedbackPhotos');
  Const nomeAluno = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;

  If (!msg && selectedFeedbackFiles.length === 0) {
    Return alert("Escreva um relato ou selecione ao menos uma foto.");
  }

  If (btn) {
    Btn.disabled = true;
    Btn.textContent = "Enviando fotos ao Drive...";
  }

  Let driveUrls = [];
  If (selectedFeedbackFiles.length > 0) {
    For (let i = 0; i < selectedFeedbackFiles.length; i++) {
      Const file = selectedFeedbackFiles[i];
      Const driveUrl = await enviarArquivoParaGoogleDrive(nomeAluno, file, `Feedback_${new Date().toISOString().split('T')[0]}_Foto_${i + 1}`);
      If (driveUrl) driveUrls.push(driveUrl);
    }
  }

  Try {
    Const token = localStorage.getItem('aluno_token') || localStorage.getItem('token') || localStorage.getItem('tokenAluno');
    Const headers = { 'Content-Type': 'application/json' };
    If (token) headers['Authorization'] = `Bearer ${token}`;

    Const res = await fetch(`${BACKEND_URL}/api/feedback/enviar`, {
      Method: 'POST',
      Headers: headers,
      Body: JSON.stringify({
        Codigo: loggedUserCode,
        Autor: 'ALUNO',
        Mensagem: msg + (driveUrls.length > 0 ? `\n\n📷 Fotos no Drive:\n${driveUrls.join('\n')}` : '')
      })
    });

    If (res.ok) {
      Alert("Feedback e fotos enviados com sucesso!");
      If (input) input.value = '';
      SelectedFeedbackFiles = [];
      Const previewContainer = document.getElementById('feedbackPhotoPreview');
      If (previewContainer) previewContainer.innerHTML = '';
      Const photoInput = document.getElementById('feedbackPhotoInput');
      If (photoInput) photoInput.value = '';
      
      If (!currentData.feedbacks) currentData.feedbacks = [];
      CurrentData.feedbacks.push({ autor: "ALUNO", mensagem: msg + (driveUrls.length > 0 ? " (Fotos anexadas no Drive)" : ""), data: new Date().toISOString() });
      RenderFeedbackHistory();
    } else {
      Alert("Feedback enviado, mas falhou ao sincronizar histórico.");
    }
  } catch (e) {
    Alert("Erro na conexão com o servidor ao salvar o feedback.");
  } finally {
    If (btn) {
      Btn.disabled = false;
      Btn.textContent = "Enviar Feedback";
    }
  }
}

Function sendWhatsAppFeedback() {
  Const input = document.getElementById('alunoFeedbackInput');
  Const text = input ? Input.value.trim() : "";

  Const nome = currentData ? (currentData.clientName || loggedUserCode) : loggedUserCode;
  Const msg = `*MENSAGEM DE FEEDBACK — ALUNO*%0A%0A*Aluno:* ${nome}%0A*Relatório:*%0A${encodeURIComponent(text || 'Olá Jhonata, gostaria de tirar uma dúvida!')}`;
  Window.open(`https://wa.me/5551990169026?text=${msg}`, '_blank');
}

Function logout() {
  LocalStorage.removeItem('logged_user');
  LocalStorage.removeItem('aluno_token');
  LocalStorage.removeItem('token');
  LocalStorage.removeItem('tokenAluno');
  
  CurrentData = null;
  LoggedUserCode = "";
  CurrentTreinoDayIdx = 0;

  If (inactivityTimer) clearTimeout(inactivityTimer);

  Const restWidget = document.getElementById('restTimerWidget');
  If (restWidget) restWidget.classList.remove('visible');

  Document.body.classList.remove('app-mode');
  Document.getElementById('mainContent').classList.add('hidden');
  Document.getElementById('anamneseScreen').classList.add('hidden');
  Document.getElementById('loginScreen').classList.remove('hidden');

  Const errDiv = document.getElementById('loginError');
  If (errDiv) errDiv.classList.add('hidden');

  If (window.history && window.history.replaceState) {
    Window.history.replaceState(null, document.title, window.location.pathname);
  }
}
