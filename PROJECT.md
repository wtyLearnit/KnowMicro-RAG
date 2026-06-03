# 苏格拉底之窗 (Socrates' Window) — 项目说明文档

> 洞穴墙上的投影，经由理性之光折射，成为理念世界的入口。

**版本**: 0.1.0 | **许可证**: MIT | **语言**: Python 3.11+ / TypeScript + React 18

---

## 一、项目概述

**苏格拉底之窗** 是一个基于 RAG（检索增强生成）的智能学习系统。用户上传学习材料后，可与苏格拉底式的 AI 导师展开对话，实现从被动接收到主动发现的学习体验。

### 核心特性

- **知识库管理**: 创建多个独立知识库，支持 PDF、DOCX、TXT、Markdown 格式，拖拽上传 + 批量上传
- **苏格拉底式对话**: 基于知识库内容的 RAG 问答，流式输出，附带引用来源，支持双模式切换（苏格拉底式 / 直接问答）
- **自由对话模式**: 无需知识库，直接与 AI 对话
- **混合检索**: BM25 关键词 + 语义向量 + RRF 融合 + Cross-Encoder 重排序 + 查询重写
- **对话管理**: 编辑消息、删除消息、重新生成回复、分支对话、导出对话、重命名对话
- **回收站**: 知识库 / 文档 / 对话的归档保护，支持恢复和永久删除，30 天自动清理
- **三套主题**: 深邃蓝 (Cosmos) / 晨光白 (Light) / 古宣纸 (Xuan)
- **对话持久化**: 多轮对话历史存储，孤立对话保护

---

## 二、技术架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────┐
│                  前端 (React 18)                   │
│  HomePage · ChatPage · KnowledgeBasePage          │
│  SettingsPage · TrashPage                         │
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
| CSS | Tailwind CSS | 3.4+ | 自定义 cosmos 色系 + 三套主题 |
| 动画 | Framer Motion | 12.40+ | 消息动画、页面过渡 |
| 图标 | Lucide React | 0.468+ | 统一图标库 |
| Markdown | react-markdown | 9.0+ | AI 回复 Markdown 渲染 |
| 布局 | react-resizable-panels | 4.11+ | 对话页三栏可拖拽布局 |
| 后端框架 | FastAPI | 0.115+ | 异步 Python Web |
| ASGI | Uvicorn | 0.34+ | 服务器 |
| 数据校验 | Pydantic + pydantic-settings | 2.10+ / 2.7+ | 请求校验 + 配置管理 |
| ORM | SQLAlchemy | 2.0+ | 异步引擎 (aiosqlite) |
| 向量数据库 | ChromaDB | 1.5+ | 余弦相似度检索 |
| HTTP 客户端 | httpx | 0.28+ | 异步 LLM/Embedding API 调用 |
| 文档解析 | PyPDF2 / python-docx / markdown | - | PDF/DOCX/TXT/MD |
| 分词 | jieba | 0.42+ | BM25 中文分词 |
| BM25 | rank-bm25 | 0.2+ | 关键词检索 |
| 重排序 | sentence-transformers | 3.3+ | BGE-Reranker Cross-Encoder |
| Token 计数 | tiktoken | 0.8+ | OpenAI tokenizer |
| 流式 | sse-starlette | 2.2+ | SSE 事件推送 |
| 部署 | Docker Compose | 3.8 | 多服务编排 |

### 2.3 数据存储

| 存储 | 用途 | 位置 |
|---|---|---|
| SQLite | 元数据（知识库、文档、对话、消息、归档状态） | `backend/data/platos_window.db` |
| ChromaDB | 向量数据（文档分块的 embedding） | `backend/data/chroma/` |
| BM25 索引 | 关键词检索倒排索引（JSON 持久化） | `backend/data/chroma/bm25_{collection_id}.json` |

---

## 三、项目结构

