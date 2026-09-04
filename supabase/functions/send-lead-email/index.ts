// ============================================================================
// send-lead-email
// Dispara um e-mail via Resend sempre que um novo registro é inserido em
// public.leads (o formulário de contato de igorbrazao.com.br).
//
// Como é acionada: um Database Webhook do Supabase (Database > Webhooks),
// configurado para o evento INSERT na tabela "leads", chama esta função
// automaticamente e envia o registro inserido no corpo da requisição.
//
// Secrets necessários (configurar em Supabase > Edge Functions > Secrets,
// NUNCA no código):
//   RESEND_API_KEY   — chave de API do Resend
//   LEAD_EMAIL_TO    — e-mail que recebe a notificação (ex: contato@igorbrazao.com.br)
//   LEAD_EMAIL_FROM  — remetente verificado no Resend (ex: contato@igorbrazao.com.br
//                      ou leads@igorbrazao.com.br, no domínio verificado)
// ============================================================================

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();

    // Payload de um Database Webhook do Supabase tem o formato:
    // { type: "INSERT", table: "leads", record: {...}, schema: "public", old_record: null }
    const lead = payload.record ?? payload;

    if (!lead || !lead.email) {
      return new Response(JSON.stringify({ error: "payload sem lead válido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LEAD_EMAIL_TO = Deno.env.get("LEAD_EMAIL_TO") ?? "contato@igorbrazao.com.br";
    const LEAD_EMAIL_FROM = Deno.env.get("LEAD_EMAIL_FROM") ?? "contato@igorbrazao.com.br";

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY não configurada");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY ausente" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const assuntoLabels: Record<string, string> = {
      pericia: "Cálculo Judicial / Perícia Contábil",
      recuperacao: "Recuperação Judicial, Falência ou Portal AJ",
      valuation: "Valuation & Apuração de Haveres",
      contratos: "Análise de Onerosidade de Contratos (ChecaJuros)",
    };
    const assuntoLegivel = assuntoLabels[lead.assunto] ?? lead.assunto ?? "Não informado";

    const origemCampanha = [lead.utm_source, lead.utm_medium, lead.utm_campaign]
      .filter(Boolean)
      .join(" / ") || "Tráfego direto ou orgânico";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#0a0c10;">Novo contato pelo site</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;width:140px;">Nome</td><td style="padding:6px 0;"><strong>${escapeHtml(lead.nome)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666;">E-mail</td><td style="padding:6px 0;">${escapeHtml(lead.email)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Telefone</td><td style="padding:6px 0;">${escapeHtml(lead.telefone ?? "Não informado")}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Assunto</td><td style="padding:6px 0;">${escapeHtml(assuntoLegivel)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Origem</td><td style="padding:6px 0;">${escapeHtml(origemCampanha)}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">Página</td><td style="padding:6px 0;">${escapeHtml(lead.pagina_origem ?? "-")}</td></tr>
        </table>
        <p style="color:#666;margin-top:16px;">Mensagem:</p>
        <p style="white-space:pre-wrap;background:#f6f1e7;padding:12px;border-radius:6px;">${escapeHtml(lead.mensagem)}</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Site Igor L. Brazão <${LEAD_EMAIL_FROM}>`,
        to: [LEAD_EMAIL_TO],
        reply_to: lead.email,
        subject: `Novo contato — ${lead.nome} (${assuntoLegivel})`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errBody = await resendResponse.text();
      console.error("Erro do Resend:", resendResponse.status, errBody);
      return new Response(JSON.stringify({ error: "falha ao enviar via Resend", detail: errBody }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro inesperado em send-lead-email:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
