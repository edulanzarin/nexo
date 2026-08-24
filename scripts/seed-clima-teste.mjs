/**
 * Semeia uma rodada de clima FICTÍCIA para conferir o painel de resultados sem
 * depender do dado de produção. Cria linhas próprias (formulário, rodada e
 * respostas com o nome "ZZ Clima (dados de teste)") e, ao rodar de novo, derruba
 * só o que ele mesmo criou — nunca toca em rodada real. Ver
 * [[Semear teste cria linha nova, não muta linha real]].
 *
 *   node scripts/seed-clima-teste.mjs
 *
 * Para remover:  delete from clima_resposta where rodada_id in
 *                  (select id from clima_rodada where titulo = 'ZZ Clima (dados de teste)');
 *                (e as linhas de clima_rodada / formulario com o mesmo título)
 */
import { readFileSync } from "node:fs";
import pg from "pg";
const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n").filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const c = new pg.Client({ connectionString: env.APP_DB_URL });
await c.connect();

const TITULO = "ZZ Clima (dados de teste)";
// idempotente: derruba o que uma rodada anterior deste script deixou
await c.query(`delete from clima_resposta where rodada_id in (select id from clima_rodada where titulo=$1)`, [TITULO]);
await c.query(`delete from clima_rodada where titulo=$1`, [TITULO]);
await c.query(`delete from formulario_campo where formulario_id in (select id from formulario where nome=$1)`, [TITULO]);
await c.query(`delete from formulario where nome=$1`, [TITULO]);

const { rows: [form] } = await c.query(
  `insert into formulario (nome, descricao, status) values ($1,$2,'ativo') returning id`,
  [TITULO, "Formulário semeado só para conferir o painel de resultados"]
);

const campos = [
  ["selecao_unica", "Qual o seu tempo de empresa?", { opcoes: ["Menos de 6 meses","De 6 meses a 1 ano","De 1 a 2 anos","De 2 a 5 anos","Mais de 5 anos"] }],
  ["selecao_unica", "Em qual setor você trabalha?", { opcoes: ["Administrativo/Financeiro/RH","Contábil","Comercial/Controladoria","Departamento Pessoal","Fiscal/Compliance","Finave","Diretoria"] }],
  ["nota", "Como você avalia o ambiente de trabalho?", { escala: ["Insatisfatório","Regular","Bom","Excelente"] }],
  ["nota", "A liderança dá retorno sobre o seu trabalho?", { max: 5 }],
  ["selecao_multipla", "O que mais te motiva aqui?", { opcoes: ["Salário e benefícios","Equipe","Aprendizado","Flexibilidade","Reconhecimento"] }],
  ["pontuacao", "De 0 a 10, o quanto você recomendaria a empresa para um amigo?", { min: 0, max: 10 }],
  ["texto_longo", "O que a empresa poderia melhorar?", {}],
];
const ids = [];
for (const [i, [tipo, rotulo, config]] of campos.entries()) {
  const { rows: [r] } = await c.query(
    `insert into formulario_campo (formulario_id, ordem, tipo, rotulo, obrigatorio, config)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [form.id, i, tipo, rotulo, tipo !== "texto_longo", JSON.stringify(config)]
  );
  ids.push(r.id);
}

const { rows: [rodada] } = await c.query(
  `insert into clima_rodada (titulo, descricao, slug, formulario_id) values ($1,$2,$3,$4) returning id, slug`,
  [TITULO, "Dados semeados", "zz-clima-teste", form.id]
);

const tempos = ["Menos de 6 meses","De 6 meses a 1 ano","De 1 a 2 anos","De 2 a 5 anos","Mais de 5 anos"];
const setores = ["Administrativo/Financeiro/RH","Contábil","Comercial/Controladoria","Departamento Pessoal","Fiscal/Compliance","Finave","Diretoria"];
const motiva = ["Salário e benefícios","Equipe","Aprendizado","Flexibilidade","Reconhecimento"];
const textos = [
  "Mais clareza na comunicação entre setores.",
  "Poderia ter mais treinamento técnico para quem entra.",
  "Rever a política de home office.",
  "Feedback mais frequente da liderança.",
  "",
  "Melhorar o plano de carreira.",
  "",
  "Espaço de descanso e café melhores.",
];
// distribuição proposital: Contábil mais crítico, Diretoria mais satisfeita
const respostas = Array.from({ length: 14 }, (_, i) => {
  const setor = setores[i % setores.length];
  const critico = setor === "Contábil" || setor === "Fiscal/Compliance";
  const ambiente = critico ? (i % 2 ? 1 : 2) : (i % 3 === 0 ? 2 : 3);
  const lideranca = critico ? (i % 2 ? 1 : 2) : (i % 4 === 0 ? 2 : 4);
  const nps = critico ? 5 + (i % 3) : 8 + (i % 3);
  const marcadas = motiva.filter((_, k) => (i + k) % 3 !== 0).slice(0, 3);
  const texto = textos[i % textos.length];
  const v = {
    [ids[0]]: tempos[i % tempos.length],
    [ids[1]]: setor,
    [ids[2]]: ambiente,
    [ids[3]]: lideranca,
    [ids[4]]: marcadas,
    [ids[5]]: nps,
  };
  if (texto) v[ids[6]] = texto;
  return v;
});
for (const v of respostas) {
  await c.query(`insert into clima_resposta (rodada_id, valores) values ($1,$2)`, [rodada.id, JSON.stringify(v)]);
}
console.log("rodada", rodada.id, rodada.slug, "· respostas", respostas.length, "· formulário", form.id);
await c.end();
