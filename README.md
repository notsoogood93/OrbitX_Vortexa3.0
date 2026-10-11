# 🌌 OrbitX_Vortexa3.0

> Next-Generation AI Autonomous System for Pune Hackathon 2026.

---

## ⚡ Overview
**OrbitX Vortexa 3.0** is an intelligent AI system built for high-throughput, low-latency, and zero-context-loss workflows. Powered by:
- **🧠 MEMORY Brain Architecture**: Lazy-loaded vector memory and structured rule modules.
- **🌐 FreeLLMAPI Unified Router**: Multi-model failover across 1min.ai, Groq, Cerebras, Google Gemini, OpenRouter, and AIML API.
- **⚡ Session Handoff Engine**: Real-time progress synchronization across coding agents.

---

## 🛠️ Tech Stack & Setup
- **Architecture**: Modular Agentic Pipeline
- **Memory & Vector Store**: ChromaDB with Top-K semantic retrieval
- **Routing**: FreeLLMAPI OpenAI-compatible gateway (`http://localhost:3001/v1`)

---

## 📁 Project Structure
```text
OrbitX_Vortexa3.0/
├── .agent-progress.md      # Active session progress & handoff
├── .cursorrules            # Agent directives & memory hooks
├── GEMINI.md               # Autonomous agent configuration
├── AGENTS.md               # Multi-agent standard configuration
└── src/                    # Application source code
```

---

## 🚀 Getting Started
1. Ensure your local LLM router is active (`cd ../freellmapi && npm run dev`).
2. Run memory search for specific tasks:
   ```bash
   python ../../Downloads/MEMORY-main/MEMORY-main/tools/memory_search.py "<query>" 3
   ```
3. Update session handoffs in `.agent-progress.md` after each milestone.
