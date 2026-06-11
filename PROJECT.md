# KnowMicro (知微) — 项目说明文档

> 见微知著，从文档细节中发现知识。

**版本**: 0.1.0 | **许可证**: MIT | **语言**: Python 3.11+ / TypeScript + React 18

---

## 一、项目概述

**KnowMicro** 是一个基于 RAG（检索增强生成）的智能知识问答系统。用户上传学习材料后，系统通过混合检索（BM25 + 语义向量 + RRF 融合 + Cross-Encoder 重排序）精准定位相关内容，让 AI 基于检索结果生成准确、有据可查的回答。

### 核心特性

- **RAG 混合检索**: BM25 关键词检索 + 语义向量检索 + RRF 融合 + Cross-Encoder 重排序 + 查询重写
- **知识库管理**: 创建多个独立知识库，支持 PDF、DOCX、TXT、Markdown、PPTX 格式，拖拽上传 + 批量上传
- **双模式对话**: RAG 问答 + 直接问答 + 苏格拉底式引导（促进深度思考）+ 自由对话
- **网络搜索集成**: 4 种可插拔后端（DuckDuckGo / Tavily / Brave / Serper）
- **对话管理**: 编辑消息、删除消息、重新生成回复、分支对话、导出对话、重命名对话
- **回收站**: 知识库 / 文档 / 对话的归档保护，支持恢复和永久删除，30 天自动清理
- **五套主题**: 深邃蓝 (Cosmos) / 晨光白 (Light) / 古宣纸 (Xuan) / 松林绿 (Forest) / 暖玫瑰 (Rose)
- **对话持久化**: 多轮对话历史存储，孤立对话保护

---

## 二、技术架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────┐
│                  前端 (React 18)                   │
│  HomePage · ChatPage · KnowledgeBasePage          │
│  SettingsPage · TrashPage · CalendarPage          │
│  ThemeContext · StarField · Layout (可折叠侧栏)    │
└────────────────────┬─────────────────────────────┘
                     │ REST / SSE (流式)
┌────────────────────┴─────────────────────────────┐
│                后端 (FastAPI)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ RAG 服务  │ │ 文档服务  │ │ LLM 服务 │          │
│  │ · 混合检索│ │ · 解析    │ │ · 对话    │          │
│  │ · RRF融合 │ │ · 分块    │ │ · 查询重写│          │
│  │ · 重排序  │ │ · 预览    │ │ · 流式    │          │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘          │
│        │           │            │                  │
│  ┌─────┴───────────┴────────────┴─────┐           │
│  │ ChromaDB (向量)  │ SQLite (元数据)  │           │
│  │ BM25 索引 (JSON) │ 归档/迁移支持    │           │
│  └────────────────────────────────────┘           │
└──────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| 前端框架 | React + TypeScript | 18.3+ | 函数组件 + Hooks |
| 构建工具 | Vite | 6.0+ | 开发代理到后端 8000 |
| CSS | Tailwind CSS | 3.4+ | 自定义五套主题 |
| 动画 | Framer Motion | 12.40+ | 消息动画、页面过渡 |
| 图标 | Lucide React | 0.468+ | 统一图标库 |
| Markdown | react-markdown | 9.0+ | AI 回复 Markdown 渲染 |
| 布局 | react-resizable-panels | 4.11+ | 对话页三栏可拖拽布局 |
| 后端框架 | FastAPI | 0.115+ | 异步 Python Web |
| ASGI | Uvicorn | 0.34+ | 服务器 |
| 数据校验 | Pydantic + pydantic-settings | 2.10+ / 2.7+ | 请求校验 + 配置管理 |
| ORM | SQLAlchemy | 2.0+ | 异步引擎 (aiosqlite) |
| 向量数据库 | ChromaDB | 1.5+ | 余弦相似度 + HNSW 索引 |
| HTTP 客户端 | httpx | 0.28+ | 异步 LLM/Embedding API 调用 |
| 文档解析 | PyPDF2 / python-docx / python-pptx / markdown | - | 5 种格式支持 |
| 分词 | jieba | 0.42+ | BM25 中文分词 |
| BM25 | rank-bm25 | 0.2+ | 关键词检索 |
| 重排序 | sentence-transformers | 3.3+ | BGE-Reranker-v2-m3 |
| Token 计数 | tiktoken | 0.8+ | OpenAI tokenizer |
| 流式 | sse-starlette | 2.2+ | SSE 事件推送 |
| 加密 | cryptography | 41+ | Fernet API Key 加密 |
| 部署 | Docker Compose + GitHub Actions | 3.8 | 多服务编排 + CI/CD |

