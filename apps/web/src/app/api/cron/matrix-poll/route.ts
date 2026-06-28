// ============================================================
// Cron Vercel : Matrix polling + réponse intelligente
// Route GET /api/cron/matrix-poll — toutes les 30s
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MATRIX_TOKEN = process.env["MATRIX_ACCESS_TOKEN"] || "";
const MATRIX_ROOM = process.env["MATRIX_ROOM_ID"] || "";
const MATRIX_USER = process.env["MATRIX_USER_ID"] || "";
const MATRIX_HS = "https://matrix.org";
const OPENROUTER_KEY = process.env["OPENROUTER_API_KEY"] || "";
const CRON_SECRET = process.env["CRON_SECRET"] || "";

async function matrixGet(path: string) {
  const r = await fetch(`${MATRIX_HS}/_matrix/client/v3/${path}`, {
    headers: { Authorization: `Bearer ${MATRIX_TOKEN}` },
  });
  return r.json();
}

async function matrixSend(text: string) {
  const txn = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const r = await fetch(
    `${MATRIX_HS}/_matrix/client/v3/rooms/${MATRIX_ROOM}/send/m.room.message/${txn}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${MATRIX_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ msgtype: "m.text", body: text }),
    },
  );
  return r.json();
}

async function callLLM(userMessage: string): Promise<string> {
  if (!OPENROUTER_KEY) return "Pas de clé API configurée.";

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-v4-pro",
      messages: [
        {
          role: "system",
          content:
            "Tu es Hermes, le copilote de Ranti (registre de loyer pour propriétaires africains). " +
            "Tu réponds à Adonis KPATINDE, le fondateur, sur Matrix. " +
            "Sois concis, factuel, en français. Une phrase = une idée. " +
            "Ranti : Next.js 16 + Supabase + Tailwind v4. Repo mrkpatinde/ranti. " +
            "Environnement : DB Supabase pcxkxeesgusorrpmrkaj, Vercel, Brevo SMTP. " +
            "Priorité : 3 pilotes → traction → YC. Pas de code sans 'vas-y'. " +
            "Ne mentionne jamais d'anciens projets (LitigePay, PayLink).",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });
  const data = await r.json();
  return data?.choices?.[0]?.message?.content || "Désolé, pas de réponse.";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MATRIX_TOKEN || !MATRIX_ROOM || !MATRIX_USER) {
    return Response.json({ error: "Matrix config missing" }, { status: 500 });
  }

  try {
    // Lire les 3 derniers messages
    const data = await matrixGet(
      `rooms/${MATRIX_ROOM}/messages?dir=b&limit=3`,
    );

    const messages = (data?.chunk || [])
      .filter(
        (e: { type: string; sender: string }) =>
          e.type === "m.room.message" && e.sender === MATRIX_USER,
      )
      .map((e: { content: { body: string }; event_id: string }) => ({
        body: e.content?.body?.trim() || "",
        eventId: e.event_id,
      }))
      .reverse();

    if (messages.length === 0) {
      return Response.json({ status: "no messages" });
    }

    const lastMsg = messages[messages.length - 1];

    // Vérifier si on a déjà répondu (chercher notre réponse après ce message)
    const afterData = await matrixGet(
      `rooms/${MATRIX_ROOM}/messages?dir=f&from=${lastMsg.eventId}&limit=5`,
    );

    const alreadyReplied = (afterData?.chunk || []).some(
      (e: { type: string; sender: string }) =>
        e.type === "m.room.message" && e.sender !== MATRIX_USER,
    );

    if (alreadyReplied) {
      return Response.json({ status: "already replied" });
    }

    // Traiter le message
    const response = await callLLM(lastMsg.body);

    // Envoyer la réponse
    const label = "[Hermes]";
    const fullResponse = `${label} ${response}`;
    await matrixSend(fullResponse);

    console.log(`[MatrixPoll] Répondu à: ${lastMsg.body.slice(0, 60)}`);

    return Response.json({
      ok: true,
      replied: true,
    });
  } catch (err) {
    console.error("[MatrixPoll] Error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
