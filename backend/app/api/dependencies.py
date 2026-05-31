from fastapi import Header, HTTPException, status, Depends
from uuid import UUID
from typing import Optional
from app.core.models.client import User, UserRole

async def get_current_user(
    x_user_role: str = Header("ADMIN", description="User role: ADMIN or CLIENT"),
    x_client_id: Optional[str] = Header(None, description="Client ID context")
) -> User:
    """
    Dependency to extract current user context from custom request headers.
    Defaults to ADMIN role for local backward compatibility.
    """
    role_str = x_user_role.upper()
    if role_str not in ("ADMIN", "CLIENT"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid role header. Must be ADMIN or CLIENT."
        )
        
    role = UserRole.ADMIN if role_str == "ADMIN" else UserRole.CLIENT
    
    client_uuid = None
    if x_client_id:
        try:
            client_uuid = UUID(x_client_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Client-Id must be a valid UUID string."
            )
            
    if role == UserRole.CLIENT and not client_uuid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Client-Id header is required for CLIENT role context."
        )
        
    return User(
        id=client_uuid or UUID("00000000-0000-0000-0000-000000000000"),
        username="admin" if role == UserRole.ADMIN else f"client_{str(client_uuid)[:8]}",
        role=role,
        client_id=client_uuid
    )

async def admin_required(user: User = Depends(get_current_user)) -> User:
    """
    Enforces that the current caller is an Admin.
    """
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Admin privilege required."
        )
    return user

async def client_or_admin_required(user: User = Depends(get_current_user)) -> User:
    """
    Baseline dependency allowing either Admin or Client roles.
    """
    return user