### 2.3 数据存储

| 存储 | 用途 | 位置 |
|---|---|---|
| SQLite | 元数据（知识库、文档、对话、消息、归档状态） | `backend/data/knowmicro.db` |
| ChromaDB | 向量数据（文档分块的 embedding） | `backend/data/chroma/` |
| BM25 索引 | 关键词检索倒排索引（JSON 持久化） | `backend/data/chroma/bm25_{collection_id}.json` |

---

## 三、项目结构

```
knowmicro/
├── docker-compose.yml                   # Docker 编排
├── README.md                            # 用户文档
├── PROJECT.md                           # 技术文档（本文件）
├── backend/
│   ├── .env                             # 环境变量配置
│   ├── .env.example                     # 环境变量模板
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/                            # 运行时数据（SQLite + ChromaDB + BM25）
│   └── app/
│       ├── main.py                      # FastAPI 入口（CORS、异常处理、路由注册）
│       ├── config.py                    # 配置管理（pydantic-settings）
│       ├── database.py                  # 数据库模型、迁移、会话管理
│       ├── api/
│       │   ├── chat.py                  # 对话 & 搜索 & 对话管理路由（3 个 Router）
│       │   ├── collections.py           # 知识库 CRUD + 归档/恢复/永久删除
│       │   ├── documents.py             # 文档上传/批量上传/预览/归档
│       │   ├── model_configs.py         # 模型配置管理
│       │   ├── schedule.py              # 日程管理路由
│       │   ├── system.py                # 系统状态/配置/健康检查
│       │   └── trash.py                 # 回收站（查看/恢复/永久删除）
│       ├── schemas/
│       │   └── schemas.py               # Pydantic 模型（请求/响应/回收站）
│       └── services/
│           ├── rag_service.py           # RAG 编排：混合检索 + RRF 融合 + 重排序
│           ├── llm_service.py           # LLM 调用：回复生成 + 查询重写
│           ├── embedding_service.py      # Embedding 调用（批处理 + 重试）
│           ├── document_service.py       # 文档解析（PDF/DOCX/TXT/MD/PPTX）
│           ├── chunking_service.py       # 分块策略（递归/Markdown/语义）
│           ├── bm25_service.py           # BM25 关键词检索 + jieba 分词
│           ├── reranker_service.py       # Cross-Encoder 重排序
│           ├── web_search_service.py     # 网络搜索（4 种后端）
│           ├── schedule_service.py       # 日程管理业务逻辑
│           ├── vector_store.py           # 向量存储抽象基类
│           └── exceptions.py            # 自定义异常 + API 错误提取
└── frontend/
    ├── Dockerfile                       # 多阶段构建
    ├── nginx.conf                       # SPA 路由 + /api 代理 + SSE 支持
    ├── package.json
    ├── vite.config.ts                   # 开发服务器（代理 /api → localhost:8000）
    └── src/
        ├── App.tsx                      # 路由定义（5 个页面）
        ├── main.tsx                     # React 入口（BrowserRouter + ThemeProvider）
        ├── index.css                    # 全局样式 + 五套 CSS 主题
        ├── components/
        │   ├── Layout.tsx               # 可折叠侧边栏 + 响应式 overlay 菜单
        │   ├── ThemeContext.tsx          # 主题管理（5 套主题）
        │   ├── StarField.tsx            # Canvas 星空动画背景
        │   ├── chat/                    # 对话相关组件
        │   ├── knowledge/               # 知识库相关组件
        │   ├── schedule/                # 日程管理组件（13 个）
        │   └── settings/                # 设置相关组件
        ├── pages/
        │   ├── HomePage.tsx             # 首页仪表板
        │   ├── ChatPage.tsx             # 对话页面（三栏可拖拽布局）
        │   ├── KnowledgeBasePage.tsx     # 知识库管理
        │   ├── SettingsPage.tsx         # 系统设置
        │   ├── TrashPage.tsx            # 回收站
        │   └── CalendarPage.tsx         # 日程管理
        ├── services/
        │   └── api.ts                   # API 调用层（Axios + SSE fetch）
        └── types/
            └── index.ts                 # TypeScript 类型定义
```