```
platos-window/
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
│       │   ├── system.py                # 系统状态/配置/健康检查
│       │   └── trash.py                 # 回收站（查看/恢复/永久删除）
│       ├── schemas/
│       │   └── schemas.py               # Pydantic 模型（请求/响应/回收站）
│       └── services/
│           ├── rag_service.py           # RAG 编排：混合检索 + RRF 融合 + 重排序
│           ├── llm_service.py           # LLM 调用：回复生成 + 查询重写
│           ├── embedding_service.py      # Embedding 调用（批处理 + 重试）
│           ├── document_service.py       # 文档解析（PDF/DOCX/TXT/MD）
│           ├── chunking_service.py       # 分块策略（递归/Markdown/语义）
│           ├── bm25_service.py           # BM25 关键词检索 + jieba 分词
│           ├── reranker_service.py       # Cross-Encoder 重排序 (BGE-Reranker)
│           └── exceptions.py             # 自定义异常 + API 错误提取
└── frontend/
    ├── Dockerfile                       # 多阶段构建 (node:20-alpine → nginx:alpine)
    ├── nginx.conf                       # SPA 路由 + /api 代理 + SSE 支持
    ├── package.json
    ├── vite.config.ts                   # 开发服务器（代理 /api → localhost:8000）
    ├── tailwind.config.js               # 自定义 cosmos 色系 + 动画
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── App.tsx                      # 路由定义（5 个页面）
        ├── main.tsx                     # React 入口（BrowserRouter + ThemeProvider）
        ├── index.css                    # 全局样式 + 三套 CSS 主题 + 自定义组件层
        ├── components/
        │   ├── Layout.tsx               # 可折叠侧边栏 + 响应式 overlay 菜单
        │   ├── ThemeContext.tsx          # 主题管理（cosmos/light/xuan）
        │   └── StarField.tsx            # Canvas 星空动画背景（仅 cosmos 主题）
        ├── pages/
        │   ├── HomePage.tsx             # 首页仪表板：统计 + 最近知识库 + 快捷入口
        │   ├── ChatPage.tsx             # 对话页面：三栏可拖拽布局 + 完整对话管理
        │   ├── KnowledgeBasePage.tsx     # 知识库管理：拖拽上传 + 进度条 + 文档预览
        │   ├── SettingsPage.tsx         # 系统设置：主题/配置/状态/提示词四分区
        │   └── TrashPage.tsx            # 回收站：归档项浏览 + 恢复/永久删除
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
| `file_type` | String(32) | 类型: pdf / txt / md / docx |
| `file_size` | Integer | 文件大小（字节） |
| `chunk_count` | Integer | 分块数量 |
| `status` | String(32) | 状态: processing / ready / error |
| `error_message` | Text nullable | 错误信息 |
| `content` | Text | 提取的文本内容 |
| `metadata_` | JSON | 额外元数据（列名 "metadata"） |
| `is_archived` | Integer | 归档标记 (0/1) |
| `archived_at` | DateTime nullable | 归档时间 |
| `created_at` | DateTime | 创建时间 |

索引: `idx_document_collection` ON `collection_id`

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

索引: `idx_conversation_collection` ON `collection_id`

#### Message (消息) — `messages`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | String(36) PK | UUID 主键 |
| `conversation_id` | String(36) FK | 所属对话 (CASCADE) |
| `role` | String(32) | 角色: user / assistant / system |
| `content` | Text | 消息内容 |
| `sources` | JSON | 引用来源列表 [{doc_id, doc_name, chunk_text, score, chunk_index}] |
| `token_count` | Integer | Token 数量 |
| `created_at` | DateTime | 创建时间 |

### 4.3 数据库迁移

系统启动时自动执行增量迁移，无需手动操作：

1. **v0.1 迁移**: `conversations.collection_id` 从 NOT NULL 改为 NULLABLE（支持自由对话）
2. **归档迁移**: 向 `collections`、`documents`、`conversations` 添加 `is_archived`、`archived_at`、`is_orphaned` 列

---

## 五、功能说明

### 5.1 知识库管理

**前端入口**: `/knowledge`

#### 功能列表

| 功能 | 说明 |
|---|---|
| 创建知识库 | 输入名称、描述，56 个 emoji 图标可选 |
| 编辑知识库 | 修改名称、描述、图标 |
| 归档知识库 | 软删除，可选保留相关对话记录 |
| 恢复知识库 | 从回收站恢复 |
| 永久删除 | 级联删除所有文档、对话、消息及向量数据 |
| 上传文档 | 支持 PDF/DOCX/TXT/MD，上限 50MB |
| 批量上传 | 多个文件同时上传，队列依次处理 |
| 拖拽上传 | 拖拽文件到上传区域 |
| 上传进度 | 每个文件独立进度条，实时反馈 |
| 文档预览 | 原文内容 + 分块结果（分页导航） |
| 归档文档 | 软删除，同步清理或保留向量数据 |
| 文档状态跟踪 | processing → ready / error |

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

强制分割阈值：单块超过 6000 字符时进行强制二次分割。

### 5.2 对话系统

**前端入口**: `/chat/:collectionId?`

#### 对话模式

| 模式 | 说明 | RAG 检索 |
|---|---|---|
| 苏格拉底式 (socratic) | 以追问引导发现，不直接给出答案 | ✅ |
| 直接问答 (direct) | 基于知识库内容直接回答 | ✅ |
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

#### 苏格拉底式系统提示词

1. **苏格拉底式追问**: 用层层递进的问题引导发现，而非直接给出答案
2. **从具体升到抽象**: 将具体问题与底层原理联系起来
3. **跨域联结**: 指出当前知识与其它领域的同构关系
4. **知晓无知**: 遇到不确定的内容时坦然承认
5. **对话式节奏**: 每段回复像对话中的一个回合，有温度、有停顿、有留白

### 5.3 对话管理（5 项增强功能）

| 功能 | 前端入口 | 后端端点 | 说明 |
|---|---|---|---|
| 重命名对话 | 内联编辑标题 | PATCH conversations | Enter/Blur/Escape 确认 |
| 编辑消息 | 消息旁编辑按钮 | PUT messages/{id} | 编辑用户消息内容 |
| 删除消息 | 消息旁删除按钮 | DELETE messages/{id} | 删除该消息及所有后续消息 |
| 重新生成回复 | AI 消息旁重新生成按钮 | POST messages/{id}/regenerate | SSE 流式，替换现有 AI 回复 |
| 分支对话 | AI 消息旁分支按钮 | POST conversations/{id}/branch | 复制历史到新对话，从该节点继续 |
| 导出对话 | 顶部导出按钮 | (纯前端) | 一键复制完整对话为纯文本 |

### 5.4 混合检索系统

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

若混合检索不可用（BM25 索引未就绪、重排序模型加载失败等），自动降级为纯语义检索。

#### 相似度计算

ChromaDB 使用余弦距离（cosine distance），距离范围 `[0, 2]`：

```
similarity = 1 - distance / 2
```

- `similarity = 1.0`: 完全相同
- `similarity = 0.0`: 完全无关

#### RRF (Reciprocal Rank Fusion)

```
RRF_score(d) = Σ (1 / (k + rank_i(d)))
```

其中 `k = 60`，`rank_i(d)` 是文档 d 在第 i 个排序列表中的排名。

### 5.5 语义搜索

**入口**: `/api/search`

- 支持指定知识库内搜索或跨所有知识库搜索
- 返回 top-k 结果，包含文档名、片段内容、相关度评分
- 使用与对话相同的混合检索管道

### 5.6 回收站

**前端入口**: `/trash`

- 知识库、文档、对话的归档保护（软删除，非物理删除）
- 归类显示已归档项目，支持恢复和永久删除
- 永久删除时清理 ChromaDB 向量数据和 BM25 索引
- 30 天自动清理策略（前端提示，后端可在后续版本实现定时清理）

### 5.7 主题系统

**前端入口**: `/settings` → 外观 Tab

| 主题 | CSS 变量集 | 特点 |
|---|---|---|
| 深邃蓝 (cosmos) | 深蓝黑底 + 蓝色强调 | 默认主题，Canvas 星空动画背景，玻璃拟态 |
| 晨光白 (light) | 近白底 + 深蓝强调 | 明亮简洁，柔和阴影 |
| 古宣纸 (xuan) | 宣纸黄底 + 暖棕金 | 方正仿宋字体，书卷气质 |

主题选择持久化在 `localStorage`，通过 `<html data-theme>` 属性切换全局 CSS 变量。

### 5.8 系统设置

**前端入口**: `/settings`

四个分区 Tab：

1. **外观**: 三套主题选择器（含色板预览）
2. **系统配置**: 只读展示 LLM 模型、Embedding 模型、分块参数、检索开关
3. **系统状态**: 统计面板（知识库数、文档数、向量片段数、对话数）
4. **系统提示词**: 只读展示苏格拉底式提示词内容

---

## 六、API 端点

### 6.1 知识库

| 方法 | 路径 | 请求体 / 参数 | 说明 |
|---|---|---|---|
| `GET` | `/api/collections` | — | 列出所有非归档知识库 |
| `POST` | `/api/collections` | `{name, description?, icon?}` | 创建知识库 |
| `GET` | `/api/collections/{id}` | — | 获取单个知识库 |
| `PATCH` | `/api/collections/{id}` | `{name?, description?, icon?}` | 更新知识库 |
| `POST` | `/api/collections/{id}/archive` | `?keep_conversations=true` | 归档知识库 |
| `POST` | `/api/collections/{id}/restore` | — | 恢复知识库 |
| `DELETE` | `/api/collections/{id}/permanent` | — | 永久删除知识库 |

### 6.2 文档

| 方法 | 路径 | 请求体 / 参数 | 说明 |
|---|---|---|---|
| `POST` | `/api/documents/upload/{collection_id}` | FormData (file) | 上传单个文档 |
| `POST` | `/api/documents/upload-batch/{collection_id}` | FormData (files[]) | 批量上传文档 |
| `GET` | `/api/documents/collection/{collection_id}` | — | 列出知识库文档 |
| `GET` | `/api/documents/{id}` | — | 文档预览（原文 + 分块） |
| `POST` | `/api/documents/{id}/archive` | — | 归档文档 |
| `POST` | `/api/documents/{id}/restore` | — | 恢复文档 |
| `DELETE` | `/api/documents/{id}/permanent` | — | 永久删除文档 |

### 6.3 对话

| 方法 | 路径 | 请求体 / 参数 | 说明 |
|---|---|---|---|
| `POST` | `/api/chat` | `{collection_id?, message, conversation_id?, top_k?, mode?}` | 非流式问答 |
| `POST` | `/api/chat/stream` | 同上 | SSE 流式问答 |
| `GET` | `/api/conversations/{collection_id}` | — | 对话列表 |
| `GET` | `/api/conversations/free` | — | 自由对话列表 |
| `GET` | `/api/conversations/orphaned` | — | 孤立对话列表 |
| `GET` | `/api/conversations/{collection_id}/{conv_id}` | — | 获取对话消息 |
| `PATCH` | `/api/conversations/{collection_id}/{conv_id}` | `{title}` | 重命名对话 |
| `POST` | `/api/conversations/{collection_id}/{conv_id}/archive` | — | 归档对话 |
| `PUT` | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}` | `{content}` | 编辑消息 |
| `DELETE` | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}` | — | 删除消息及后续 |
| `POST` | `/api/conversations/{collection_id}/{conv_id}/messages/{msg_id}/regenerate` | `{mode?, top_k?}` | 重新生成回复 (SSE) |
| `POST` | `/api/conversations/{collection_id}/{conv_id}/branch` | — | 分支对话 |

### 6.4 搜索

| 方法 | 路径 | 请求体 / 参数 | 说明 |
|---|---|---|---|
| `POST` | `/api/search` | `{query, collection_id?, top_k?}` | 语义搜索 |

### 6.5 回收站

| 方法 | 路径 | 请求体 / 参数 | 说明 |
|---|---|---|---|
| `GET` | `/api/trash` | — | 列出所有归档项 |
| `POST` | `/api/trash/collections/{id}/restore` | — | 恢复归档知识库 |
| `POST` | `/api/trash/documents/{id}/restore` | — | 恢复归档文档 |
| `POST` | `/api/trash/conversations/{id}/restore` | — | 恢复归档对话 |
| `DELETE` | `/api/trash/collections/{id}` | — | 永久删除知识库 |
| `DELETE` | `/api/trash/documents/{id}` | — | 永久删除文档 |
| `DELETE` | `/api/trash/conversations/{id}` | — | 永久删除对话 |

### 6.6 系统

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/system/stats` | 系统统计（知识库/文档/向量/对话数） |
| `GET` | `/api/system/config` | 非敏感配置（模型、分块、检索开关） |
| `GET` | `/api/system/health` | 健康检查 `{"status": "ok"}` |

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

