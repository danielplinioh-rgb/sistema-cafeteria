// API de DESENVOLVIMENTO (sem banco, sem Java): reproduz o contrato e as regras principais do back-end real
// para que o front-end possa ser desenvolvido e demonstrado sozinho.
//   npm run mock            -> http://localhost:8080   (use junto com "npm run dev:cliente" / "dev:painel")
// Dados em memória; reiniciar o processo volta ao estado inicial. NÃO usar em produção.
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function criarMock() {
  const categorias = [{ idCategoria: 1, nome: 'Bebidas Quentes' }, { idCategoria: 2, nome: 'Bebidas Geladas' }, { idCategoria: 3, nome: 'Doces' }];
  const observacoes = [{ id: 1, descricao: 'Sem lactose' }, { id: 2, descricao: 'Sem açúcar' }, { id: 3, descricao: 'Extra quente' }, { id: 4, descricao: 'Com pouco gelo' }];
  const P = (idProduto, idCategoria, nome, descricao, preco, imagem, obs, disponivel = true) =>
    ({ idProduto, idCategoria, nome, descricao, preco, imagem, idObservacoes: obs, disponivel, ativo: true });
  const produtos = [
    P(1, 1, 'Cappuccino', 'Café com leite vaporizado e espuma cremosa', 8.5, 'cappuccino.svg', [1, 2, 3]),
    P(2, 1, 'Café Expresso', 'Café curto, intenso e encorpado', 5, 'expresso.svg', [1, 2, 3]),
    P(3, 1, 'Chá Preto', 'Chá preto em infusão', 6, 'cha-preto.svg', [1, 2, 3], false),
    P(4, 1, 'Latte', 'Café suave com bastante leite vaporizado', 9.5, 'latte.svg', [1, 2, 3]),
    P(5, 1, 'Mocha', 'Café, chocolate e leite vaporizado', 10.5, 'mocha.svg', [1, 2, 3]),
    P(6, 1, 'Chocolate Quente', 'Chocolate cremoso servido bem quente', 11, 'chocolate-quente.svg', [1, 2, 3]),
    P(7, 2, 'Café Gelado', 'Café expresso com gelo', 9, 'cafe-gelado.svg', [1, 2, 4]),
    P(8, 2, 'Cold Brew', 'Café extraído a frio, refrescante', 12, 'cold-brew.svg', [1, 2, 4]),
    P(9, 3, 'Alfajor', 'Alfajor recheado com doce de leite', 12, 'alfajor.svg', []),
    P(10, 3, 'Alfajor de Chocolate', 'Alfajor coberto com chocolate meio amargo', 13.5, 'alfajor-chocolate.svg', []),
    P(11, 3, 'Brownie', 'Brownie macio de chocolate', 9, 'brownie.svg', []),
  ];
  const pedidos = [];
  let seqPedido = 0, seqItem = 0, seqProduto = 100;
  const sessoes = new Map();
  const idem = new Map();
  const falhas = new Map();
  const historicoEncerrados = [];

  const r2 = (n) => Math.round(n * 100) / 100;
  const obsTexto = (ids) => ids.map((i) => observacoes.find((o) => o.id === i)?.descricao).filter(Boolean).sort();

  function novoPedido({ local, itens, status = 'AGUARDANDO_PAGAMENTO', minutosAtras = 0 }) {
    const codigo = 'PED-' + String(++seqPedido).padStart(4, '0');
    const p = { codigo, token: randomUUID(), status, local, versao: 1, dataHora: new Date(Date.now() - minutosAtras * 60000).toISOString(),
      dataPagamento: status === 'AGUARDANDO_PAGAMENTO' ? null : new Date().toISOString(), justificativaCancelamento: null, observacaoInterna: null, itens: [] };
    for (const i of itens) addItem(p, i);
    pedidos.push(p);
    return p;
  }
  function addItem(p, i) {
    const pr = produtos.find((x) => x.idProduto === i.idProduto);
    p.itens.push({ idItem: ++seqItem, idProduto: pr.idProduto, produto: pr.nome, imagem: pr.imagem, quantidade: i.quantidade, precoUnitario: pr.preco, idObservacoes: [...i.observacoes], observacoes: obsTexto(i.observacoes) });
    p.versao++;
  }
  const total = (p) => r2(p.itens.reduce((t, i) => t + i.quantidade * i.precoUnitario, 0));
  const visao = (p) => ({ codigo: p.codigo, status: p.status, pagamentoPendente: p.status === 'AGUARDANDO_PAGAMENTO', local: p.local, valorTotal: total(p), versao: p.versao, dataHora: p.dataHora, dataPagamento: p.dataPagamento, justificativaCancelamento: p.justificativaCancelamento, observacaoInterna: p.observacaoInterna, itens: p.itens });
  const visaoCliente = (p) => { const { codigo, status, local, valorTotal, versao, dataHora, itens } = visao(p); return { codigo, status, local, valorTotal, versao, dataHora, itens }; };

  // dados iniciais (espelham banco/seed_dev.sql + alguns pedidos para demonstração)
  novoPedido({ local: 'Mesa 5', itens: [{ idProduto: 1, quantidade: 2, observacoes: [2] }, { idProduto: 2, quantidade: 1, observacoes: [] }], minutosAtras: 3 });
  novoPedido({ local: 'Retirada no Balcão', itens: [{ idProduto: 8, quantidade: 1, observacoes: [4] }, { idProduto: 11, quantidade: 2, observacoes: [] }], status: 'EM_PREPARO', minutosAtras: 7 });
  novoPedido({ local: 'Mesa 12', itens: [{ idProduto: 4, quantidade: 1, observacoes: [1] }], status: 'PRONTO', minutosAtras: 11 });
  novoPedido({ local: 'Mesa 2', itens: [{ idProduto: 9, quantidade: 2, observacoes: [] }, { idProduto: 6, quantidade: 1, observacoes: [3] }], status: 'ENTREGUE', minutosAtras: 18 });
  const finalizado = novoPedido({ local: 'Mesa 8', itens: [{ idProduto: 5, quantidade: 1, observacoes: [] }], status: 'FINALIZADO', minutosAtras: 40 });
  const cancelado = novoPedido({ local: 'Mesa 3', itens: [{ idProduto: 7, quantidade: 1, observacoes: [] }], status: 'CANCELADO', minutosAtras: 55 });
  cancelado.justificativaCancelamento = 'Cliente desistiu do pedido';
  historicoEncerrados.push(finalizado, cancelado);

  const erro = (res, status, codigo, mensagem, detalhes) => json(res, status, { codigo, mensagem, ...(detalhes ? { detalhes } : {}) });
  function json(res, status, corpo, extra = {}) {
    const b = JSON.stringify(corpo ?? {});
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(b);
  }
  const lerCorpo = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; if (d.length > 65536) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { ok(null); } }); });
  const cookieSessao = (req) => /(?:^|; )sessao_painel=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];

  function validarEntrada(e) {
    let local;
    if (e.tipo === 'BALCAO') local = 'Retirada no Balcão';
    else if (e.tipo === 'MESA' && Number.isInteger(e.mesa) && e.mesa >= 1 && e.mesa <= 9999) local = `Mesa ${e.mesa}`;
    else return { falha: [422, 'MESA_INVALIDA', 'Informe o número da mesa ou escolha a retirada no balcão'] };
    if (!Array.isArray(e.itens) || e.itens.length < 1) return { falha: [422, 'PEDIDO_SEM_ITENS', 'O pedido deve ter ao menos um item'] };
    if (e.itens.length > 30) return { falha: [422, 'ITENS_DEMAIS', 'O pedido pode ter no máximo 30 itens'] };
    for (const i of e.itens) {
      if (!Number.isInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 20) return { falha: [422, 'QUANTIDADE_INVALIDA', 'A quantidade de cada item deve estar entre 1 e 20'] };
      const pr = produtos.find((p) => p.idProduto === i.idProduto && p.ativo);
      if (!pr) return { falha: [422, 'PRODUTO_INVALIDO', 'Produto não encontrado'] };
      if (!(i.observacoes ?? []).every((o) => pr.idObservacoes.includes(o))) return { falha: [422, 'OBSERVACAO_INVALIDA', 'Uma das observações escolhidas não está disponível para este produto'] };
    }
    return { local };
  }

  return async function tratar(req, res) {
    const url = new URL(req.url, 'http://x');
    const rota = url.pathname;
    const m = req.method;
    if (!rota.startsWith('/api/')) return false;

    // ---------- público ----------
    if (m === 'GET' && rota === '/api/saude') return json(res, 200, { status: 'ok' }), true;
    if (m === 'GET' && rota === '/api/cardapio') {
      return json(res, 200, categorias.map((c) => ({ idCategoria: c.idCategoria, nome: c.nome,
        produtos: produtos.filter((p) => p.ativo && p.idCategoria === c.idCategoria).map((p) => ({ idProduto: p.idProduto, nome: p.nome, descricao: p.descricao, preco: p.preco, disponivel: p.disponivel, imagem: p.imagem,
          observacoes: p.idObservacoes.map((id) => observacoes.find((o) => o.id === id)) })) }))), true;
    }
    if (m === 'POST' && rota === '/api/pedidos') {
      const corpo = await lerCorpo(req); if (!corpo) return erro(res, 400, 'REQUISICAO_INVALIDA', 'Requisição inválida'), true;
      const chave = req.headers['idempotency-key'];
      if (!chave || !/^[A-Za-z0-9_-]{16,64}$/.test(chave)) return erro(res, 400, 'CHAVE_INVALIDA', 'Requisição inválida'), true;
      if (idem.has(chave)) return json(res, 200, idem.get(chave)), true;
      const v = validarEntrada(corpo); if (v.falha) return erro(res, ...v.falha), true;
      for (const i of corpo.itens) { const pr = produtos.find((p) => p.idProduto === i.idProduto); if (!pr.disponivel) return erro(res, 409, 'PRODUTO_INDISPONIVEL', `O produto "${pr.nome}" está indisponível no momento`), true; }
      const p = novoPedido({ local: v.local, itens: corpo.itens.map((i) => ({ ...i, observacoes: i.observacoes ?? [] })) });
      const resp = { token: p.token, pedido: visaoCliente(p) };
      idem.set(chave, resp);
      return json(res, 200, resp), true;
    }
    let mm = /^\/api\/pedidos\/(PED-\d{4,8})$/.exec(rota);
    if (mm) {
      const p = pedidos.find((x) => x.codigo === mm[1] && x.token === req.headers['x-token-pedido']);
      if (!p) return erro(res, 404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado'), true;
      if (m === 'GET') return json(res, 200, visaoCliente(p)), true;
      if (m === 'PUT') {
        const corpo = await lerCorpo(req); if (!corpo) return erro(res, 400, 'REQUISICAO_INVALIDA', 'Requisição inválida'), true;
        if (p.status !== 'AGUARDANDO_PAGAMENTO') return erro(res, 409, 'ALTERACAO_APOS_PAGAMENTO', 'Alterações não são permitidas após a confirmação do pagamento'), true;
        const v = validarEntrada({ ...corpo, tipo: 'BALCAO' }); if (v.falha) return erro(res, ...v.falha), true;
        const manter = new Set();
        for (const i of corpo.itens.filter((x) => x.idItem != null)) {
          const it = p.itens.find((x) => x.idItem === i.idItem);
          if (!it) return erro(res, 422, 'ITEM_INVALIDO', 'Um dos itens enviados não pertence a este pedido'), true;
          manter.add(it.idItem); it.quantidade = i.quantidade; it.idObservacoes = [...(i.observacoes ?? [])]; it.observacoes = obsTexto(it.idObservacoes);
        }
        p.itens = p.itens.filter((x) => manter.has(x.idItem));
        for (const i of corpo.itens.filter((x) => x.idItem == null)) {
          const pr = produtos.find((x) => x.idProduto === i.idProduto);
          if (!pr.disponivel) return erro(res, 409, 'PRODUTO_INDISPONIVEL', `O produto "${pr.nome}" está indisponível no momento`), true;
          addItem(p, { ...i, observacoes: i.observacoes ?? [] });
        }
        p.versao++;
        return json(res, 200, visaoCliente(p)), true;
      }
    }

    // ---------- painel ----------
    if (rota.startsWith('/api/painel/')) {
      if (m !== 'GET' && req.headers['x-requested-with'] !== 'cafeteria-painel') return erro(res, 403, 'VERIFICACAO_REQUISICAO', 'Requisição não autorizada'), true;
      if (m === 'POST' && rota === '/api/painel/login') {
        const c = await lerCorpo(req) ?? {}; const ip = req.socket.remoteAddress; const k = `${String(c.usuario).toLowerCase()}|${ip}`; const f = falhas.get(k) ?? { n: 0, ate: 0 };
        if (f.ate > Date.now()) return erro(res, 429, 'LOGIN_BLOQUEADO', 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.'), true;
        if (c.usuario === 'ana.souza' && c.senha === 'trocar-senha-dev') {
          falhas.delete(k); const t = randomBytes(32).toString('base64url'); sessoes.set(t, { nome: 'Ana Souza', usuario: 'ana.souza' });
          return json(res, 200, { nome: 'Ana Souza', usuario: 'ana.souza' }, { 'Set-Cookie': `sessao_painel=${t}; Path=/api/painel; HttpOnly; SameSite=Strict` }), true;
        }
        f.n++; if (f.n >= 5) { f.ate = Date.now() + 300000; f.n = 0; } falhas.set(k, f);
        return erro(res, 401, 'CREDENCIAIS_INVALIDAS', 'Usuário ou senha inválidos.'), true;
      }
      const s = sessoes.get(cookieSessao(req));
      if (!s) return erro(res, 401, 'NAO_AUTENTICADO', 'Sessão expirada ou inexistente. Faça login novamente.'), true;
      if (m === 'GET' && rota === '/api/painel/sessao') return json(res, 200, s), true;
      if (m === 'POST' && rota === '/api/painel/logout') { sessoes.delete(cookieSessao(req)); return json(res, 200, { status: 'ok' }, { 'Set-Cookie': 'sessao_painel=; Path=/api/painel; Max-Age=0; HttpOnly; SameSite=Strict' }), true; }
      if (m === 'GET' && rota === '/api/painel/pedidos') return json(res, 200, pedidos.filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status)).map(visao)), true;
      if (m === 'GET' && rota === '/api/painel/historico') return json(res, 200, pedidos.filter((p) => ['FINALIZADO', 'CANCELADO'].includes(p.status)).reverse().map((p) => ({ codigo: p.codigo, dataHora: p.dataHora, aviso: p.status, local: p.local, valorTotal: total(p), dataPagamento: p.dataPagamento, justificativaCancelamento: p.justificativaCancelamento, observacaoInterna: p.observacaoInterna, dataEncerramento: p.dataHora, encerradoPor: 'Ana Souza' }))), true;
      if (m === 'GET' && rota === '/api/painel/produtos') return json(res, 200, produtos.filter((p) => p.ativo).map((p) => ({ ...p, categoria: categorias.find((c) => c.idCategoria === p.idCategoria).nome }))), true;
      if (m === 'GET' && rota === '/api/painel/categorias') return json(res, 200, categorias), true;
      if (m === 'GET' && rota === '/api/painel/observacoes') return json(res, 200, observacoes), true;
      if (m === 'POST' && rota === '/api/painel/produtos') { const c = await lerCorpo(req); const p = P(++seqProduto, c.idCategoria, c.nome, c.descricao, c.preco, c.imagem || null, c.observacoes ?? []); produtos.push(p); return json(res, 200, { idProduto: p.idProduto }), true; }
      mm = /^\/api\/painel\/produtos\/(\d+)(\/pendentes|\/disponibilidade)?$/.exec(rota);
      if (mm) {
        const pr = produtos.find((x) => x.idProduto === Number(mm[1]) && x.ativo); if (!pr) return erro(res, 404, 'PRODUTO_NAO_ENCONTRADO', 'Produto não encontrado'), true;
        if (m === 'GET' && mm[2] === '/pendentes') return json(res, 200, { pedidosPendentes: pedidos.filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status) && p.itens.some((i) => i.idProduto === pr.idProduto)).length }), true;
        if (m === 'PUT' && mm[2] === '/disponibilidade') { pr.disponivel = !!(await lerCorpo(req)).disponivel; return json(res, 200, { status: 'ok' }), true; }
        if (m === 'PUT') { const c = await lerCorpo(req); Object.assign(pr, { nome: c.nome, descricao: c.descricao, preco: c.preco, imagem: c.imagem || null, idCategoria: c.idCategoria, idObservacoes: c.observacoes ?? [] }); return json(res, 200, { status: 'ok' }), true; }
        if (m === 'DELETE') { pr.ativo = false; pr.disponivel = false; return json(res, 200, { status: 'ok' }), true; }
      }
      mm = /^\/api\/painel\/pedidos\/(PED-\d{4,8})(?:\/(pagamento|status|cancelamento|finalizacao|observacao))?$/.exec(rota);
      if (mm) {
        const p = pedidos.find((x) => x.codigo === mm[1]); if (!p) return erro(res, 404, 'PEDIDO_NAO_ENCONTRADO', 'Pedido não encontrado'), true;
        if (m === 'GET' && !mm[2]) return json(res, 200, visao(p)), true;
        const c = m === 'GET' ? {} : await lerCorpo(req) ?? {};
        if (mm[2] === 'pagamento') {
          if (p.status === 'CANCELADO') return erro(res, 409, 'PEDIDO_CANCELADO', 'Este pedido foi cancelado'), true;
          if (p.status !== 'AGUARDANDO_PAGAMENTO') return erro(res, 409, 'PAGAMENTO_JA_CONFIRMADO', 'O pagamento deste pedido já foi confirmado', visao(p)), true;
          if (c.versao !== p.versao) return erro(res, 409, 'PEDIDO_ALTERADO', 'O pedido foi alterado pelo cliente. Confira os itens e o novo valor total antes de confirmar o pagamento.', visao(p)), true;
          p.status = 'EM_PREPARO'; p.dataPagamento = new Date().toISOString(); return json(res, 200, visao(p)), true;
        }
        if (mm[2] === 'status') {
          const prox = { PRONTO: 'EM_PREPARO', ENTREGUE: 'PRONTO' }[c.para];
          if (!prox) return erro(res, 422, 'STATUS_INVALIDO', 'Operação não permitida: o status atual do pedido não permite esta ação'), true;
          if (p.status === 'AGUARDANDO_PAGAMENTO') return erro(res, 409, 'PAGAMENTO_PENDENTE', 'Não é possível alterar o status de um pedido com pagamento pendente'), true;
          if (p.status !== prox) return erro(res, 409, 'TRANSICAO_NAO_PERMITIDA', 'Operação não permitida: o status atual do pedido não permite esta ação'), true;
          p.status = c.para; return json(res, 200, visao(p)), true;
        }
        if (mm[2] === 'cancelamento') {
          if (!['AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO'].includes(p.status)) return erro(res, 409, 'CANCELAMENTO_NAO_PERMITIDO', 'Operação não permitida: o pedido não pode ser cancelado no status atual'), true;
          const j = String(c.texto ?? '').trim();
          if (p.status !== 'AGUARDANDO_PAGAMENTO' && !j) return erro(res, 422, 'JUSTIFICATIVA_OBRIGATORIA', 'Informe uma justificativa para essa ação'), true;
          p.status = 'CANCELADO'; p.justificativaCancelamento = j || null; return json(res, 200, visao(p)), true;
        }
        if (mm[2] === 'finalizacao') {
          if (p.status === 'AGUARDANDO_PAGAMENTO') return erro(res, 409, 'FINALIZAR_PAGAMENTO_PENDENTE', 'Não é possível finalizar um pedido com pagamento pendente'), true;
          if (p.status !== 'ENTREGUE') return erro(res, 409, 'FINALIZAR_STATUS_INVALIDO', 'Só é possível finalizar pedidos já entregues'), true;
          p.status = 'FINALIZADO'; p.observacaoInterna = String(c.texto ?? '').trim() || null; return json(res, 200, visao(p)), true;
        }
        if (mm[2] === 'observacao') {
          if (!['FINALIZADO', 'CANCELADO'].includes(p.status)) return erro(res, 409, 'OBSERVACAO_STATUS', 'A observação interna só pode ser registrada em pedidos finalizados ou cancelados'), true;
          p.observacaoInterna = String(c.texto ?? '').trim(); return json(res, 200, visao(p)), true;
        }
      }
    }
    return erro(res, 404, 'NAO_ENCONTRADO', 'Recurso não encontrado'), true;
  };
}

// Execução direta: node dev/mock-api.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tratar = criarMock();
  const porta = Number(process.env.PORT ?? 8080);
  createServer((req, res) => void tratar(req, res)).listen(porta, () => console.log(`API de desenvolvimento em http://localhost:${porta}  (login: ana.souza / trocar-senha-dev)`));
}
