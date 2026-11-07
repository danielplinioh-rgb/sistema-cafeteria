# Personalização do layout (sem programar)

Toda a identidade visual vem de **tokens** (variáveis CSS) definidos em
`frontend/src/compartilhado/estilos/tokens.css` e **sobrescritos em tempo de execução** por
`frontend/publico/config/aparencia.json`. Salve o arquivo e recarregue a página: os **dois módulos** mudam juntos.
Com Docker, a pasta `frontend/publico` é um volume: **não é preciso recompilar**.

| O que mudar | Onde |
|---|---|
| Nome, slogan, logo, banner, imagem padrão | `aparencia.json` → `marca` (arquivos em `publico/imagens`) |
| Cores, raios de borda, fontes | `aparencia.json` → `variaveis` (`--cor-primaria`, `--raio-medio`, `--fonte-titulo`…) |
| Cardápio em grade ou lista | `cliente.layoutProdutos`: `"grade"` ou `"lista"` |
| Mostrar/ocultar banner e descrições; altura do banner | `cliente.mostrarBanner`, `cliente.mostrarDescricao`, `cliente.alturaBanner` |
| Frequência de atualização do status | `cliente.intervaloAtualizacaoSeg`, `painel.intervaloAtualizacaoSeg` |
| Largura do menu do painel; tempo de inatividade | `painel.larguraMenu`, `painel.minutosInatividade` |
| Endereço do QR Code | `painel.urlCliente` (vazio = endereço atual do site) |
| Tema escuro | copie `aparencia.escuro.exemplo.json` sobre `aparencia.json` |
| Foto de um produto | coloque o arquivo em `publico/imagens` e informe o nome no cadastro do produto (tela *Produtos*) |
| Textos da interface | `frontend/src/compartilhado/textos.ts` |
| Posição/estrutura dos componentes | `frontend/apps/cliente/cliente.css` e `frontend/apps/painel/painel.css` (usam só os tokens) |

Regra de ouro: componentes **nunca** usam cores fixas, apenas `var(--cor-...)`. Assim, um novo tema não exige tocar em componentes.
