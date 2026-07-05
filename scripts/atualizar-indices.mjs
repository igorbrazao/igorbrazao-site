// scripts/atualizar-indices.mjs
//
// Busca Selic (meta), TR, IPCA-E e INPC diretamente na API pública do
// Banco Central (SGS - Sistema Gerenciador de Séries Temporais) e grava
// o resultado em dados/indices.json.
//
// Series SGS utilizadas:
//   432   - Selic, meta definida pelo Copom (%a.a.) — valor direto
//   226   - TR (% mensal) — valor direto
//   10764 - IPCA-E (% mensal) — acumulado calculado a partir dos últimos 12 meses
//   188   - INPC (% mensal) — acumulado calculado a partir dos últimos 12 meses
//
// Executado via GitHub Actions (.github/workflows/atualizar-indices.yml).
// Não requer chave de API: os dados do BCB são públicos e abertos.

import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

async function buscarUltimoValor(serie) {
  const url = `${BASE}.${serie}/dados/ultimos/1?formato=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao buscar série ${serie}: HTTP ${resp.status}`);
  const dados = await resp.json();
  if (!dados.length) throw new Error(`Série ${serie} retornou vazio`);
  return dados[0]; // { data: "dd/mm/aaaa", valor: "0,17" }
}

async function buscarAcumulado12Meses(serie) {
  const url = `${BASE}.${serie}/dados/ultimos/12?formato=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao buscar série ${serie}: HTTP ${resp.status}`);
  const dados = await resp.json();
  if (dados.length < 12) throw new Error(`Série ${serie} retornou menos de 12 meses`);

  // Cada valor mensal é uma variação percentual; o acumulado de 12 meses
  // é o produto composto (1 + v1/100) * (1 + v2/100) * ... - 1.
  const fator = dados.reduce((acc, item) => {
    const v = parseFloat(item.valor.replace(",", "."));
    return acc * (1 + v / 100);
  }, 1);

  const acumulado = (fator - 1) * 100;
  const ultimo = dados[dados.length - 1];
  return { valor: acumulado, referencia: ultimo.data };
}

function formatarPercentual(valor, casas = 2) {
  return valor.toFixed(casas).replace(".", ",");
}

async function main() {
  console.log("Buscando índices no Banco Central (SGS)...");

  const [selic, tr, ipcaE, inpc] = await Promise.all([
    buscarUltimoValor(432),
    buscarUltimoValor(226),
    buscarAcumulado12Meses(10764),
    buscarAcumulado12Meses(188),
  ]);

  const resultado = {
    atualizadoEm: new Date().toISOString(),
    indices: {
      selicMeta: {
        valor: parseFloat(selic.valor.replace(",", ".")),
        valorFormatado: `${selic.valor.replace(".", ",")}% a.a.`,
        referencia: selic.data,
      },
      trMensal: {
        valor: parseFloat(tr.valor.replace(",", ".")),
        valorFormatado: `${tr.valor.replace(".", ",")}%`,
        referencia: tr.data,
      },
      ipcaEAcumulado12m: {
        valor: ipcaE.valor,
        valorFormatado: `${formatarPercentual(ipcaE.valor)}%`,
        referencia: ipcaE.referencia,
      },
      inpcAcumulado12m: {
        valor: inpc.valor,
        valorFormatado: `${formatarPercentual(inpc.valor)}%`,
        referencia: inpc.referencia,
      },
    },
  };

  await mkdir("dados", { recursive: true });
  await writeFile("dados/indices.json", JSON.stringify(resultado, null, 2) + "\n", "utf-8");

  console.log("dados/indices.json atualizado com sucesso:");
  console.log(JSON.stringify(resultado, null, 2));
}

main().catch((err) => {
  console.error("Erro ao atualizar índices:", err);
  process.exit(1);
});
