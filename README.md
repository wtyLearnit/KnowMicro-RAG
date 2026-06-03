# 🪟 苏格拉底之窗 (Socrates' Window)

> 洞穴墙上的投影，经由理性之光折射，成为理念世界的入口。

**苏格拉底之窗** 是一个基于 RAG（检索增强生成）的智能学习系统。上传你的学习材料，与苏格拉底式的 AI 导师展开对话，让知识从被动接收变为主动发现。

---

## 架构概览

```
┌──────────────────────────────────────────┐
│              前端 (React)                 │
│   对话 · 知识库 · 设置 · 回收站 · 主题    │
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
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite | 三套主题（深邃蓝 / 晨光白 / 古宣纸） |
| 后端 | FastAPI + SQLAlchemy + ChromaDB | 异步 Python |
| LLM | OpenAI 兼容接口 | 可接入任何兼容服务 |
| Embedding | OpenAI 兼容接口 | text-embedding-3-small 等 |
| 混合检索 | BM25 + 语义搜索 + RRF + Cross-Encoder 重排序 | 多路召回融合 |
| 文档解析 | PyPDF2 / python-docx / markdown | PDF / DOCX / TXT / MD |
| 部署 | Docker Compose | 一键编排 |

---

## 快速开始

### 前置条件

- Python 3.11+
- Node.js 20+
- 可用的 LLM API Key（OpenAI 或兼容服务）

### 1. 克隆 & 配置

```bash
cd platos-window

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

| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:3000 |
| 后端 | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

---

## 核心功能

### 📚 知识库管理
- 创建多个知识库，每个知识库独立管理文档
- 支持 PDF、TXT、Markdown、DOCX 格式
- **拖拽上传** + 批量上传，带进度条
- 智能分块策略：递归分割、Markdown 感知、语义边界
- 文档内容预览（原文 + 分块视图）
- 归档 / 恢复 / 永久删除（回收站机制）

### 💬 对话系统
- 基于知识库内容的 RAG 问答
- **自由对话模式**：无需知识库，直接与 AI 对话
- **双模式切换**：苏格拉底式（引导追问） / 直接问答
- **SSE 流式输出**，逐字呈现回复
- 每次回答附带引用来源，可展开查看原文片段
- 对话历史持久化，支持多轮对话
- 可调节 Top-K 检索数量（3-20）

### ✏️ 对话管理
- **重命名对话**：内联编辑对话标题
- **编辑消息**：修改已发送的用户消息
- **删除消息**：删除消息及其后续回复
- **重新生成**：流式重新生成 AI 回复
- **分支对话**：从任意消息节点创建分支
- **导出对话**：一键复制完整对话为纯文本
- **孤立对话保护**：删除知识库时保留相关对话

### 🔍 混合检索
- **BM25 关键词检索**：中文分词（jieba）+ 英文分词
- **语义向量检索**：基于 ChromaDB 的余弦相似度搜索
- **RRF 融合**：倒数排位融合，平衡关键词与语义权重
- **Cross-Encoder 重排序**：BGE-Reranker 精排候选片段
- **查询重写**：自动将对话上下文转为独立检索查询
- 跨知识库或知识库内语义搜索

### 🗑️ 回收站
- 知识库、文档、对话的归档保护（软删除）
- 恢复或永久删除已归档内容
- 30 天自动清理策略

### 🎨 三套主题
- **深邃蓝 (Cosmos)**：暗色学术风，带星空动画背景
- **晨光白 (Light)**：明亮简洁风
- **古宣纸 (Xuan)**：仿古宣纸色系，方正仿宋字体

### 🧠 苏格拉底式系统提示词

苏格拉底的教学之道内置于系统提示词中：
- **追问而非灌输**：层层递进的问题引导发现
- **从具体升到抽象**：连接底层原理
- **跨域联结**：数学-音乐、物理-哲学之间的隐喻
- **知晓无知**：诚实面对不确定性
- **对话式节奏**：有温度、有停顿、有留白

---

## API 端点

### 知识库

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/collections` | 列出所有知识库 |
| POST | `/api/collections` | 创建知识库 |
| GET | `/api/collections/{id}` | 获取单个知识库 |
| PATCH | `/api/collections/{id}` | 更新知识库 |
| POST | `/api/collections/{id}/archive` | 归档知识库（软删除） |
| POST | `/api/collections/{id}/restore` | 恢复知识库 |
| DELETE | `/api/collections/{id}/permanent` | 永久删除知识库 |

### 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/documents/upload/{collection_id}` | 上传单个文档 |
| POST | `/api/documents/upload-batch/{collection_id}` | 批量上传文档 |
| GET | `/api/documents/collection/{collection_id}` | 列出知识库文档 |
| GET | `/api/documents/{id}` | 获取文档预览（原文 + 分块） |
| POST | `/api/documents/{id}/archive` | 归档文档 |
| POST | `/api/documents/{id}/restore` | 恢复文档 |
| DELETE | `/api/documents/{id}/permanent` | 永久删除文档 |

