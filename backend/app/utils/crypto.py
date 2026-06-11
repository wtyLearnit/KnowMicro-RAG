"""
KnowMicro - API Key 加密工具
使用 Fernet 对称加密保护用户存储的 API Key。
"""
from cryptography.fernet import Fernet
from app.config import settings


def _get_fernet() -> Fernet:
    """从配置中的 secret_key 派生 Fernet 实例。"""
    import hashlib, base64
    # 将任意长度的 secret_key 通过 SHA-256 映射为 32 字节，再 base64 编码为 Fernet 所需格式
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def encrypt_api_key(plain: str) -> str:
    """加密 API Key，返回 base64 编码的密文字符串。"""
    if not plain:
        return ""
    f = _get_fernet()
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_api_key(token: str) -> str:
    """解密 API Key，返回明文。"""
    if not token:
        return ""
    f = _get_fernet()
    return f.decrypt(token.encode("utf-8")).decode("utf-8")


def mask_api_key(key: str) -> str:
    """脱敏展示 API Key，只显示后 4 位。"""
    if not key or len(key) <= 8:
        return "****"
    return f"{key[:3]}...{key[-4:]}"
