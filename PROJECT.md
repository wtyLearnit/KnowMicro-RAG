# 苏格拉底之窗 (Socrates' Window) — 项目说明文档

> 洞穴墙上的投影，经由理性之光折射，成为理念世界的入口。

**版本**: 0.1.0 | **许可证**: MIT | **语言**: Python 3.11+ / TypeScript + React 18

---

## 一、项目概述

**苏格拉底之窗** 是一个基于 RAG（检索增强生成）的智能学习系统。用户上传学习材料后，可与苏格拉底式的 AI 导师展开对话，实现从被动接收到主动发现的学习体验。

### 核心特性

- **知识库管理**: 创建多个独立知识库，支持 PDF、DOCX、TXT、Markdown 格式
- **苏格拉底式对话**: 基于知识库内容的 RAG 问答，流式输出，附带引用来源
- **语义搜索**: 跨知识库或知识库内语义检索，返回相关度评分
- **对话持久化**: 多轮对话历史存储，支持会话管理

---

## 二、技术架构

### 2.1 架构总览

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

### 2.2 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite | 暗色学术风 UI |
| 后端 | FastAPI + SQLAlchemy + ChromaDB | 异步 Python |
| LLM | OpenAI 兼容接口 | 可接入任何兼容服务（当前: mimo-v2.5-pro） |
| Embedding | OpenAI 兼容接口 | 向量化模型（当前: text-embedding-v4） |
| 文档解析 | PyPDF2 / python-docx / markdown | PDF/DOCX/TXT/MD |
| 部署 | Docker Compose | 一键编排 |

### 2.3 数据存储

| 存储 | 用途 | 位置 |
|---|---|---|
| **SQLite** | 元数据（知识库、文档、对话、消息） | `backend/data/Socratess_window.db` |
| **ChromaDB** | 向量数据（文档分块的 embedding） | `backend/data/chroma/` |

---

## 三、项目结构

```
Socratess-window/
├── docker-compose.yml              # Docker 编排
├── README.md
├── backend/
│   ├── .env                        # 环境变量配置
│   ├── .env.example                # 环境变量模板
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/                       # 运行时数据（SQLite + ChromaDB）
│   └── app/
│       ├── main.py                 # FastAPI 入口
│       ├── config.py               # 配置管理
│       ├── database.py             # 数据库模型
│       ├── api/
│       │   ├── chat.py             # 对话 & 搜索路由
│       │   ├── collections.py      # 知识库 CRUD
│       │   ├── documents.py        # 文档上传/管理
│       │   └── system.py           # 系统状态/配置
│       ├── schemas/
│       │   └── schemas.py          # Pydantic 模型
│       └── services/
│           ├── rag_service.py      # RAG 编排
│           ├── llm_service.py      # LLM 调用
│           ├── embedding_service.py # Embedding 调用
│           ├── document_service.py # 文档解析
│           ├── chunking_service.py # 分块策略
│           └── exceptions.py       # 自定义异常
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                 # 路由定义
        ├── main.tsx                # 入口
        ├── components/
        │   └── Layout.tsx          # 布局组件
        ├── pages/
        │   ├── HomePage.tsx        # 首页仪表板
        │   ├── ChatPage.tsx        # 对话页面
        │   ├── KnowledgeBasePage.tsx # 知识库管理
        │   └── SettingsPage.tsx    # 系统设置
        ├── services/
        │   └── api.ts              # API 调用层
        └── types/
            └── index.ts            # TypeScript 类型
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

#### Collection (知识库)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `name` | String(256) | 名称（唯一） |
| `description` | Text | 描述 |
| `icon` | String(64) | 图标 emoji，默认 "📚" |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

#### Document (文档)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `collection_id` | UUID (FK) | 所属知识库 |
| `filename` | String(512) | 文件名 |
| `file_type` | String(32) | 类型: pdf/txt/md/docx |
| `file_size` | Integer | 文件大小（字节） |
| `chunk_count` | Integer | 分块数量 |
| `status` | String(32) | 状态: processing/ready/error |
| `error_message` | Text | 错误信息 |
| `created_at` | DateTime | 创建时间 |

#### Conversation (对话)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `collection_id` | UUID (FK) | 所属知识库 |
| `title` | String(512) | 对话标题 |
| `model_used` | String(128) | 使用的模型 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

#### Message (消息)

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `conversation_id` | UUID (FK) | 所属对话 |
| `role` | String(32) | 角色: user/assistant/system |
| `content` | Text | 消息内容 |
| `sources` | JSON | 引用来源列表 |
| `token_count` | Integer | Token 数量 |
| `created_at` | DateTime | 创建时间 |

---

## 五、功能说明

### 5.1 知识库管理

**入口**: `/knowledge`

#### 功能列表

| 功能 | 说明 |
|---|---|
| 创建知识库 | 输入名称、描述，自动生成 UUID |
| 删除知识库 | 级联删除所有文档、对话、消息及向量数据 |
| 上传文档 | 支持 PDF/DOCX/TXT/MD，上限 50MB |
| 删除文档 | 同步清理向量数据 |
| 文档状态跟踪 | processing → ready / error |

#### 文档处理流程

```
上传文件
  → 解析文档（按扩展名选择解析器）
  → 智能分块（800 字符/块，150 字符重叠）
  → Embedding 向量化（批量调用 API）
  → 存入 ChromaDB
  → 更新文档状态为 "ready"
