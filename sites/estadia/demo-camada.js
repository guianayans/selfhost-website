// Camada do site de demonstração do Estadia (injetada pelo demo-roteador.mjs no index.html).
// Fica por cima do app pronto, sem mudar o pacote dele:
//  - aviso "Demonstração" com o funcionário atual, "Trocar funcionário" e "Recomeçar do zero";
//  - painel "Funcionários do hotel": cartões (perfil, resumo, menus que vê) e a matriz menus × funcionários;
//  - botão "Trocar funcionário" no cabeçalho e no menu do usuário;
//  - menu lateral recolhível no computador (botão, atalho "[", preferência salva no navegador);
//  - Rack só para quem vê reservas; a camareira abre direto na Governança.
(function () {
  'use strict';
  var BASE = '/estadia';
  var reduzMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- catálogo de menus (o mesmo critério do menu do app) ----------
  // Início é de todos; Saúde do sistema é só do suporte técnico (não há essa conta na demo).
  var MENUS = [
    { rota: '/mapa', rotulo: 'Mapa do dia', exige: ['quarto.ver_mapa'] },
    { rota: '/reservas', rotulo: 'Reservas', exige: ['reserva.ver'] },
    { rota: '/caixa', rotulo: 'Caixa', exige: ['caixa.operar'] },
    { rota: '/rack', rotulo: 'Rack', exige: ['quarto.ver_mapa', 'reserva.ver'] },
    { rota: '/relatorios', rotulo: 'Relatórios', exige: ['relatorio.operacional'] },
    { rota: '/auditoria', rotulo: 'Auditoria', exige: ['auditoria.ver'] },
    { rota: '/fechamento', rotulo: 'Fechamento do dia', exige: ['fechamento.executar'] },
    { rota: '/governanca', rotulo: 'Governança', exige: ['quarto.governanca'] },
    { rota: '/quartos', rotulo: 'Quartos', exige: ['quarto.cadastrar'] },
    { rota: '/tarifas', rotulo: 'Tarifas', exige: ['tarifa.configurar'] },
    { rota: '/empresas', rotulo: 'Empresas', exige: ['empresa.gerenciar'] },
    { rota: '/usuarios', rotulo: 'Usuários', exige: ['usuario.gerenciar'] },
  ];
  /** Quais menus uma lista de permissões enxerga. */
  function menusVisiveis(permissoes) {
    var tem = {};
    (permissoes || []).forEach(function (p) { tem[p] = true; });
    return MENUS.filter(function (m) { return m.exige.every(function (p) { return tem[p]; }); });
  }
  var ORDEM_PERFIS = ['ADMIN', 'GERENCIA', 'RECEPCAO', 'FINANCEIRO', 'GOVERNANCA', 'LIMPEZA', 'MANUTENCAO'];
  var DESCRICAO = {
    RECEPCAO: 'Balcão: reservas, check-in/out, conta do hóspede e caixa do turno.',
    GOVERNANCA: 'Governanta: supervisiona a limpeza, bloqueia quartos e movimenta o estoque.',
    LIMPEZA: 'Camareira: vê os quartos a limpar, marca o andamento e lança o frigobar (pelo celular).',
    MANUTENCAO: 'Manutenção: bloqueia e libera quartos para conserto, pelo mapa do dia.',
    FINANCEIRO: 'Contas, caixas de todos, empresas e relatórios financeiros.',
    GERENCIA: 'Tudo da operação, tarifas e relatórios — exceto usuários e configuração do sistema.',
    ADMIN: 'Acesso total, inclusive criar usuários e configurar o sistema.',
  };
  var COR = { ADMIN: '#7c5cff', GERENCIA: '#2f6bff', RECEPCAO: '#0ea5a4', FINANCEIRO: '#d4a017', GOVERNANCA: '#e0569b', LIMPEZA: '#16a34a', MANUTENCAO: '#ea7a1a' };
  var iniciais = function (n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
  var primeiroNome = function (n) { return String(n || '').trim().split(/\s+/)[0]; };
  /** Para onde vai quem entra: a camareira (governança sem reservas) cai direto na Governança. */
  function inicioDe(permissoes) {
    var tem = function (p) { return (permissoes || []).indexOf(p) >= 0; };
    return tem('quarto.governanca') && !tem('reserva.ver') ? BASE + '/governanca' : BASE + '/';
  }

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'texto') e.textContent = attrs[k];
      else if (k === 'classe') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return e;
  }
  var guardar = {
    ler: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    gravar: function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} },
  };
  var ICONE = {
    pessoas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/></svg>',
    recolher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15.5 10l-2 2 2 2"/></svg>',
    expandir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M13.5 10l2 2-2 2"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  // ---------- sessão atual ----------
  var sessao = null;
  function permissoesDaSessao() { return sessao && sessao.permissoes ? Object.keys(sessao.permissoes) : []; }
  function carregarSessao() {
    return fetch(BASE + '/api/v1/auth/sessao', { credentials: 'same-origin', headers: { accept: 'application/json', 'x-hotel-segundo-plano': '1' } })
      .then(function (r) { return r.json(); })
      .then(function (s) { sessao = s && s.autenticado ? s : null; aplicarPerfil(); desenharAviso(); })
      .catch(function () {});
  }
  /** Rack só com reservas; a camareira abre na Governança. */
  function aplicarPerfil() {
    var perms = permissoesDaSessao();
    document.documentElement.toggleAttribute('data-demo-sem-rack', sessao && perms.indexOf('reserva.ver') < 0);
  }
  var inicial = location.pathname.replace(/\/+$/, '');
  function irParaInicioDoPerfil() {
    if (!sessao) return;
    var destino = inicioDe(permissoesDaSessao());
    if (destino === BASE + '/') return;
    var agora = location.pathname.replace(/\/+$/, '');
    if (agora === BASE || agora === BASE + '/mapa') {
      history.replaceState(null, '', destino);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  // ---------- aviso no canto da tela ----------
  var aviso = el('div', { id: 'demo-aviso', role: 'region', 'aria-label': 'Site de demonstração' });
  function desenharAviso() {
    aviso.textContent = '';
    var u = sessao && sessao.usuario;
    aviso.appendChild(el('i', { classe: 'demo-ponto', 'aria-hidden': 'true' }));
    aviso.appendChild(el('span', { classe: 'demo-rotulo', texto: 'Demonstração' }));
    if (u) {
      var trocar = el('button', { type: 'button', classe: 'demo-quem', title: 'Trocar funcionário', onclick: abrirPainel }, [
        el('span', { classe: 'demo-av', style: '--cor:' + (COR[u.perfil.codigo] || '#64748b'), 'aria-hidden': 'true', texto: iniciais(u.nome) }),
        el('span', { classe: 'demo-quem-txt' }, [el('b', { texto: primeiroNome(u.nome) }), el('small', { texto: u.perfil.nome })]),
        el('span', { classe: 'demo-trocar', texto: 'Trocar' }),
      ]);
      trocar.setAttribute('aria-label', 'Você está como ' + u.nome + ', ' + u.perfil.nome + '. Trocar funcionário');
      aviso.appendChild(trocar);
    }
    aviso.appendChild(el('button', { type: 'button', classe: 'demo-recomecar', onclick: recomecar, texto: 'Recomeçar do zero' }));
    var min = el('button', { type: 'button', classe: 'demo-min', 'aria-label': 'Minimizar aviso', title: 'Minimizar', texto: '–', onclick: function () {
      aviso.classList.toggle('min');
      guardar.gravar('demo-aviso-min', aviso.classList.contains('min') ? '1' : null);
    } });
    aviso.appendChild(min);
    if (guardar.ler('demo-aviso-min')) aviso.classList.add('min');
  }
  function recomecar() {
    if (!confirm('Voltar a pousada para o original? Tudo o que você fez nesta demonstração será apagado.')) return;
    fetch(BASE + '/__demo/recomecar', { method: 'POST', credentials: 'same-origin' }).then(function () { location.href = BASE + '/'; });
  }

  // ---------- painel "Funcionários do hotel" ----------
  var painel = null;
  function abrirPainel() {
    if (!painel) montarPainel();
    painel.querySelector('.demo-p-corpo').innerHTML = '<p class="demo-carregando">Carregando os funcionários…</p>';
    if (typeof painel.showModal === 'function') painel.showModal(); else painel.setAttribute('open', '');
    document.documentElement.classList.add('demo-painel-aberto');
    fetch(BASE + '/__demo/funcionarios', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(desenharFuncionarios)
      .catch(function () { painel.querySelector('.demo-p-corpo').innerHTML = '<p class="demo-carregando">Não deu para carregar agora. Tente de novo em instantes.</p>'; });
  }
  function fecharPainel() { if (painel && painel.open) painel.close(); }
  function montarPainel() {
    painel = el('dialog', { id: 'demo-painel', 'aria-labelledby': 'demo-p-titulo' });
    var abas = el('div', { classe: 'demo-abas', role: 'tablist', 'aria-label': 'Como ver' }, [
      el('button', { type: 'button', role: 'tab', id: 'demo-aba-cartoes', 'aria-selected': 'true', 'aria-controls': 'demo-vista-cartoes', texto: 'Funcionários', onclick: function () { trocarAba('cartoes'); } }),
      el('button', { type: 'button', role: 'tab', id: 'demo-aba-matriz', 'aria-selected': 'false', 'aria-controls': 'demo-vista-matriz', texto: 'Comparar menus', onclick: function () { trocarAba('matriz'); } }),
    ]);
    painel.appendChild(el('div', { classe: 'demo-p-topo' }, [
      el('div', null, [
        el('h2', { id: 'demo-p-titulo', texto: 'Funcionários do hotel' }),
        el('p', { texto: 'Escolha com quem entrar. Cada funcionário vê só os menus da sua função. Sem senha: é só tocar.' }),
      ]),
      (function () { var b = el('button', { type: 'button', classe: 'demo-fechar', 'aria-label': 'Fechar', onclick: fecharPainel }); b.innerHTML = ICONE.fechar; return b; })(),
    ]));
    painel.appendChild(abas);
    painel.appendChild(el('div', { classe: 'demo-p-corpo' }));
    painel.addEventListener('click', function (e) { if (e.target === painel) fecharPainel(); });
    painel.addEventListener('close', function () { document.documentElement.classList.remove('demo-painel-aberto'); });
    document.body.appendChild(painel);
  }
  var abaAtual = 'cartoes';
  function trocarAba(qual) {
    abaAtual = qual;
    ['cartoes', 'matriz'].forEach(function (a) {
      var aba = document.getElementById('demo-aba-' + a), vista = document.getElementById('demo-vista-' + a);
      if (aba) aba.setAttribute('aria-selected', String(a === qual));
      if (vista) vista.hidden = a !== qual;
    });
  }
  function desenharFuncionarios(dados) {
    var lista = dados.funcionarios.slice().sort(function (a, b) {
      return ORDEM_PERFIS.indexOf(a.perfil.codigo) - ORDEM_PERFIS.indexOf(b.perfil.codigo);
    });
    var corpo = painel.querySelector('.demo-p-corpo');
    corpo.textContent = '';
    // cartões
    var grade = el('div', { classe: 'demo-cartoes', id: 'demo-vista-cartoes', role: 'tabpanel', 'aria-labelledby': 'demo-aba-cartoes' });
    lista.forEach(function (f) {
      var menus = menusVisiveis(f.permissoes);
      var atual = f.login === dados.atual;
      var cartao = el('article', { classe: 'demo-cartao' + (atual ? ' atual' : ''), style: '--cor:' + (COR[f.perfil.codigo] || '#64748b') }, [
        el('div', { classe: 'demo-c-topo' }, [
          el('span', { classe: 'demo-av grande', 'aria-hidden': 'true', texto: iniciais(f.nome) }),
          el('div', null, [el('h3', { texto: f.nome }), el('span', { classe: 'demo-perfil', texto: f.perfil.nome })]),
          atual ? el('span', { classe: 'demo-aqui', texto: 'Você está aqui' }) : null,
        ]),
        el('p', { classe: 'demo-resumo', texto: DESCRICAO[f.perfil.codigo] || '' }),
        el('div', { classe: 'demo-c-menus' }, [
          el('span', { classe: 'demo-c-rot', texto: 'Vê ' + menus.length + (menus.length === 1 ? ' menu' : ' menus') }),
          el('ul', { 'aria-label': 'Menus que ' + primeiroNome(f.nome) + ' vê' }, menus.map(function (m) { return el('li', { texto: m.rotulo }); })),
        ]),
        atual
          ? el('button', { type: 'button', classe: 'demo-entrar', disabled: 'disabled', texto: 'Conta atual' })
          : el('button', { type: 'button', classe: 'demo-entrar', texto: 'Entrar como ' + primeiroNome(f.nome), onclick: function (e) { entrarComo(f, e.currentTarget); } }),
      ]);
      grade.appendChild(cartao);
    });
    // matriz menus × funcionários (✓ / —, sempre com texto)
    var tabela = el('table', { classe: 'demo-matriz' });
    var cab = el('tr', null, [el('th', { scope: 'col', texto: 'Menu' })].concat(lista.map(function (f) {
      return el('th', { scope: 'col', classe: f.login === dados.atual ? 'atual' : '' }, [el('b', { texto: primeiroNome(f.nome) }), el('small', { texto: f.perfil.nome })]);
    })));
    tabela.appendChild(el('thead', null, [cab]));
    var tbody = el('tbody');
    MENUS.forEach(function (m) {
      tbody.appendChild(el('tr', null, [el('th', { scope: 'row', texto: m.rotulo })].concat(lista.map(function (f) {
        var ve = menusVisiveis(f.permissoes).indexOf(m) >= 0;
        return el('td', { classe: (ve ? 've' : 'nao') + (f.login === dados.atual ? ' atual' : '') }, [
          el('span', { 'aria-hidden': 'true', texto: ve ? '✓' : '—' }),
          el('span', { classe: 'demo-sr', texto: ve ? ' vê' : ' não vê' }),
        ]);
      }))));
    });
    tabela.appendChild(tbody);
    var vistaMatriz = el('div', { classe: 'demo-matriz-caixa', id: 'demo-vista-matriz', role: 'tabpanel', 'aria-labelledby': 'demo-aba-matriz', tabindex: '0' }, [
      el('p', { classe: 'demo-legenda', texto: '✓ vê o menu · — não vê. Início aparece para todos.' }),
      tabela,
    ]);
    corpo.appendChild(grade);
    corpo.appendChild(vistaMatriz);
    trocarAba(abaAtual);
  }
  function entrarComo(f, botao) {
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    fetch(BASE + '/__demo/entrar', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: f.login }) })
      .then(function (r) { if (!r.ok) throw new Error(); location.href = inicioDe(f.permissoes); })
      .catch(function () { botao.disabled = false; botao.textContent = 'Tentar de novo'; });
  }

  // ---------- botão no cabeçalho e item no menu do usuário ----------
  function botaoCabecalho() {
    var usuario = document.querySelector('header button[aria-label="Menu do usuário"]');
    if (!usuario || document.getElementById('demo-trocar-cab')) return;
    var b = el('button', { type: 'button', id: 'demo-trocar-cab', 'aria-label': 'Trocar funcionário', title: 'Trocar funcionário', onclick: abrirPainel });
    b.innerHTML = ICONE.pessoas + '<span>Trocar funcionário</span>';
    usuario.parentNode.insertBefore(b, usuario);
  }
  function itemMenuUsuario(menu) {
    if (menu.querySelector('.demo-item-trocar')) return;
    var rotulo = menu.querySelector('.mantine-Menu-label');
    if (!rotulo || !sessao || rotulo.textContent.indexOf(sessao.usuario.nome) < 0) return;
    var item = el('button', { type: 'button', role: 'menuitem', classe: 'demo-item-trocar', tabindex: '-1', onclick: function () { document.body.click(); abrirPainel(); } });
    item.innerHTML = ICONE.pessoas + '<span>Trocar funcionário</span>';
    rotulo.insertAdjacentElement('afterend', item);
  }

  // ---------- menu lateral recolhível (computador) ----------
  var CHAVE_MENU = 'estadia-demo-menu-recolhido';
  var dica = el('div', { id: 'demo-dica-menu', role: 'tooltip', hidden: 'hidden' });
  function recolhido() { return document.documentElement.getAttribute('data-demo-menu') === 'recolhido'; }
  function definirRecolhido(sim) {
    if (sim) document.documentElement.setAttribute('data-demo-menu', 'recolhido');
    else document.documentElement.removeAttribute('data-demo-menu');
    guardar.gravar(CHAVE_MENU, sim ? '1' : null);
    var b = document.getElementById('demo-recolher');
    if (b) {
      b.innerHTML = sim ? ICONE.expandir : ICONE.recolher;
      b.setAttribute('aria-label', sim ? 'Expandir menu ( [ )' : 'Recolher menu ( [ )');
      b.setAttribute('aria-expanded', String(!sim));
      b.title = sim ? 'Expandir menu ( [ )' : 'Recolher menu ( [ )';
    }
    dica.hidden = true;
  }
  function prepararMenu() {
    var nav = document.querySelector('nav.mantine-AppShell-navbar');
    if (!nav) return;
    // rótulo acessível em cada link (quando recolhido, só o ícone aparece)
    nav.querySelectorAll('a.mantine-NavLink-root').forEach(function (a) {
      var t = a.querySelector('.mantine-NavLink-label');
      if (t && !a.getAttribute('aria-label')) a.setAttribute('aria-label', t.textContent.trim());
    });
    if (document.getElementById('demo-recolher')) return;
    var topo = nav.querySelector('.mantine-AppShell-section.mantine-visible-from-sm');
    if (!topo) return;
    topo.classList.add('demo-nav-topo');
    var b = el('button', { type: 'button', id: 'demo-recolher', 'aria-controls': 'demo-nav', onclick: function () { definirRecolhido(!recolhido()); } });
    nav.id = nav.id || 'demo-nav';
    topo.appendChild(b);
    definirRecolhido(recolhido());
  }
  function mostrarDica(alvo) {
    if (!recolhido() || !alvo) return;
    var texto = alvo.getAttribute('aria-label') || alvo.textContent.trim();
    if (!texto) return;
    var r = alvo.getBoundingClientRect();
    dica.textContent = texto;
    dica.style.top = r.top + r.height / 2 + 'px';
    dica.style.left = r.right + 10 + 'px';
    dica.hidden = false;
  }
  document.addEventListener('mouseover', function (e) {
    var a = e.target.closest && e.target.closest('nav.mantine-AppShell-navbar a, nav.mantine-AppShell-navbar button, nav.mantine-AppShell-navbar [data-demo-dica]');
    if (a) mostrarDica(a); else dica.hidden = true;
  });
  document.addEventListener('focusin', function (e) {
    var a = e.target.closest && e.target.closest('nav.mantine-AppShell-navbar a, nav.mantine-AppShell-navbar button');
    if (a) mostrarDica(a); else dica.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dica.hidden = true;
    if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return;
    var alvo = e.target;
    if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
    if (!window.matchMedia('(min-width: 48em)').matches) return;
    e.preventDefault();
    definirRecolhido(!recolhido());
  });
  if (guardar.ler(CHAVE_MENU)) document.documentElement.setAttribute('data-demo-menu', 'recolhido');

  // ---------- início ----------
  function aoMudarDom() {
    botaoCabecalho();
    prepararMenu();
    document.querySelectorAll('[role="menu"]').forEach(itemMenuUsuario);
  }
  function iniciar() {
    document.body.appendChild(aviso);
    document.body.appendChild(dica);
    if (reduzMov) document.documentElement.classList.add('demo-sem-animacao');
    desenharAviso();
    var pendente = false;
    new MutationObserver(function () {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(function () { pendente = false; aoMudarDom(); });
    }).observe(document.body, { childList: true, subtree: true });
    carregarSessao().then(function () {
      aoMudarDom();
      // ao abrir na raiz, a camareira vai para a Governança (o app mandaria para o mapa)
      if (inicial === BASE || inicial === BASE + '') {
        irParaInicioDoPerfil();
        setTimeout(irParaInicioDoPerfil, 600);
        setTimeout(irParaInicioDoPerfil, 1500);
      }
    });
    // a sessão muda (trocou de conta em outra aba, sessão renovada): atualiza o aviso de vez em quando
    setInterval(carregarSessao, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
