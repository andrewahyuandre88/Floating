import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 25, standardHeaders: true, legacyHeaders: false }));

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY belum diatur. Buat .env berdasarkan .env.example.");
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-6.1-sol";

app.get("/health", (_req, res) => res.json({ ok: true, app: "ASSISTANT PRO API" }));

app.post("/api/ask", async (req, res) => {
  try {
    const { question, mode, image } = req.body || {};
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Pertanyaan tidak boleh kosong." });
    }
    if (question.length > 12000) return res.status(413).json({ error: "Pertanyaan terlalu panjang." });

    const instructions = [
      "Kamu adalah ASSISTANT PRO, asisten belajar berbahasa Indonesia.",
      mode === "kilat"
        ? "Berikan jawaban ringkas, langsung ke inti, dan tetap akurat."
        : mode === "soal"
          ? "Selesaikan soal dengan jawaban dan langkah pembahasan yang mudah dipahami."
          : "Jawab dengan jelas, terstruktur, dan sesuai tingkat pelajar.",
      "Jika gambar berisi soal, baca teks yang terlihat, sebutkan jika ada bagian yang tidak terbaca, lalu jelaskan penyelesaian.",
      "Jangan mengarang data. Jika informasi kurang, nyatakan asumsi atau minta klarifikasi.",
      "Bantu pengguna memahami konsep, bukan hanya menyalin jawaban."
    ].join(" ");

    const content = [{ type: "input_text", text: question.trim() }];
    if (image !== undefined && image !== null && image !== "") {
      if (typeof image !== "string" || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) {
        return res.status(400).json({ error: "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP." });
      }
      if (image.length > 9_500_000) return res.status(413).json({ error: "Gambar terlalu besar." });
      content.push({ type: "input_image", image_url: image });
    }

    const response = await client.responses.create({
      model,
      instructions,
      input: [{ role: "user", content }]
    });

    res.json({ answer: response.output_text || "AI tidak mengembalikan teks jawaban." });
  } catch (err) {
    console.error("AI request failed:", err?.message || err);
    const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({
      error: status === 401 ? "API key tidak valid." :
             status === 429 ? "Kuota atau batas penggunaan API tercapai." :
             "Terjadi kesalahan server saat menghubungi AI."
    });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`ASSISTANT PRO API aktif di port ${port}`));
