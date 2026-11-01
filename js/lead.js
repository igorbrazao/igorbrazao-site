/* ==========================================================================
   lead.js — igorbrazao.com.br
   1) Atribuição: guarda UTM, gclid (Google Ads) e msclkid (Microsoft Ads) da
      página onde o visitante chegou, para que o formulário enviado depois —
      mesmo em outra página — saiba de qual campanha e palavra-chave ele veio.
   2) WhatsApp: todo link com data-wa dispara o evento generate_lead no GA4
      (importável como conversão no Google Ads).
   3) Formulário curto das páginas de venda (form[data-lead-form]): grava o
      lead na tabela "leads" do Supabase, avisa por e-mail e redireciona para
      obrigado.html?ref=contato (conversão já configurada).
   ========================================================================== */
(function () {
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'msclkid'];
  var STORE = 'ib_attr';
  var DAYS = 90;

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      if (obj && obj.ts && (Date.now() - obj.ts) > DAYS * 864e5) return {};
      return obj || {};
    } catch (e) { return {}; }
  }

  function save(obj) {
    try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { /* navegação privada */ }
  }

  // Captura na chegada: só sobrescreve se a URL trouxer parâmetros de campanha
  var params = new URLSearchParams(window.location.search);
  var found = {};
  var has = false;
  KEYS.forEach(function (k) { var v = params.get(k); if (v) { found[k] = v.slice(0, 200); has = true; } });
  var attr = load();
  if (has) {
    found.landing = window.location.pathname;
    found.ts = Date.now();
    attr = found;
    save(attr);
  }

  window.IBAttr = {
    value: function (k) { return attr[k] || ''; },
    resumo: function () {
      var partes = [window.location.href];
      if (attr.landing) partes.push('entrada=' + attr.landing);
      if (attr.gclid) partes.push('gclid=' + attr.gclid);
      if (attr.msclkid) partes.push('msclkid=' + attr.msclkid);
      return partes.join(' | ');
    }
  };

  function pagina() { return window.location.pathname.replace(/^\//, '') || 'index.html'; }
  function evento(categoria) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { event_category: categoria, event_label: pagina() });
    }
  }

  // WhatsApp
  document.querySelectorAll('a[data-wa]').forEach(function (a) {
    a.addEventListener('click', function () { evento('whatsapp'); });
  });
  document.querySelectorAll('a[data-tel]').forEach(function (a) {
    a.addEventListener('click', function () { evento('phone_call'); });
  });

  // Formulário curto
  var SUPABASE_URL = 'https://wmeuciarrmzobfgyzwfo.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtZXVjaWFycm16b2JmZ3l6d2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTY0NjIsImV4cCI6MjA4MTA3MjQ2Mn0.8fDdd1iUic-aL_Gh2CjmgDdCP6Ai8JCbPv0TwZoXb38';

  document.querySelectorAll('form[data-lead-form]').forEach(function (form) {
    var btn = form.querySelector('button[type="submit"]');
    var erro = form.querySelector('.form-err');
    var rotulo = btn ? btn.textContent : '';

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (erro) erro.style.display = 'none';
      if (form.site_web && form.site_web.value) { window.location.href = 'obrigado.html?ref=contato'; return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (!window.supabase) { if (erro) erro.style.display = 'block'; return; }

      btn.disabled = true;
      btn.textContent = 'Enviando...';

      var servico = form.getAttribute('data-servico') || '';
      var prazo = form.prazo && form.prazo.value ? ('Data-limite informada: ' + form.prazo.value + '\n') : '';
      var payload = {
        nome: form.nome.value.trim(),
        email: form.email.value.trim(),
        telefone: form.telefone.value.trim() || null,
        assunto: form.getAttribute('data-assunto') || 'pericia',
        mensagem: '[' + servico + '] ' + prazo + (form.mensagem.value.trim() || '(sem descrição)'),
        consentimento: form.consentimento.checked,
        pagina_origem: window.IBAttr.resumo(),
        utm_source: window.IBAttr.value('utm_source') || null,
        utm_medium: window.IBAttr.value('utm_medium') || null,
        utm_campaign: window.IBAttr.value('utm_campaign') || null,
        utm_term: window.IBAttr.value('utm_term') || null,
        utm_content: window.IBAttr.value('utm_content') || null
      };

      try {
        var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        var res = await sb.from('leads').insert([payload]);
        if (res.error) throw res.error;
      } catch (err) {
        console.error('Erro ao enviar lead:', err);
        if (erro) erro.style.display = 'block';
        btn.disabled = false;
        btn.textContent = rotulo;
        return;
      }

      try {
        await fetch(SUPABASE_URL + '/functions/v1/send-lead-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY, 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ record: payload })
        });
      } catch (mailErr) { console.error('Falha no aviso por e-mail (lead já salvo):', mailErr); }

      window.location.href = 'obrigado.html?ref=contato';
    });
  });
})();
