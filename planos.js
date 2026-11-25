/* =============================================================
   PLANOS, PREÇOS E LINKS DE PAGAMENTO (ARQUIVO ÚNICO)
   -------------------------------------------------------------
   Para mudar um preço ou link, edite SÓ este arquivo.
   Ele é usado pela página de vendas (index.html) e pela
   avaliação/pagamento do app (app.html).

   pix         → valor total à vista no PIX
   cartao      → { parcelas, total } parcelado no cartão
   recorrente  → valor mensal no cartão recorrente (não ocupa o limite)
   links       → links de pagamento do Asaas
============================================================= */
const ASAAS = 'https://' + 'www.asaas.com/000/c/';
const WHATSAPP_NUMERO = '5551990169026';
// Chave PIX usada nas cobranças de alunos antigos (mensalidade fora dos planos do site)
const CHAVE_PIX = '5551990169026';

const PLANOS = {
  // ---------------- CONSULTORIA DE TREINO (CARRO-CHEFE) ----------------
  TREINO_ANUAL: {
    tipo: 'treino', dupla: false, duracao: 'Anual', meses: 12,
    nome: 'Consultoria de Treino — Anual',
    pix: 680, cartao: { parcelas: 12, total: 780 }, recorrente: 75,
    links: { pix: ASAAS + 'p2wcl800gzb89syn', cartao: ASAAS + 'c8erc0jckiuvbumr', recorrente: ASAAS + 'wl884svbja9nop1a' }
  },
  TREINO_SEMESTRAL: {
    tipo: 'treino', dupla: false, duracao: 'Semestral', meses: 6,
    nome: 'Consultoria de Treino — Semestral',
    pix: 390, cartao: { parcelas: 6, total: 450 }, recorrente: null,
    links: { pix: ASAAS + 'lde99jt1e1hwk1kk', cartao: ASAAS + 'cdmv8smbspokjaf2' }
  },
  TREINO_TRIMESTRAL: {
    tipo: 'treino', dupla: false, duracao: 'Trimestral', meses: 3,
    nome: 'Consultoria de Treino — Trimestral',
    pix: 225, cartao: { parcelas: 3, total: 255 }, recorrente: null,
    links: { pix: ASAAS + '3lei5tlwf8xwbssq', cartao: ASAAS + '7wrzf5nnfhts6ure' }
  },
  TREINO_DUPLA: {
    tipo: 'treino', dupla: true, duracao: 'Anual', meses: 12,
    nome: 'Consultoria de Treino em Dupla — Anual',
    pix: 1100, cartao: { parcelas: 12, total: 1320 }, recorrente: 130,
    links: { pix: ASAAS + '91d5445nu0sja72c', cartao: ASAAS + '5lfnj8y3tdgmonu1', recorrente: ASAAS + '0kyjb6530xrhqm7m' }
  },

  // ---------------- CONSULTORIA COMPLETA (TREINO + DIETA) ----------------
  COMPLETA_ANUAL: {
    tipo: 'completa', dupla: false, duracao: 'Anual', meses: 12,
    nome: 'Consultoria Completa — Anual',
    pix: 1000, cartao: { parcelas: 12, total: 1200 }, recorrente: 115,
    links: { pix: ASAAS + 'i01gidoaoaytrfkx', cartao: ASAAS + 'yfzatosdxtem2qwi', recorrente: ASAAS + '2q7h1qafn6yi4wmk' }
  },
  COMPLETA_SEMESTRAL: {
    tipo: 'completa', dupla: false, duracao: 'Semestral', meses: 6,
    nome: 'Consultoria Completa — Semestral',
    pix: 570, cartao: { parcelas: 6, total: 660 }, recorrente: null,
    links: { pix: ASAAS + 'ad61ghbn480pufcg', cartao: ASAAS + '7zim8a7qjox0dfan' }
  },
  COMPLETA_TRIMESTRAL: {
    tipo: 'completa', dupla: false, duracao: 'Trimestral', meses: 3,
    nome: 'Consultoria Completa — Trimestral',
    pix: 330, cartao: { parcelas: 3, total: 360 }, recorrente: null,
    links: { pix: ASAAS + 'j7amdueweuza6wbe', cartao: ASAAS + 'zm822um8zwsmhcxr' }
  },
  COMPLETA_DUPLA: {
    tipo: 'completa', dupla: true, duracao: 'Anual', meses: 12,
    nome: 'Consultoria Completa em Dupla — Anual',
    pix: 1840, cartao: { parcelas: 12, total: 2040 }, recorrente: 190,
    links: { pix: ASAAS + 'tss47vy6j6xpdv1d', cartao: ASAAS + 'yqfededh74uuyhuq', recorrente: ASAAS + 'oyaetcav59f8sn1j' }
  }
};

/* ---------------- FUNÇÕES DE APOIO (não precisa mexer) ---------------- */
function formatarReais(valor) {
  const temCentavos = Math.round(valor * 100) % 100 !== 0;
  return 'R$ ' + Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: temCentavos ? 2 : 0, maximumFractionDigits: 2 });
}

function valorParcela(plano) {
  return plano.cartao ? plano.cartao.total / plano.cartao.parcelas : 0;
}

// Formas de pagamento disponíveis para um plano, já com o texto pronto
function formasPagamentoPlano(plano) {
  const formas = [];
  if (plano.pix) {
    const economia = plano.cartao ? plano.cartao.total - plano.pix : 0;
    formas.push({
      id: 'pix', icone: '⚡', titulo: `${formatarReais(plano.pix)} no PIX à vista`,
      detalhe: economia > 0 ? `Economize ${formatarReais(economia)} • início imediato` : 'Início imediato',
      link: plano.links && plano.links.pix
    });
  }
  if (plano.cartao) {
    formas.push({
      id: 'cartao', icone: '💳', titulo: `${plano.cartao.parcelas}x de ${formatarReais(valorParcela(plano))} no cartão`,
      detalhe: `Total ${formatarReais(plano.cartao.total)}`,
      link: plano.links && plano.links.cartao
    });
  }
  if (plano.recorrente) {
    formas.push({
      id: 'recorrente', icone: '🔁', titulo: `${formatarReais(plano.recorrente)}/mês no cartão recorrente`,
      detalhe: 'Não ocupa o limite total do cartão',
      link: plano.links && plano.links.recorrente
    });
  }
  return formas;
}

function linkWhatsApp(mensagem) {
  return 'https://' + 'wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(mensagem);
}
