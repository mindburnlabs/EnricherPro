<div align="center">
<img width="1200" height="475" alt="Consumable Enricher Pro Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 📦 Consumable Enricher Pro
### Enterprise-grade PIM data enrichment for printer consumables

[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/Google-AI_Studio-4285F4?style=flat-square&logo=google-gemini)](https://ai.google.dev/)
[![Firecrawl](https://img.shields.io/badge/Firecrawl-V2-FF4F40?style=flat-square)](https://firecrawl.dev/)

</div>

---

## 🚀 Overview

**Consumable Enricher Pro** is a powerful data processing engine designed to transform messy supplier product titles into high-precision, publication-ready catalogs. It specializes in **Printer Consumables** (toners, drums, ink) with a strict focus on the **Russian market** and logistics accuracy.

![App Dashboard](/Users/ivan/.gemini/antigravity/brain/191a3926-02c3-4461-86fc-7b22cffe0548/enricher_pro_dashboard_1766996281581.png)

## ✨ Core Features

- **🔥 Firecrawl V2 Integration**: Autonomous web research and deep scraping of OEM sources.
- **🤖 Gemini & OpenRouter**: Multi-LLM synthesis with high-performance search grounding and GPT-4o fallback.
- **📦 Exclusive NIX Logistics**: Precise packaging dimensions (mm) and weight (g) sourced exclusively from NIX.ru.
- **🇷🇺 Russian Market Compliance**: Strict 2+ source verification process for printer compatibility.
- **🖼️ Image Auditing**: Automated validation (800x800) with watermark and OEM trademark rejection.
- **📊 Quality Scoring**: Publication readiness scoring (0-100%) for automated bulk approval.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18+)
- **NPM** or **Yarn**

### Installation

1. **Clone and Install**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env.local` file with the following keys:
   ```env
   VITE_GOOGLE_API_KEY=your_gemini_key
   VITE_FIRECRAWL_API_KEY=your_firecrawl_key
   VITE_OPENROUTER_API_KEY=your_openrouter_key  # Optional fallback
   VITE_STRICT_MODE=true
   VITE_IMAGE_POLICY=approved_library_only
   ```

3. **Launch**:
   ```bash
   npm run dev
   ```

---

## 🏗️ Technical Architecture

The system follows a modular, service-oriented architecture:

- **`/services`**: Core logic for API integration, text processing, and market compliance.
- **`/types`**: Modular TypeScript definitions (Error, Domain, Audit, API).
- **`/components`**: Reactive UI components built with modern React.

For deep technical details, see the [API Documentation](API_DOCUMENTATION.md).

---

## 📄 License

Internal Tool - All Rights Reserved.

