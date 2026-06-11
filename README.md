<p align="center">
  <h1 align="center">KnowMicro<br><sub>知微</sub></h1>
</p>

<p align="center">
  <em>见微知著，从文档细节中发现知识。</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/python-3.11+-green.svg" alt="Python"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-20+-green.svg" alt="Node"></a>
  <a href="#"><img src="https://img.shields.io/badge/react-18-61dafb.svg" alt="React"></a>
</p>

---

一个基于 **RAG**（检索增强生成）的智能知识问答系统。上传学习材料，通过混合检索（BM25 + 语义向量 + RRF 融合 + Cross-Encoder 重排序）精准定位相关内容，让 AI 基于你的文档生成准确、有据可查的回答。

> 🚀 全程使用 **Claude Code（AI Agent）** 进行 Vibe Coding 协作开发，30+ 次 Git 提交均由人机对话驱动完成。

---

## 目录

- [✨ 功能](#-功能)
- [🔍 RAG 核心流水线](#-rag-核心流水线)
- [🏗️ 架构](#️-架构)
- [🚀 快速开始](#-快速开始)
- [⚙️ 配置](#️-配置)
- [🔒 部署安全](#-部署安全)
- [📁 项目结构](#-项目结构)
- [📄 许可证](#-许可证)

---

## ✨ 功能

### 🔍 混合检索（核心）
- BM25 关键词检索（jieba 中文分词）
- 语义向量检索（ChromaDB 余弦相似度 + HNSW 索引）
- RRF 融合 + Cross-Encoder 重排序（BGE-Reranker）
- 查询重写：对话上下文 → 独立检索查询
- 网络搜索集成（DuckDuckGo / Tavily / Brave / Serper）

### 📚 知识库管理
- 多知识库独立管理，支持 PDF / DOCX / TXT / Markdown / PPTX
- 拖拽上传 + 批量上传，带进度反馈
- 智能分块：递归分割、Markdown 感知、语义边界
- 文档预览（原文 + 分块视图）
- 归档 / 恢复 / 永久删除（回收站保护）

### 💬 对话系统
- 基于知识库的 RAG 问答 + 自由对话（无需知识库）
- **双模式**：直接问答 / 苏格拉底式引导（促进深度思考）
- SSE 流式输出，逐字呈现
- 引用来源可展开查看原文片段
- 多轮对话持久化，Top-K 检索数量可调

### ✏️ 对话管理
- 重命名 / 编辑消息 / 删除消息及后续
- 重新生成回复（流式）
- 从任意消息节点**分支对话**
- 一键复制完整对话为纯文本
- 删除知识库时保留关联对话（孤立保护）

### 📅 日程管理
- 周视图 + 月视图日历
- 任务面板：拖拽任务到时间表自动创建日程
- 事件块支持拖拽移动（跨天）+ 拉伸调整时长
- 时间冲突检测，防止重叠
- 课表导入（Excel）

### 🎨 五套主题
- **深邃蓝 (Cosmos)** — 暗色学术风，星空动画背景
- **晨光白 (Light)** — 明亮简洁
- **古宣纸 (Xuan)** — 仿古宣纸色系，方正仿宋
- **松林绿 (Forest)** — 清新自然
- **暖玫瑰 (Rose)** — 温暖柔和

### ⚙️ 在线配置
- 前端设置页面直接管理 LLM / Embedding / Web Search 配置
- 支持 OpenAI / DeepSeek / 智谱 / 阿里云 DashScope / Ollama 等所有兼容接口
- 无需修改 `.env` 文件，API Key 加密存储

---

## 🔍 RAG 核心流水线

```
用户输入问题
    │
    ▼
┌─────────────────┐
│  查询重写 (LLM)  │  多轮对话 → 独立检索查询
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│语义检索 │ │BM25检索│
│ChromaDB│ │jieba   │
└────┬───┘ └────┬───┘
     └────┬────┘
          ▼
┌─────────────────┐
│   RRF 融合       │  semantic=0.7, bm25=0.3
└────────┬────────┘
         ▼
┌─────────────────┐
│ Cross-Encoder   │  BGE-Reranker-v2-m3
│ 重排序           │  top-20 → top-k
└────────┬────────┘
         ▼
┌─────────────────┐
│ 上下文构建 + LLM │  流式生成 → SSE 推送
└─────────────────┘
```

**降级设计**：每个组件都有 Plan B
- BM25 不可用 → 纯语义检索
- 重排序失败 → 返回 RRF 原始排序
- 查询重写失败 → 使用原始消息

---

## 🏗️ 架构

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

| 层 | 技术 |
|---|---|
| 前端 | React 18 · TypeScript · Tailwind CSS · Vite · Framer Motion |
| 后端 | FastAPI · SQLAlchemy 2.0 (async) · ChromaDB · Alembic |
| LLM | OpenAI 兼容接口（支持任意兼容服务） |
| Embedding | OpenAI 兼容接口 |
| 检索 | BM25 (jieba) + 语义搜索 + RRF + Cross-Encoder |
| 文档 | PyPDF2 · python-docx · python-pptx · markdown |
| 部署 | Docker Compose · GitHub Actions CI/CD |

---

## 🚀 快速开始

### 前提

- Python 3.11+
- Node.js 20+
- LLM API Key（OpenAI 兼容）

### 本地启动

```bash
# 1. 克隆仓库
git clone https://github.com/wtyLearnit/KnowMicro.git
cd KnowMicro

# 2. 配置环境变量
cp backend/.env.example backend/.env
# （可选）编辑 backend/.env 填入 API Key，也可跳过，通过前端设置页面在线配置

# 3. 启动后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 4. 另一个终端，启动前端
cd frontend
npm install
npm run dev
```

| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| Swagger 文档 | http://localhost:8000/docs |

### 配置 LLM

打开前端 → 左侧 **设置** → **模型配置** → 添加 LLM 和 Embedding。首次启动数据库为空，所有配置通过前端页面完成。

### Docker

```bash
cp backend/.env.example backend/.env
docker compose up -d
```

| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:3000 |
| 后端 | http://localhost:8000 |

---

## ⚙️ 配置

所有环境变量见 `backend/.env.example`，关键项：

```bash
# LLM（也通过前端设置页面配置，优先级更高）
LLM_API_BASE=https://api.openai.com/v1
LLM_API_KEY=sk-your-key-here

# Embedding
EMBED_API_BASE=https://api.openai.com/v1
EMBED_API_KEY=sk-your-key-here

# 检索开关
HYBRID_SEARCH_ENABLED=true
RERANKER_ENABLED=true          # 首次启动下载约 1.2GB 模型
QUERY_REWRITE_ENABLED=true
```

---

## 🔒 部署安全

部署到公网时，必须在 `backend/.env` 中设置：

```bash
SECRET_KEY=你的随机字符串    # 用于加密数据库中的 API Key
API_TOKEN=你的访问令牌       # API 认证令牌
```

然后在浏览器控制台设置前端令牌：

```js
localStorage.setItem('api_token', '你的访问令牌')
```

> ⚠️ 不设置 `API_TOKEN` 时后端不做认证校验，**仅适合本地开发**。

---

## 📁 项目结构

```
knowmicro/
├── docker-compose.yml
├── backend/
│   ├── .env.example              # 环境变量模板
│   ├── requirements.txt
│   ├── data/                     # 运行时数据（gitignored）
│   └── app/
│       ├── main.py               # FastAPI 入口
│       ├── config.py             # 配置管理
│       ├── database.py           # ORM 模型 + 迁移
│       ├── api/                  # 路由层
│       ├── schemas/              # Pydantic 模型
│       └── services/             # 业务逻辑
└── frontend/
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── pages/                # 页面组件
        ├── components/           # 通用组件
        ├── services/             # API 调用层
        └── types/                # TypeScript 类型
```

---

## 📄 许可证

[MIT](LICENSE)
