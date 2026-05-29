# 🪟 苏格拉底之窗 (Socrates' Window)

> 洞穴墙上的投影，经由理性之光折射，成为理念世界的入口。

**苏格拉底之窗** 是一个基于 RAG（检索增强生成）的智能学习系统。上传你的学习材料，与苏格拉底式的 AI 导师展开对话，让知识从被动接收变为主动发现。

---

## 架构概览

```
┌──────────────────────────────────────────┐
│              前端 (React)                 │
│   对话页面 · 知识库管理 · 系统设置         │
└────────────────┬─────────────────────────┘
                 │ REST / SSE (流式)
┌────────────────┴─────────────────────────┐
│            后端 (FastAPI)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ RAG 服务  │ │ 文档服务  │ │ LLM 服务 │ │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘ │
│        │           │            │        │
│  ┌─────┴───────────┴────────────┴─────┐  │
│  │ ChromaDB (向量)  │ SQLite (元数据)  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite | 暗色学术风 UI |
| 后端 | FastAPI + SQLAlchemy + ChromaDB | 异步 Python |
| LLM | OpenAI 兼容接口 | 可接入任何兼容服务 |
| Embedding | OpenAI 兼容接口 | text-embedding-3-small 等 |
| 文档解析 | PyPDF2 / python-docx / markdown | PDF/DOCX/TXT/MD |
| 部署 | Docker Compose | 一键编排 |

---

## 快速开始

### 前置条件

- Python 3.11+
- Node.js 20+
- 可用的 LLM API Key（OpenAI 或兼容服务）

### 1. 克隆 & 配置

```bash
cd Socratess-window

# 后端配置
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入你的 API Key
```

### 2. 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

后端启动后访问 http://localhost:8000/docs 查看 API 文档。

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端启动后访问 http://localhost:5173。

### 4. Docker 一键部署

```bash
# 确保已配置好 .env 中的 API Key
docker compose up -d
```

前端 → http://localhost:3000
后端 → http://localhost:8000

---

## 核心功能

### 📚 知识库管理
- 创建多个知识库，每个知识库独立管理文档
- 支持 PDF、TXT、Markdown、DOCX 格式
- 智能分块策略：递归分割、Markdown 感知、语义边界

### 💬 苏格拉底式对话
- 基于知识库内容的 RAG 问答
- **流式输出**，逐字呈现回复
- 每次回答附带引用来源，可展开查看原文片段
- 对话历史持久化，支持多轮对话

### 🔍 语义搜索
- 跨知识库或知识库内语义搜索
- 返回最相关的文档片段及相关度评分

### 🧠 苏格拉底式系统提示词

苏格拉底的教学之道内置于系统提示词中：
- **追问而非灌输**：层层递进的问题引导发现
- **从具体升到抽象**：连接底层原理
- **跨域联结**：数学-音乐、物理-哲学之间的隐喻
- **知晓无知**：诚实面对不确定性
- **对话式节奏**：有温度、有停顿、有留白

---

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/collections` | 列出所有知识库 |
| POST | `/api/collections` | 创建知识库 |
| DELETE | `/api/collections/{id}` | 删除知识库 |
| POST | `/api/documents/upload/{collection_id}` | 上传文档 |
| GET | `/api/documents/collection/{collection_id}` | 列出文档 |
| DELETE | `/api/documents/{id}` | 删除文档 |
| POST | `/api/chat` | RAG 对话（非流式） |
| POST | `/api/chat/stream` | RAG 对话（SSE 流式） |
| GET | `/api/conversations/{collection_id}` | 对话列表 |
| GET | `/api/conversations/{collection_id}/{conv_id}` | 对话消息 |
| POST | `/api/search` | 语义搜索 |
| GET | `/api/system/stats` | 系统统计 |
| GET | `/api/system/config` | 系统配置 |

---

## 扩展路线

当前版本是核心骨架，预留了以下扩展点：

- [ ] **知识图谱**：从文档中抽取实体关系，可视化概念网络
- [ ] **间隔复习**：基于艾宾浩斯遗忘曲线的智能复习推送
- [ ] **多模态**：图片、视频、音频内容的理解与检索
- [ ] **协作学习**：多用户知识库共享与讨论
- [ ] **学习分析**：学习进度追踪、知识掌握度评估
- [ ] **本地模型**：接入 Ollama 等本地 LLM/Embedding
- [ ] **多语言增强**：跨语言检索与翻译辅助
- [ ] **自定义系统提示词**：前端界面编辑苏格拉底的人格

---

## 配置参考

所有配置通过环境变量管理，见 `backend/.env.example`：

```env
# LLM（对话模型）
LLM_API_BASE=https://api.openai.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL=gpt-4o-mini

# Embedding（向量化模型）
EMBED_API_BASE=https://api.openai.com/v1
EMBED_API_KEY=sk-xxx
EMBED_MODEL=text-embedding-3-small

# 文档处理
CHUNK_SIZE=800      # 分块大小
CHUNK_OVERLAP=150   # 重叠量
```

支持任何 OpenAI 兼容的 API 服务（如 DeepSeek、智谱、Ollama 等）。

---

## 项目结构

```
Socratess-window/
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   │   ├── chat.py        # 对话、搜索
│   │   │   ├── collections.py # 知识库 CRUD
│   │   │   ├── documents.py   # 文档上传/管理
│   │   │   └── system.py      # 系统状态/配置
│   │   ├── services/       # 核心服务
│   │   │   ├── rag_service.py     # RAG 编排
│   │   │   ├── llm_service.py     # LLM 调用
│   │   │   ├── embedding_service.py # Embedding
│   │   │   ├── document_service.py  # 文档解析
│   │   │   └── chunking_service.py  # 分块策略
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── config.py       # 配置管理
│   │   ├── database.py     # 数据库模型
│   │   └── main.py         # 入口
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Layout
│   │   ├── pages/          # HomePage, ChatPage, KnowledgeBasePage, SettingsPage
│   │   ├── services/       # API 调用层
│   │   └── types/          # TypeScript 类型
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## License

MIT
