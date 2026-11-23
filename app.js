// Ganti dengan URL backend Node.js milikmu. Jangan letakkan API key OpenAI di file ini.
const API_BASE_URL = "https://GANTI-DENGAN-URL-BACKEND-KAMU.example";

const $ = (id) => document.getElementById(id);
const question = $("question");
const sendBtn = $("sendBtn");
const cancelBtn = $("cancelBtn");
const answerText = $("answerText");
const answerStatus = $("answerStatus");
const copyBtn = $("copyBtn");
const photoInput = $("photoInput");
const photoPreview = $("photoPreview");
const fileName = $("fileName");

let mode = "auto";
let selectedImage = null;
let activeController = null;
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

document.querySelectorAll(".feature-card[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".feature-card[data-mode]").forEach((b) => b.classList.toggle("selected", b === button));
    $("modeTitle").textContent = mode === "soal" ? "Kerjakan Soal Ini" : mode === "kilat" ? "Mode Kilat 10s" : "Auto Jawab";
    toast("Mode " + $("modeTitle").textContent + " dipilih");
  });
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) {
    selectedImage = null;
    photoPreview.hidden = true;
    fileName.textContent = "Belum ada foto";
    return;
  }
  if (!file.type.startsWith("image/")) {
    toast("Pilih file gambar yang valid.");
    photoInput.value = "";
    return;
  }
  if (file.size > 7 * 1024 * 1024) {
    toast("Ukuran foto maksimal 7 MB.");
    photoInput.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    selectedImage = reader.result;
    photoPreview.src = selectedImage;
    photoPreview.hidden = false;
    fileName.textContent = file.name;
  };
  reader.readAsDataURL(file);
});

function setBusy(busy) {
  sendBtn.disabled = busy;
  cancelBtn.disabled = !busy;
  sendBtn.innerHTML = busy ? "<span>◌</span> Memproses..." : "<span>✦</span> Kirim ke AI";
}

async function askAI() {
  const prompt = question.value.trim();
  if (!prompt && !selectedImage) {
    toast("Tulis pertanyaan atau tambahkan foto soal.");
    question.focus();
    return;
  }
  if (API_BASE_URL.includes("GANTI-DENGAN-URL") || (!API_BASE_URL.startsWith("https://") && !API_BASE_URL.includes("localhost") && !API_BASE_URL.includes("127.0.0.1"))) {
    toast("Atur API_BASE_URL di www/app.js terlebih dahulu.");
    return;
  }

  activeController = new AbortController();
  setBusy(true);
  answerStatus.textContent = "Memproses";
  answerText.textContent = "ASSISTANT PRO sedang menyiapkan jawaban...";
  copyBtn.disabled = true;

  try {
    const response = await fetch(API_BASE_URL.replace(/\/$/, "") + "/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: activeController.signal,
      body: JSON.stringify({
        question: prompt || "Baca gambar soal ini, transkripsikan jika perlu, lalu jawab dan jelaskan langkahnya.",
        mode,
        image: selectedImage
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Server mengembalikan kesalahan " + response.status);
    answerText.textContent = data.answer || "AI tidak mengembalikan jawaban.";
    answerStatus.textContent = "Selesai";
    copyBtn.disabled = false;
    saveHistory(prompt || "[Soal dari foto]", data.answer || "");
  } catch (error) {
    if (error.name === "AbortError") {
      answerText.textContent = "Permintaan dibatalkan.";
      answerStatus.textContent = "Dibatalkan";
    } else {
      answerText.textContent = "Gagal menghubungi AI: " + error.message + "\n\nPeriksa URL backend, koneksi internet, dan status server.";
      answerStatus.textContent = "Gagal";
    }
  } finally {
    activeController = null;
    setBusy(false);
  }
}

sendBtn.addEventListener("click", askAI);
cancelBtn.addEventListener("click", () => {
  if (activeController) activeController.abort();
});
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(answerText.textContent);
    toast("Jawaban disalin.");
  } catch {
    toast("Tidak dapat menyalin otomatis pada perangkat ini.");
  }
});

function getHistory() {
  try { return JSON.parse(localStorage.getItem("assistantProHistory") || "[]"); }
  catch { return []; }
}
function saveHistory(prompt, answer) {
  const items = getHistory();
  items.unshift({ prompt, answer, date: new Date().toLocaleString("id-ID") });
  localStorage.setItem("assistantProHistory", JSON.stringify(items.slice(0, 25)));
  renderHistory();
}
function renderHistory() {
  const items = getHistory();
  const list = $("historyList");
  list.innerHTML = "";
  if (!items.length) {
    list.textContent = "Belum ada riwayat.";
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    const title = document.createElement("b");
    title.textContent = item.prompt;
    const date = document.createElement("small");
    date.textContent = " • " + item.date;
    date.style.color = "#9993aa";
    row.append(title, date);
    row.addEventListener("click", () => {
      question.value = item.prompt;
      answerText.textContent = item.answer;
      answerStatus.textContent = "Riwayat";
      copyBtn.disabled = !item.answer;
      $("historyCard").hidden = true;
      $("answerCard").scrollIntoView({ behavior: "smooth" });
    });
    list.appendChild(row);
  });
}
$("historyBtn").addEventListener("click", () => {
  $("historyCard").hidden = !$("historyCard").hidden;
  renderHistory();
  if (!$("historyCard").hidden) $("historyCard").scrollIntoView({ behavior: "smooth" });
});
$("clearHistoryBtn").addEventListener("click", () => {
  localStorage.removeItem("assistantProHistory");
  renderHistory();
  toast("Riwayat dihapus dari perangkat.");
});

$("floatingBtn").addEventListener("click", async () => {
  // Native Android: request overlay permission, then launch draggable system bubble.
  try {
    const plugin = window.Capacitor?.Plugins?.FloatingOverlay;
    if (plugin) {
      const permission = await plugin.hasPermission();
      if (!permission.granted) {
        await plugin.requestPermission();
        toast("Aktifkan izin 'Tampil di atas aplikasi lain', lalu tekan tombol Floating lagi.");
        return;
      }
      await plugin.start();
      toast("Tombol AI melayang aktif. Ketuk gelembung untuk membuka/menutup panel.");
      return;
    }
  } catch (error) {
    toast("Floating native gagal: " + error.message);
    return;
  }
  // SPCK browser preview: show an in-app mini panel (browser cannot create Android overlay).
  $("miniPanel").hidden = false;
  toast("Preview SPCK: panel mini hanya tampil di dalam halaman.");
});
$("closeMini").addEventListener("click", () => $("miniPanel").hidden = true);
$("backToQuestion").addEventListener("click", () => {
  $("miniPanel").hidden = true;
  question.focus();
  window.scrollTo({ top: $("question").getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
});

renderHistory();