---

## 四、数据库设计

### 4.1 ER 关系

```
Collection (知识库)
    ├── 1:N ── Document (文档)
    └── 1:N ── Conversation (对话)
                    └── 1:N ── Message (消息)

Schedule (日程)
Task (任务)
Course (课程)
ModelConfig (模型配置)
```

### 4.2 表结构

#### Collection (知识库) — `collections`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(36) PK | UUID 主键 |
| `name` | String(256) UNIQUE | 名称 |
| `description` | Text | 描述 |
| `icon` | String(64) | 图标 emoji，默认 "📚" |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 (ON UPDATE) |
| `is_archived` | Integer | 归档标记 (0/1) |
| `archived_at` | DateTime nullable | 归档时间 |

#### Document (文档) — `documents`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(36) PK | UUID 主键 |
| `collection_id` | String(36) FK | 所属知识库 (CASCADE) |
| `filename` | String(512) | 文件名 |
| `file_type` | String(32) | 类型: pdf / txt / md / docx / pptx |
| `file_size` | Integer | 文件大小（字节） |
| `chunk_count` | Integer | 分块数量 |
| `status` | String(32) | 状态: processing / ready / error |
| `error_message` | Text nullable | 错误信息 |
| `content` | Text | 提取的文本内容 |
| `file_path` | String(1024) | 原始文件磁盘路径 |
| `is_archived` | Integer | 归档标记 (0/1) |
| `archived_at` | DateTime nullable | 归档时间 |
| `created_at` | DateTime | 创建时间 |

#### Conversation (对话) — `conversations`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(36) PK | UUID 主键 |
| `collection_id` | String(36) FK nullable | 所属知识库 (SET NULL) |
| `title` | String(512) | 对话标题，默认 "新对话" |
| `model_used` | String(128) | 模型标识: "rag" / "llm" |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 (ON UPDATE) |
| `is_orphaned` | Integer | 孤立标记（知识库已删除）(0/1) |
| `is_archived` | Integer | 归档标记 (0/1) |
| `archived_at` | DateTime nullable | 归档时间 |

#### Message (消息) — `messages`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(36) PK | UUID 主键 |
| `conversation_id` | String(36) FK | 所属对话 (CASCADE) |
| `role` | String(32) | 角色: user / assistant / system |
| `content` | Text | 消息内容 |
| `sources` | JSON | 引用来源列表 |
| `token_count` | Integer | Token 数量 |
| `created_at` | DateTime | 创建时间 |

---

## 五、功能说明

### 5.1 RAG 混合检索系统（核心）

**前端入口**: `/chat/:collectionId?`

#### 检索管道

```
用户查询 → 查询重写 → ┬─ 语义检索 (ChromaDB) ─┐
                      └─ BM25 检索 (jieba) ────┤
                                               ↓
                                          RRF 融合
                                               ↓
                                      Cross-Encoder 重排序
                                               ↓
                                          Top-K 结果
```

#### 配置参数

