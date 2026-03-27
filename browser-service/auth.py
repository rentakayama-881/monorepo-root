"""JWT authentication middleware for FastAPI."""
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from config import settings

security_scheme = HTTPBearer()

class UserContext:
    """Authenticated user from JWT token."""
    def __init__(self, user_id: int, username: str):
        self.user_id = user_id
        self.username = username

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> UserContext:
    """Validate JWT token and return user context."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("user_id") or payload.get("sub")
        username = payload.get("username", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token tidak valid: user_id tidak ditemukan",
            )
        return UserContext(user_id=int(user_id), username=str(username))
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sudah kedaluwarsa",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token tidak valid: {e}",
        )