支持任何 OpenAI 兼容的 API 服务：

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

| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:3000 |
| 后端 | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

---

## 九、RAG 流水线详解

### 9.1 索引流程（文档上传时）

```
原始文档
  │
  ▼
┌────────────────┐
│  文档解析       │  PDF → PyPDF2 / DOCX → python-docx / TXT,MD → UTF-8
│  大小校验 50MB  │
└──────┬─────────┘
       │
       ▼
┌────────────────┐
│  智能分块       │  800 字符/块，150 字符重叠
│  过滤 ≤10 字符  │  强制分割 >6000 字符块
└──────┬─────────┘
       │
       ▼
┌────────────────────────────────┐
│  双路索引                       │
│  ├── Embedding → ChromaDB      │  批量 API 调用（10 条/批），带重试
│  └── jieba 分词 → BM25 索引    │  JSON 文件持久化
└────────────────────────────────┘
       │
       ▼
  文档状态 → "ready"
```

### 9.2 检索流程（对话时）

```
用户问题
  │
  ▼
┌──────────────────┐
│  查询重写          │  LLM 将对话上下文转为独立检索查询
│  (可配置关闭)      │  temperature=0.1, max_tokens=200
└──────┬───────────┘
       │
       ├──────────────────────────┐
       ▼                          ▼
┌──────────────┐          ┌──────────────┐
│  语义检索      │          │  BM25 检索    │
│  ChromaDB     │          │  jieba 分词   │
│  top-20       │          │  top-20       │
└──────┬───────┘          └──────┬───────┘
       │                         │
       └─────────┬───────────────┘
                 ▼
       ┌─────────────────┐
       │  RRF 融合        │  倒数排位融合
       │  k=60           │  semantic 0.7 + BM25 0.3
       └──────┬──────────┘
              ▼
       ┌─────────────────┐
       │  Cross-Encoder   │  BGE-Reranker-v2-m3 精排
       │  重排序          │  top-20 → top-k
       └──────┬──────────┘
              ▼
       ┌─────────────────┐
       │  构建上下文       │  "## 文档名\n内容" 拼接
       └──────┬──────────┘
              ▼
       ┌─────────────────┐
       │  LLM 生成回复    │  系统提示词 + 上下文 + 历史(最近20条) + 用户问题
       └─────────────────┘
```

