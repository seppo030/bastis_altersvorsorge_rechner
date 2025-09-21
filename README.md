# Rentenlücke & ETF‑Sparplan Rechner (Vite + React)

Ein moderner, statischer Rechner für:
- **Kapitalbedarf** aus monatlicher Rentenlücke (wachsende Entnahme optional)
- **Sparrate** zum Erreichen des Zielkapitals (mit jährlicher, realer Steigerung)
- **PDF‑Export** des Ergebniskastens

## 🍀 Reale Betrachtung
Wir rechnen in **heutigen Preisen**. Verwende daher **reale Renditen** (≈ Nominal − Inflation).  
Standardannahmen:
- Rentenphase: 0–1.5 % real
- Ansparphase: 3–5 % real
- Wachstumsraten optional (real)

## 🔢 Formeln
**PV wachsende Annuität (monatlich):**  
PV = P / (r − g) × [1 − ((1+g)/(1+r))^N]

**PV konstante Annuität (Spezialfall g = 0):**  
PV = P × (1 − (1+r)^(−N)) / r

**FV wachsende Annuität (monatliche Sparrate R, wächst um g):**  
FV = R × [((1+r)^N − (1+g)^N) / (r − g)]  
⇒ **Sparrate im ersten Monat**: R = FV × (r − g) / ((1+r)^N − (1+g)^N)

r = monatliche reale Rendite, g = monatliches Wachstums‑Tempo, N = Monate.

## ▶️ Entwicklung & Start
```bash
npm i
npm run dev
```
Öffne http://localhost:5173

## 🏗️ Build & Deploy
```bash
npm run build
# /dist Ordner auf Vercel/Netlify/Cloudflare Pages deployen
```
**Vercel:** „New Project“ → Repo auswählen → **Framework: Other** → Deploy.

## 📦 Tech
- Vite + React 18
- Vanilla CSS (Dark Theme)
- html2canvas + jsPDF (Client‑seitiger PDF‑Export)

## ⚠️ Haftungsausschluss
Keine Finanz-/Steuerberatung. Vereinfachte Modellrechnungen, ohne Gewähr.