```

#### 分块策略

| 策略 | 适用场景 | 说明 |
|---|---|---|
| 递归字符分割 | 通用 | 按段落 → 换行 → 句号 → 短语 → 空格逐级分割 |
| Markdown 感知分割 | .md 文件 | 按标题层级分割，保持 Markdown 结构 |
| 语义边界分割 | .txt/.pdf | 按句子边界分割，保持语义连贯 |

### 5.2 苏格拉底式对话

**入口**: `/chat/:collectionId?`

#### 对话流程

```
用户输入消息
  → 保存用户消息到数据库
  → 对用户问题做 Embedding 向量化
  → 在 ChromaDB 中检索 top-5 最相似的文档片段
  → 构建上下文（最多 5 个片段，含文档名和内容）
  → 连同系统提示词 + 历史对话 + 上下文发送给 LLM
  → SSE 流式返回 AI 回复
  → 保存 AI 消息（含引用来源）到数据库
```

#### SSE 流式事件

| 事件类型 | 数据格式 | 说明 |
|---|---|---|
| `chunk` | `{"type":"chunk","content":"..."}` | 文本片段 |
| `sources` | `{"type":"sources","sources":[...]}` | 引用来源 |
| `error` | `{"type":"error","message":"..."}` | 错误信息 |
| `done` | `{"type":"done","conversation_id":"..."}` | 完成 |

#### 苏格拉底式系统提示词

苏格拉底的教学之道内置于系统提示词中：

1. **苏格拉底式追问**: 用层层递进的问题引导发现，而非直接给出答案
2. **从具体升到抽象**: 将具体问题与底层原理联系起来
3. **跨域联结**: 指出当前知识与其它领域的同构关系
4. **知晓无知**: 遇到不确定的内容时坦然承认
5. **对话式节奏**: 每段回复像对话中的一个回合，有温度、有停顿、有留白

### 5.3 语义搜索

**入口**: `/api/search`

- 支持指定知识库内搜索或跨所有知识库搜索
- 返回 top-k 结果，包含文档名、片段内容、相关度评分
- 余弦距离转相似度: `similarity = 1 - distance / 2`

### 5.4 系统设置

**入口**: `/settings`（只读展示）

- 查看 LLM/Embedding 模型配置
- 查看向量数据库状态
- 查看系统统计数据

---

## 六、API 端点

### 6.1 知识库

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/collections` | 列出所有知识库 |
| `POST` | `/api/collections` | 创建知识库 |
| `GET` | `/api/collections/{id}` | 获取单个知识库 |
| `PATCH` | `/api/collections/{id}` | 更新知识库 |
| `DELETE` | `/api/collections/{id}` | 删除知识库 |

### 6.2 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/documents/upload/{collection_id}` | 上传文档 |
| `GET` | `/api/documents/collection/{collection_id}` | 列出知识库文档 |
| `DELETE` | `/api/documents/{id}` | 删除文档 |

