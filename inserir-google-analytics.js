#!/usr/bin/env node
/**
 * inserir-google-analytics.js — igorbrazao.com.br
 *
 * Insere a tag do Google Analytics 4 (gtag.js) no <head> de todas as páginas
 * HTML do site. Idempotente (não duplica se já houver) e cria backup .bak-ga
 * de cada arquivo alterado.
 *
 * ID de métricas: G-4W4JDW7MWC
 *
 * Rode na pasta onde estão os .html do site (o repositório igorbrazao-site):
 *   node inserir-google-analytics.js
 */
const fs = require('fs');
const path = require('path');

const GA_ID = 'G-4W4JDW7MWC';

const TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
</script>`;

// pega todos os .html da pasta atual
const arquivos = fs.readdirSync('.').filter(f => f.endsWith('.html'));

if (arquivos.length === 0) {
  console.error('❌ Nenhum arquivo .html encontrado nesta pasta. Rode dentro da pasta do site.');
  process.exit(1);
}

let alterados = 0, pulados = 0;

for (const f of arquivos) {
  let html = fs.readFileSync(f, 'utf-8');

  // já tem a tag? pula
  if (html.includes(GA_ID) || html.includes('googletagmanager.com/gtag')) {
    console.log(`⏭️  ${f}: já tem a tag, pulando.`);
    pulados++;
    continue;
  }

  // insere logo após <head> (com ou sem atributos)
  const m = html.match(/<head[^>]*>/i);
  if (!m) {
    console.log(`⚠️  ${f}: não achei <head>, pulando.`);
    pulados++;
    continue;
  }

  // backup
  const bak = f + '.bak-ga';
  if (!fs.existsSync(bak)) fs.copyFileSync(f, bak);

  const headTag = m[0];
  html = html.replace(headTag, headTag + '\n' + TAG);
  fs.writeFileSync(f, html);
  console.log(`✅ ${f}: tag inserida.`);
  alterados++;
}

console.log(`\n${alterados} páginas alteradas, ${pulados} puladas.`);
console.log('Backups: cada arquivo tem uma cópia .bak-ga (pode apagar depois de confirmar).');
console.log('\nAgora suba os .html no GitHub. NÃO suba os .bak-ga.');
console.log('Depois, visite o site e veja no Analytics em "Tempo real" se aparece 1 usuário (você).');