### 9.3 查询重写

查询重写模块 (`llm_service.rewrite_query`) 将多轮对话中的上下文依赖问题转换为独立的检索查询：

```
用户: "它的主要论点是什么？"  (上下文: 上一轮在讨论《理想国》)
  → 重写为: "《理想国》的主要论点是什么？"
```

重写失败时自动回退到原始用户消息，不影响对话流程。

---

## 十、前端页面

### 10.1 路由

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | HomePage | 首页仪表板：统计面板 + 最近知识库 + 快捷入口 |
| `/chat/:collectionId?` | ChatPage | 对话页面：三栏可拖拽布局，完整对话管理功能 |
| `/knowledge` | KnowledgeBasePage | 知识库管理：拖拽上传 + 文档预览 |
| `/settings` | SettingsPage | 系统设置：主题/配置/状态/提示词四分区 |
| `/trash` | TrashPage | 回收站：归档项浏览/恢复/永久删除 |

### 10.2 UI 设计

- **主题系统**: 三套完整 CSS 变量主题（cosmos / light / xuan），通过 `data-theme` 属性切换
- **配色**: cosmos 深蓝黑底 + nebula 蓝紫强调色
- **字体**: Noto Sans SC（无衬线）+ Noto Serif SC（衬线），xuan 主题使用方正仿宋
- **动画**: Framer Motion 消息动画，Canvas 星空背景（cosmos 主题专属）
- **响应式**: 桌面端可折叠侧边栏（持久化），移动端 overlay 菜单
- **布局**: 对话页面使用 react-resizable-panels 实现三栏可拖拽布局（对话列表 / 消息区 / 引用来源）
- **Markdown 渲染**: AI 回复支持完整 Markdown（标题、列表、代码块、引用、表格等）
- **玻璃拟态**: 自定义 `.glass-panel` / `.glass-card` 组件层，渐变边框效果