### 6.3 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/chat` | RAG 对话（非流式） |
| `POST` | `/api/chat/stream` | RAG 对话（SSE 流式） |
| `GET` | `/api/conversations/{collection_id}` | 对话列表 |
| `GET` | `/api/conversations/{collection_id}/{conv_id}` | 获取对话消息 |
| `DELETE` | `/api/conversations/{collection_id}/{conv_id}` | 删除对话 |

### 6.4 搜索

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/search` | 语义搜索 |

### 6.5 系统

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/system/stats` | 系统统计 |
| `GET` | `/api/system/config` | 系统配置 |
| `GET` | `/api/system/health` | 健康检查 |

**共计 18 个端点**，完整文档访问: `http://localhost:8000/docs`

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
```

### 7.2 兼容的 LLM/Embedding 服务

支持任何 OpenAI 兼容的 API 服务：

| 服务 | LLM_API_BASE | 说明 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | 官方 API |
| DeepSeek | `https://api.deepseek.com/v1` | 深度求索 |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | GLM 系列 |
| 阿里云 DashScope | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 通义系列 |
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
┌─────────────┐
│  文档解析    │  PDF → PyPDF2 / DOCX → python-docx / TXT,MD → UTF-8
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  智能分块    │  800 字符/块，150 字符重叠，过滤 ≤10 字符碎片
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Embedding   │  批量调用 API（10 条/批），2048 维向量
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ChromaDB    │  存储向量 + 元数据（doc_id, doc_name, chunk_index）
└─────────────┘
```

### 9.2 检索流程（对话时）

```
用户问题
  │
  ▼
┌─────────────────┐
│  问题 Embedding   │  将问题向量化
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  向量相似度检索   │  ChromaDB cosine 检索 top-5
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  构建上下文       │  格式化为 "## 文档名\n内容" 拼接
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  LLM 生成回复    │  系统提示词 + 上下文 + 历史 + 用户问题
└─────────────────┘
```

### 9.3 相似度计算

ChromaDB 使用余弦距离（cosine distance），距离范围 `[0, 2]`：

```
similarity = 1 - distance / 2
```

- `similarity = 1.0`: 完全相同
- `similarity = 0.0`: 完全无关
- `similarity < 0.0`: 方向相反（理论上）

---

## 十、前端页面

### 10.1 路由

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | HomePage | 首页仪表板：统计信息 + 最近知识库 |
| `/chat/:collectionId?` | ChatPage | 对话页面：知识库选择 + 对话列表 + 消息区 |
| `/knowledge` | KnowledgeBasePage | 知识库管理：创建/删除知识库 + 上传/删除文档 |
| `/settings` | SettingsPage | 系统设置：配置查看 + 统计信息 |

### 10.2 UI 设计

- **风格**: 暗色学术风，灵感来自古希腊羊皮纸与学院建筑
- **配色**: parchment（羊皮纸色系）+ academia（学院深色系）
- **字体**: Noto Serif SC（衬线）+ Noto Sans SC（无衬线）
- **响应式**: 桌面端侧边栏布局，移动端 overlay 菜单
- **Markdown 渲染**: AI 回复支持完整的 Markdown 格式

---

## 十一、依赖清单

### 11.1 后端依赖

| 包 | 版本 | 用途 |
|---|---|---|
| fastapi | 0.115.6 | Web 框架 |
| uvicorn | 0.34.0 | ASGI 服务器 |
| pydantic | 2.10.3 | 数据校验 |
| pydantic-settings | 2.7.0 | 配置管理 |
| sqlalchemy | 2.0.36 | ORM |
| aiosqlite | 0.20.0 | SQLite 异步驱动 |
| chromadb | 0.5.23 | 向量数据库 |
| httpx | 0.28.1 | HTTP 客户端 |
| PyPDF2 | 3.0.1 | PDF 解析 |
| python-docx | 1.1.2 | DOCX 解析 |
| markdown | 3.7 | Markdown 处理 |
| tiktoken | 0.8.0 | Token 计数 |
| sse-starlette | 2.2.1 | SSE 流式支持 |
| python-multipart | 0.0.19 | 文件上传 |

### 11.2 前端依赖

| 包 | 版本 | 用途 |
|---|---|---|
| react | ^18.3.1 | UI 框架 |
| react-dom | ^18.3.1 | React DOM |
| react-router-dom | ^6.28.0 | 路由 |
| react-markdown | ^9.0.3 | Markdown 渲染 |
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