| 参数 | 默认值 | 说明 |
|---|---|---|
| `HYBRID_SEARCH_ENABLED` | True | 是否启用混合检索 |
| `BM25_WEIGHT` | 0.3 | BM25 在 RRF 中的权重 |
| `SEMANTIC_WEIGHT` | 0.7 | 语义检索在 RRF 中的权重 |
| `RERANKER_ENABLED` | True | 是否启用重排序 |
| `RERANKER_MODEL` | BAAI/bge-reranker-v2-m3 | 重排序模型 |
| `RERANKER_TOP_N` | 20 | 送入重排序的候选数 |
| `QUERY_REWRITE_ENABLED` | True | 是否启用查询重写 |
| `RETRIEVAL_TOP_K` | 20 | 检索召回数量 |

#### 降级策略

- BM25 索引未就绪 → 纯语义检索
- Cross-Encoder 加载失败 → 返回 RRF 原始排序
- 查询重写失败 → 使用原始用户消息

#### RRF (Reciprocal Rank Fusion)

```
RRF_score(d) = Σ wᵢ / (k + rankᵢ(d))

其中 k = 60，w_semantic = 0.7，w_bm25 = 0.3
```

### 5.2 知识库管理

**前端入口**: `/knowledge`

#### 文档处理流程

```
上传文件
  → 大小校验（50MB 上限）
  → 解析文档（按扩展名选择解析器）
  → 智能分块（800 字符/块，150 字符重叠，过滤 ≤10 字符碎片）
  → Embedding 向量化（批量调用 API，10 条/批，带重试）
  → 存入 ChromaDB（余弦距离）
  → 建立 BM25 索引（jieba 分词）
  → 更新文档状态为 "ready"
```

#### 分块策略

| 策略 | 适用场景 | 说明 |
|---|---|---|
| 递归字符分割 | 通用回退 | 按段落 → 换行 → 句号 → 短语 → 空格逐级分割 |
| Markdown 感知分割 | .md 文件 | 按 # / ## / ### 标题层级分割，保持结构 |
| 语义边界分割 | .txt / .pdf 首选 | 按中英文句子边界分割，保持语义连贯 |

### 5.3 对话系统

**前端入口**: `/chat/:collectionId?`

#### 对话模式

| 模式 | 说明 | RAG 检索 |
|---|---|---|
| 直接问答 (direct) | 基于知识库内容直接回答 | ✅ |
| 苏格拉底式 (socratic) | 以追问引导发现，促进深度思考 | ✅ |
| 自由对话 (free) | 无知识库，直接与 AI 对话 | ❌ |

#### 对话流程

```
用户输入消息
  → 保存用户消息到数据库
  → 查询重写（将对话上下文转为独立检索查询，可关闭）
  → 混合检索：
      ├── 语义检索（ChromaDB 余弦相似度，top-20）
      ├── BM25 关键词检索（jieba 分词，top-20）
      └── RRF 融合（semantic 0.7 + BM25 0.3）
  → Cross-Encoder 重排序（BGE-Reranker-v2-m3，top-20 → top-k）
  → 构建上下文（最多 top-k 个片段，含文档名和内容）
  → 连同系统提示词 + 历史对话（最近 20 条） + 上下文发送给 LLM
  → SSE 流式返回 AI 回复
  → 保存 AI 消息（含引用来源 + token 数）到数据库
```

#### SSE 流式事件

| 事件类型 | 数据格式 | 说明 |
|---|---|---|
| `chunk` | `{"type":"chunk","content":"..."}` | 文本片段 |
| `sources` | `{"type":"sources","sources":[...]}` | 引用来源列表 |
| `error` | `{"type":"error","message":"..."}` | 错误信息 |
| `done` | `{"type":"done","conversation_id":"..."}` | 流结束 |

### 5.4 对话管理增强

| 功能 | 前端入口 | 后端端点 | 说明 |
|---|---|---|---|
| 重命名对话 | 内联编辑标题 | PATCH conversations | Enter/Blur/Escape 确认 |
| 编辑消息 | 消息旁编辑按钮 | PUT messages/{id} | 编辑用户消息内容 |
| 删除消息 | 消息旁删除按钮 | DELETE messages/{id} | 删除该消息及所有后续消息 |
| 重新生成回复 | AI 消息旁重新生成按钮 | POST messages/{id}/regenerate | SSE 流式，替换现有 AI 回复 |
| 分支对话 | AI 消息旁分支按钮 | POST conversations/{id}/branch | 复制历史到新对话，从该节点继续 |