### 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat` | RAG 对话（非流式） |
| POST | `/api/chat/stream` | RAG 对话（SSE 流式） |
| GET | `/api/conversations/{collection_id}` | 对话列表 |
| GET | `/api/conversations/free` | 自由对话列表 |
| GET | `/api/conversations/orphaned` | 孤立对话列表 |
| GET | `/api/conversations/{collection_id}/{conv_id}` | 获取对话消息 |
| PATCH | `/api/conversations/{collection_id}/{conv_id}` | 重命名对话 |
| POST | `/api/conversations/{collection_id}/{conv_id}/archive` | 归档对话 |
| PUT | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}` | 编辑消息 |
| DELETE | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}` | 删除消息及后续 |
| POST | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}/regenerate` | 重新生成回复（SSE） |
| POST | `/api/conversations/{collection_id}/{conv_id}/branch` | 分支对话 |

### 搜索

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/search` | 语义搜索 |

### 回收站

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/trash` | 列出所有归档项 |
| POST | `/api/trash/collections/{id}/restore` | 恢复归档知识库 |
| POST | `/api/trash/documents/{id}/restore` | 恢复归档文档 |
| POST | `/api/trash/conversations/{id}/restore` | 恢复归档对话 |
| DELETE | `/api/trash/collections/{id}` | 永久删除知识库 |
| DELETE | `/api/trash/documents/{id}` | 永久删除文档 |
| DELETE | `/api/trash/conversations/{id}` | 永久删除对话 |

### 系统

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/system/stats` | 系统统计 |
| GET | `/api/system/config` | 系统配置 |
| GET | `/api/system/health` | 健康检查 |

---

## 配置参考

所有配置通过环境变量管理，见 `backend/.env.example`：

```env
# LLM（问答模型）
LLM_API_BASE=https://api.openai.com/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o-mini
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.7

# Embedding（向量化模型）
EMBED_API_BASE=https://api.openai.com/v1
EMBED_API_KEY=sk-your-key-here
EMBED_MODEL=text-embedding-3-small
EMBED_DIMENSIONS=1536
EMBED_BATCH_SIZE=10
EMBED_MAX_RETRIES=3

# 数据库
DATABASE_URL=sqlite+aiosqlite:///./data/Socratess_window.db
CHROMA_PERSIST_DIR=./data/chroma

# 服务器
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# 文档处理
CHUNK_SIZE=800
CHUNK_OVERLAP=150
MAX_DOCUMENT_SIZE_MB=50
```

支持任何 OpenAI 兼容的 API 服务（如 DeepSeek、智谱、阿里云 DashScope、Ollama 等）。

---

## 项目结构

```
platos-window/
├── docker-compose.yml
├── README.md
├── PROJECT.md
├── backend/
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/                       # 运行时数据（SQLite + ChromaDB）
│   └── app/
│       ├── main.py                 # FastAPI 入口
│       ├── config.py               # 配置管理
│       ├── database.py             # 数据库模型 & 迁移
│       ├── api/
│       │   ├── chat.py             # 对话 / 搜索 / 对话管理
│       │   ├── collections.py      # 知识库 CRUD + 归档
│       │   ├── documents.py        # 文档上传 / 管理 / 预览
│       │   ├── system.py           # 系统状态 / 配置
│       │   └── trash.py            # 回收站
│       ├── schemas/
│       │   └── schemas.py          # Pydantic 模型
│       └── services/
│           ├── rag_service.py      # RAG 编排 + 混合检索
│           ├── llm_service.py      # LLM 调用 + 查询重写
│           ├── embedding_service.py # Embedding 调用
│           ├── document_service.py  # 文档解析
│           ├── chunking_service.py  # 分块策略
│           ├── bm25_service.py      # BM25 关键词检索
│           ├── reranker_service.py  # Cross-Encoder 重排序
│           └── exceptions.py        # 自定义异常
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                  # 路由定义
        ├── main.tsx                 # 入口
        ├── index.css                # 全局样式 + 三套主题
        ├── components/
        │   ├── Layout.tsx           # 侧边栏布局（可折叠）
        │   ├── ThemeContext.tsx      # 主题上下文
        │   └── StarField.tsx        # 星空动画背景
        ├── pages/
        │   ├── HomePage.tsx         # 首页仪表板
        │   ├── ChatPage.tsx         # 对话页面（三栏可拖拽布局）
        │   ├── KnowledgeBasePage.tsx # 知识库管理
        │   ├── SettingsPage.tsx     # 系统设置（四分区）
        │   └── TrashPage.tsx        # 回收站
        ├── services/
        │   └── api.ts               # API 调用层
        └── types/
            └── index.ts             # TypeScript 类型定义
```

---

## 扩展路线

- [ ] **知识图谱**：从文档中抽取实体关系，可视化概念网络
- [ ] **间隔复习**：基于艾宾浩斯遗忘曲线的智能复习推送
- [ ] **多模态**：图片、视频、音频内容的理解与检索
- [ ] **协作学习**：多用户知识库共享与讨论
- [ ] **学习分析**：学习进度追踪、知识掌握度评估
- [ ] **本地模型**：接入 Ollama 等本地 LLM/Embedding
- [ ] **多语言增强**：跨语言检索与翻译辅助
- [ ] **自定义系统提示词**：前端界面编辑苏格拉底的人格

---

## License

MIT