---

## 十一、依赖清单

### 11.1 后端依赖

| 包 | 版本 | 用途 |
|---|---|---|
| fastapi | 0.115.6 | Web 框架 |
| uvicorn[standard] | 0.34.0 | ASGI 服务器 |
| pydantic | 2.10.3 | 数据校验 |
| pydantic-settings | 2.7.0 | 配置管理 |
| sqlalchemy | 2.0.36 | ORM |
| aiosqlite | 0.20.0 | SQLite 异步驱动 |
| chromadb | 1.5.9 | 向量数据库 |
| httpx | 0.28.1 | HTTP 客户端 |
| PyPDF2 | 3.0.1 | PDF 解析 |
| python-docx | 1.1.2 | DOCX 解析 |
| markdown | 3.7 | Markdown 处理 |
| tiktoken | 0.8.0 | Token 计数 |
| rank-bm25 | 0.2.2 | BM25 关键词检索 |
| jieba | 0.42.1 | 中文分词 |
| sentence-transformers | 3.3.1 | Cross-Encoder 重排序 |
| sse-starlette | 2.2.1 | SSE 流式支持 |
| python-multipart | 0.0.19 | 文件上传 |

### 11.2 前端依赖

| 包 | 版本 | 用途 |
|---|---|---|
| react | ^18.3.1 | UI 框架 |
| react-dom | ^18.3.1 | React DOM |
| react-router-dom | ^6.28.0 | 路由 |
| react-markdown | ^9.0.3 | Markdown 渲染 |
| react-resizable-panels | ^4.11.2 | 可拖拽面板布局 |
| framer-motion | ^12.40.0 | 动画库 |
| axios | ^1.7.9 | HTTP 客户端 |
| lucide-react | ^0.468.0 | 图标库 |
| vite | ^6.0.5 | 构建工具 |
| tailwindcss | ^3.4.17 | CSS 框架 |
| typescript | ~5.6.2 | TypeScript |

---

## 十二、扩展路线

- [ ] **知识图谱**: 从文档中抽取实体关系，可视化概念网络
- [ ] **间隔复习**: 基于艾宾浩斯遗忘曲线的智能复习推送
- [ ] **多模态**: 图片、视频、音频内容的理解与检索
- [ ] **协作学习**: 多用户知识库共享与讨论
- [ ] **学习分析**: 学习进度追踪、知识掌握度评估
- [ ] **本地模型**: 接入 Ollama 等本地 LLM/Embedding
- [ ] **多语言增强**: 跨语言检索与翻译辅助
- [ ] **自定义系统提示词**: 前端界面编辑苏格拉底的人格
- [ ] **回收站自动清理**: 后端定时任务清理超过 30 天的归档项
- [ ] **对话搜索**: 全文搜索历史对话内容
