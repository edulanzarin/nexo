# NaveX: instruções do projeto

NaveX é a reescrita do Nexo (nexo2, em `C:/Dev/nexo2`, que segue no ar até a
troca). A camada de domínio vem do nexo2; a interface é nova, feita do zero.

## A regra que manda nas outras

**Tela é montagem.** Antes de escrever JSX de tela, abra `/sistema` e veja o que
já existe. Peça que existe se usa; peça que quase existe se estende no
primitivo; peça que não existe nasce em `primitivos/` ou `produto/` e **entra no
catálogo no mesmo commit**, com uma frase dizendo a decisão que ela carrega.

## Fronteira de pasta

- `src/componentes/primitivos/`: não conhece o domínio. Nada aqui importa de
  `lib/` além de `cn` e `format`.
- `src/componentes/produto/`: conhece o domínio (empresa, período, nota, conta).
- `src/componentes/casca/`: a moldura (barra lateral, topo, paleta, marca, tema).
- `src/app/<modulo>/<secao>/`: a tela. Hook de consulta que só ela usa mora na
  pasta dela, não num arquivo global de hooks.
- `src/lib/`: domínio, portado do nexo2. **Não reescreva o SQL do Questor**:
  são meses de conhecimento validado contra o banco real.

## O contexto de trabalho

Empresa, grupo, filial e período moram na URL (`empresas`, `grupos`, `estabs`,
`inicio`, `fim`) e valem para todas as seções do módulo. Quem desenha os
controles é o topo (`casca/barra-topo`), dirigido pelo catálogo de seções
(`lib/secoes/*`): cada aba declara `periodo`, `empresa`, `filial` e `execucao`.

A tela não desenha seletor de empresa nem de período, e não desenha o botão
Executar. Ela lê `useExecucao()`: `qs` é a query do recorte executado, pronta
para mandar à API. A moldura já decidiu que a tela só monta com empresa (se a
aba exige) e depois da primeira execução (se a aba é de botão).

A exceção é o RH: o dado dele é fixo nas empresas da própria Navecon, que o
seletor do topo nem lista. As abas do RH não leem empresa do contexto, e a
tela que recorta por empresa usa `SeletorEmpresaRh` (`produto/rh/empresa-rh`).

Filtro próprio da tela (entradas/saídas, situação, busca) aplica na hora e vai
junto na query; ações próprias no cabeçalho vão por `<AcoesPagina>`.

## Ao escrever uma tela

1. **Quatro estados**: carregando (`EsqueletoTabela`, `Indicador carregando`),
   vazio (`Vazio`), erro (`PainelErro` com a mensagem do servidor) e com dado.
2. **Vazio de tela nova ensina; vazio de filtro diz o que afrouxar.**
3. **Nada de hex nem medida solta.** Cor de token, altura `h-controle`.
4. **Nenhum número formatado à mão.** `lib/format` (`brl`, `num`, `pct`...).
   `toFixed` devolve ponto, que em pt-BR é milhar.
5. **Números da tela numa `FaixaIndicadores`**, não em cartões soltos.
6. **Linha enxuta, detalhe em modal.**
7. **Texto de tela sem cadência de IA**: sem travessão emendando oração, sem
   "não é X, é Y", sem justificar a decisão de projeto. O porquê vai no
   comentário. Nota e ressalva em itálico (`Nota`), só com o que a pessoa não sabe.
8. **Movimento vem dos primitivos.** Tela não anima à mão.

## Servidor

- Página chama `assertSecao(modulo, secao)`; rota de API usa `apiRoute`, que
  deriva o módulo do caminho. Módulo novo entra no regex de `api-route.ts` e no
  mapa de `api-secoes.ts`.
- O Questor é somente leitura. Nunca escreva nele.
- Nunca confie em empresa vinda do cliente: `assertEmpresaVisivel` ou o escopo
  da sessão dentro da query.
- Migration é SQL puro, nunca editada depois de aplicada. O schema é o mesmo do
  nexo2 de propósito: no dia da troca, o NaveX assume o banco do app sem migrar
  dado.

## Convenções

- Português em arquivo, componente e variável; kebab-case no arquivo.
- Comentário explica por quê.
- Conventional Commits, trabalho em branch, SemVer cortada em release.
- Commits só com a autoria do Eduardo, sem Co-Authored-By.