### 5.5 网络搜索集成

**后端**: `web_search_service.py`

| 后端 | 类型 | 是否需要 API Key |
|---|---|---|
| DuckDuckGo (via ddgs) | 免费元搜索 | 否（默认） |
| Tavily | AI 优化搜索 | 是 |
| Brave Search | 隐私搜索引擎 | 是 |
| Serper | Google 搜索结果 | 是 |

知识库检索与网络搜索通过 `asyncio.gather` 并行执行，结果以 `## 🌐 网络搜索结果` 格式注入上下文。

### 5.6 回收站

**前端入口**: `/trash`

- 知识库、文档、对话的归档保护（软删除，非物理删除）
- 恢复 / 永久删除
- 永久删除时清理 ChromaDB 向量数据和 BM25 索引
- 30 天自动清理策略

### 5.7 主题系统

**前端入口**: `/settings` → 外观 Tab

| 主题 | 特点 |
|---|---|
| 深邃蓝 (cosmos) | 暗色学术风，Canvas 星空动画背景，玻璃拟态 |
| 晨光白 (light) | 明亮简洁，柔和阴影 |
| 古宣纸 (xuan) | 宣纸黄底，方正仿宋字体，书卷气质 |
| 松林绿 (forest) | 清新自然 |
| 暖玫瑰 (rose) | 温暖柔和 |

### 5.8 系统设置

**前端入口**: `/settings`

四个分区 Tab：

1. **外观**: 五套主题选择器（含色板预览）
2. **系统配置**: 只读展示 LLM 模型、Embedding 模型、分块参数、检索开关
3. **系统状态**: 统计面板（知识库数、文档数、向量片段数、对话数）
4. **系统提示词**: 只读展示提示词内容

---

## 六、API 端点

### 6.1 知识库

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/collections` | 列出所有非归档知识库 |
| `POST` | `/api/collections` | 创建知识库 |
| `GET` | `/api/collections/{id}` | 获取单个知识库 |
| `PATCH` | `/api/collections/{id}` | 更新知识库 |
| `POST` | `/api/collections/{id}/archive` | 归档知识库 |
| `POST` | `/api/collections/{id}/restore` | 恢复知识库 |
| `DELETE` | `/api/collections/{id}/permanent` | 永久删除知识库 |

### 6.2 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/documents/upload/{collection_id}` | 上传单个文档 |
| `POST` | `/api/documents/upload-batch/{collection_id}` | 批量上传文档 |
| `GET` | `/api/documents/collection/{collection_id}` | 列出知识库文档 |
| `GET` | `/api/documents/{id}` | 文档预览（原文 + 分块） |
| `POST` | `/api/documents/{id}/archive` | 归档文档 |
| `POST` | `/api/documents/{id}/restore` | 恢复文档 |
| `DELETE` | `/api/documents/{id}/permanent` | 永久删除文档 |

### 6.3 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/chat` | 非流式问答 |
| `POST` | `/api/chat/stream` | SSE 流式问答 |
| `GET` | `/api/conversations/{collection_id}` | 对话列表 |
| `GET` | `/api/conversations/free` | 自由对话列表 |
| `GET` | `/api/conversations/orphaned` | 孤立对话列表 |
| `GET` | `/api/conversations/{collection_id}/{conv_id}` | 获取对话消息 |
| `PATCH` | `/api/conversations/{collection_id}/{conv_id}` | 重命名对话 |
| `POST` | `/api/conversations/{collection_id}/{conv_id}/archive` | 归档对话 |
| `PUT` | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}` | 编辑消息 |
| `DELETE` | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}` | 删除消息及后续 |
| `POST` | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}/regenerate` | 重新生成回复 (SSE) |
| `POST` | `/api/conversations/{collection_id}/{conv_id}/branch` | 分支对话 |

### 6.4 搜索

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/search` | 语义搜索 |

