"""
苏格拉底之窗 - 用户模型配置 API
CRUD + 连接测试 + 获取激活配置 + 获取模型列表 + 批量添加。
"""
import time
import logging
from typing import Optional, List
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, UserModelConfig
from app.schemas.schemas import (
    UserModelConfigCreate, UserModelConfigUpdate, UserModelConfigOut,
    ModelTestRequest, ModelTestResponse, ActiveConfigsResponse,
    FetchModelsRequest, FetchModelsResponse, ModelInfo,
    BatchAddRequest, BatchAddResponse,
)
from app.utils.crypto import encrypt_api_key, decrypt_api_key

logger = logging.getLogger("Socratess_window")
router = APIRouter(prefix="/api/user/model-configs", tags=["model-configs"])


def _plain_key(config: UserModelConfig) -> str:
    """解密配置中的 API Key。"""
    return decrypt_api_key(config.api_key) if config.api_key else ""


def _to_out(config: UserModelConfig) -> UserModelConfigOut:
    """将数据库模型转换为输出 Schema。"""
    return UserModelConfigOut(
        id=config.id,
        config_type=config.config_type,
        provider=config.provider,
        base_url=config.base_url,
        model_name=config.model_name,
        is_active=bool(config.is_active),
        extra_params=config.extra_params or {},
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


async def _deactivate_others(db: AsyncSession, config_type: str, exclude_id: str = None):
    """将同类型的其他配置设为非激活。"""
    stmt = select(UserModelConfig).where(
        UserModelConfig.config_type == config_type,
        UserModelConfig.is_active == 1,
    )
    if exclude_id:
        stmt = stmt.where(UserModelConfig.id != exclude_id)
    result = await db.execute(stmt)
    for cfg in result.scalars().all():
        cfg.is_active = 0


@router.get("", response_model=List[UserModelConfigOut])
async def list_model_configs(
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取模型配置列表，可按 config_type 过滤。"""
    stmt = select(UserModelConfig).order_by(UserModelConfig.created_at.desc())
    if type:
        stmt = stmt.where(UserModelConfig.config_type == type)
    result = await db.execute(stmt)
    return [_to_out(c) for c in result.scalars().all()]


@router.post("", response_model=UserModelConfigOut)
async def create_model_config(
    req: UserModelConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建新的模型配置。"""
    if req.is_active:
        await _deactivate_others(db, req.config_type)

    config = UserModelConfig(
        config_type=req.config_type,
        provider=req.provider,
        base_url=req.base_url.rstrip("/"),
        api_key=encrypt_api_key(req.api_key) if req.api_key else "",
        model_name=req.model_name,
        is_active=1 if req.is_active else 0,
        extra_params=req.extra_params,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return _to_out(config)


@router.put("/{config_id}", response_model=UserModelConfigOut)
async def update_model_config(
    config_id: str,
    req: UserModelConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新模型配置。"""
    config = await db.get(UserModelConfig, config_id)
    if not config:
        raise HTTPException(404, "配置不存在")

    if req.provider is not None:
        config.provider = req.provider
    if req.base_url is not None:
        config.base_url = req.base_url.rstrip("/")
    if req.api_key is not None:
        config.api_key = encrypt_api_key(req.api_key) if req.api_key else ""
    if req.model_name is not None:
        config.model_name = req.model_name
    if req.extra_params is not None:
        config.extra_params = req.extra_params
    if req.is_active is not None:
        if req.is_active:
            await _deactivate_others(db, config.config_type, exclude_id=config_id)
        config.is_active = 1 if req.is_active else 0

    await db.commit()
    await db.refresh(config)
    return _to_out(config)


@router.delete("/{config_id}", status_code=204)
async def delete_model_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
):
    """删除模型配置。"""
    config = await db.get(UserModelConfig, config_id)
    if not config:
        raise HTTPException(404, "配置不存在")
    await db.delete(config)
    await db.commit()


@router.post("/test", response_model=ModelTestResponse)
async def test_model_connection(
    req: ModelTestRequest,
    db: AsyncSession = Depends(get_db),
):
    """测试模型连接。可引用已保存的配置 ID，或直接传入参数。"""
    if req.config_id:
        config = await db.get(UserModelConfig, req.config_id)
        if not config:
            raise HTTPException(404, "配置不存在")
        config_type = config.config_type
        base_url = config.base_url.rstrip("/")
        api_key = _plain_key(config)
        model_name = config.model_name
    else:
        if not req.config_type or not req.base_url or not req.model_name:
            raise HTTPException(400, "缺少必要参数：config_type, base_url, model_name")
        config_type = req.config_type
        base_url = req.base_url.rstrip("/")
        api_key = req.api_key or ""
        model_name = req.model_name

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
            if config_type == "llm":
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    json={"model": model_name, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1},
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                )
            else:
                resp = await client.post(
                    f"{base_url}/embeddings",
                    json={"model": model_name, "input": "test"},
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                )

        latency = int((time.time() - start) * 1000)
        if resp.status_code >= 400:
            error_detail = ""
            try:
                error_detail = resp.json().get("error", {}).get("message", "")
            except Exception:
                error_detail = resp.text[:200]
            return ModelTestResponse(success=False, latency_ms=latency,
                                     message=f"连接失败 (HTTP {resp.status_code})", error=error_detail or f"HTTP {resp.status_code}")
        return ModelTestResponse(success=True, latency_ms=latency, message=f"连接成功 ({latency}ms)")

    except httpx.TimeoutException:
        return ModelTestResponse(success=False, latency_ms=int((time.time()-start)*1000), message="连接超时", error="请求超过 10 秒未响应")
    except httpx.ConnectError as e:
        return ModelTestResponse(success=False, latency_ms=int((time.time()-start)*1000), message="连接失败", error=f"无法连接到服务器：{str(e)[:200]}")
    except Exception as e:
        return ModelTestResponse(success=False, latency_ms=int((time.time()-start)*1000), message="测试失败", error=str(e)[:200])


@router.get("/active", response_model=ActiveConfigsResponse)
async def get_active_configs(db: AsyncSession = Depends(get_db)):
    """获取当前激活的配置及全部配置列表。"""
    all_result = await db.execute(
        select(UserModelConfig).order_by(UserModelConfig.is_active.desc(), UserModelConfig.created_at.asc())
    )
    all_configs = all_result.scalars().all()
    llm_configs = [_to_out(c) for c in all_configs if c.config_type == "llm"]
    embedding_configs = [_to_out(c) for c in all_configs if c.config_type == "embedding"]
    active_map = {c.config_type: c for c in all_configs if c.is_active}
    return ActiveConfigsResponse(
        llm=_to_out(active_map["llm"]) if "llm" in active_map else None,
        embedding=_to_out(active_map["embedding"]) if "embedding" in active_map else None,
        llm_configs=llm_configs,
        embedding_configs=embedding_configs,
    )


# ── LLM 过滤关键词 ──────────────────────────────────
_LLM_EXCLUDE = {"embedding", "moderation", "whisper", "tts", "dall-e", "audio", "speech", "image"}


@router.post("/fetch-models", response_model=FetchModelsResponse)
async def fetch_models(
    req: FetchModelsRequest,
    db: AsyncSession = Depends(get_db),
):
    """从供应商的 /v1/models 接口获取可用模型列表。"""
    base_url = req.base_url.rstrip("/")
    api_key = req.api_key

    # 如果提供了 config_id，从数据库读取 API Key
    if req.config_id and not api_key:
        config = await db.get(UserModelConfig, req.config_id)
        if config:
            api_key = _plain_key(config)

    try:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
            resp = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
        if resp.status_code >= 400:
            return FetchModelsResponse(success=False, error=f"服务器返回 HTTP {resp.status_code}，该供应商可能不支持 /v1/models 接口")

        data = resp.json()
        raw_models = data.get("data", [])
        models = []
        for m in raw_models:
            model_id = m.get("id", "")
            owned_by = m.get("owned_by", "")
            if not model_id:
                continue
            if req.config_type == "llm":
                if any(kw in model_id.lower() for kw in _LLM_EXCLUDE):
                    continue
            elif req.config_type == "embedding":
                if "embedding" not in model_id.lower() and "embed" not in model_id.lower():
                    continue
            models.append(ModelInfo(id=model_id, owned_by=owned_by))

        models.sort(key=lambda x: x.id)
        return FetchModelsResponse(success=True, models=models)

    except httpx.TimeoutException:
        return FetchModelsResponse(success=False, error="请求超时（10秒），请检查 API 地址是否正确")
    except httpx.ConnectError as e:
        return FetchModelsResponse(success=False, error=f"无法连接到服务器：{str(e)[:200]}")
    except Exception as e:
        return FetchModelsResponse(success=False, error=str(e)[:200])


@router.post("/batch", response_model=BatchAddResponse)
async def batch_add_models(
    req: BatchAddRequest,
    db: AsyncSession = Depends(get_db),
):
    """批量添加模型配置。跳过已存在的同名模型。"""
    base_url = req.base_url.rstrip("/")
    encrypted_key = encrypt_api_key(req.api_key) if req.api_key else ""
    result = await db.execute(
        select(UserModelConfig.model_name).where(UserModelConfig.config_type == req.config_type)
    )
    existing_names = {row[0] for row in result.all()}

    created_models = []
    skipped_count = 0
    first_created = True

    for model_name in req.models:
        model_name = model_name.strip()
        if not model_name:
            continue
        if model_name in existing_names:
            skipped_count += 1
            continue

        has_active = await db.scalar(
            select(UserModelConfig.id).where(
                UserModelConfig.config_type == req.config_type, UserModelConfig.is_active == 1
            )
        )
        should_activate = first_created and not has_active

        config = UserModelConfig(
            config_type=req.config_type,
            provider=req.provider,
            base_url=base_url,
            api_key=encrypted_key,
            model_name=model_name,
            is_active=1 if should_activate else 0,
            extra_params=req.extra_params or {},
        )
        db.add(config)
        created_models.append(model_name)
        first_created = False

    await db.commit()
    return BatchAddResponse(created=len(created_models), skipped=skipped_count, models=created_models)