### 6.5 回收站

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/trash` | 列出所有归档项 |
| `POST` | `/api/trash/collections/{id}/restore` | 恢复归档知识库 |
| `POST` | `/api/trash/documents/{id}/restore` | 恢复归档文档 |
| `POST` | `/api/trash/conversations/{id}/restore` | 恢复归档对话 |
| `DELETE` | `/api/trash/collections/{id}` | 永久删除知识库 |
| `DELETE` | `/api/trash/documents/{id}` | 永久删除文档 |
| `DELETE` | `/api/trash/conversations/{id}` | 永久删除对话 |

### 6.6 系统

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/system/stats` | 系统统计 |
| `GET` | `/api/system/config` | 非敏感配置 |
| `GET` | `/api/system/health` | 健康检查 |

**共计 40 个端点**，完整 Swagger 文档访问: `http://localhost:8000/docs`

---

## 七、配置说明

### 7.1 环境变量

所有配置通过 `backend/.env` 文件管理：

```env
# LLM（对话模型）
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
DATABASE_URL=sqlite+aiosqlite:///./data/knowmicro.db
CHROMA_PERSIST_DIR=./data/chroma

# 服务器
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# 文档处理
CHUNK_SIZE=800
CHUNK_OVERLAP=150
MAX_DOCUMENT_SIZE_MB=50

# 混合检索
HYBRID_SEARCH_ENABLED=true
BM25_WEIGHT=0.3
SEMANTIC_WEIGHT=0.7

# 重排序
RERANKER_ENABLED=true
RERANKER_MODEL=BAAI/bge-reranker-v2-m3
RERANKER_TOP_N=20

# 查询重写
QUERY_REWRITE_ENABLED=true
RETRIEVAL_TOP_K=20
```

### 7.2 兼容的 LLM/Embedding 服务

| 服务 | LLM_API_BASE | 说明 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | 官方 API |
| DeepSeek | `https://api.deepseek.com/v1` | 深度求索 |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | GLM 系列 |
| 阿里云 DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 通义系列 |
| 小米 MIMO | `https://token-plan-cn.xiaomimimo.com/v1` | mimo-v2.5-pro |
| Ollama | `http://localhost:11434/v1` | 本地模型 |

---

## 八、快速开始

### 8.1 前置条件

- Python 3.11+
- Node.js 20+
- 可用的 LLM API Key

### 8.2 本地启动

```bash
# 1. 配置后端
cd backend
cp .env.example .env
# 编辑 .env，填入 API Key

# 2. 安装后端依赖
pip install -r requirements.txt

# 3. 启动后端
uvicorn app.main:app --reload --port 8000

# 4. 安装前端依赖（另一个终端）
cd frontend
npm install

# 5. 启动前端
npm run dev
```

### 8.3 Docker 部署

```bash
# 确保已配置好 .env 中的 API Key
docker compose up -d
```

---

## 九、扩展路线

- [ ] **查询缓存**: 缓存高频查询的检索结果，减少 Cross-Encoder 推理延迟
- [ ] **ONNX 加速**: 将重排序模型转换为 ONNX 格式，提升推理速度
- [ ] **知识图谱**: 从文档中抽取实体关系，可视化概念网络
- [ ] **间隔复习**: 基于艾宾浩斯遗忘曲线的智能复习推送
- [ ] **多模态**: 图片、视频、音频内容的理解与检索
- [ ] **协作学习**: 多用户知识库共享与讨论
- [ ] **学习分析**: 学习进度追踪、知识掌握度评估
- [ ] **向量数据库迁移**: 迁移至 Milvus/Qdrant（已预留抽象接口）
- [ ] **自定义系统提示词**: 前端界面编辑提示词内容
- [ ] **回收站自动清理**: 后端定时任务清理超过 30 天的归档项
- [ ] **对话搜索**: 全文搜索历史对话内容
