"""Authentication API routes."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db
from app.database.models import User
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token
)
from app.core.auth import get_current_user, get_current_active_user
from app.core.audit import log_audit_event, AuditAction, EntityType

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


# Schemas
class UserRegister(BaseModel):
    """User registration schema."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = Field(None, max_length=255)


class UserLogin(BaseModel):
    """User login schema."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserResponse(BaseModel):
    """User response schema."""
    id: str
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: str


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user.
    
    Args:
        user_data: Registration data
        request: FastAPI request object
        db: Database session
        
    Returns:
        JWT token and user info
    """
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        is_active=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Log audit event
    await log_audit_event(
        db=db,
        action=AuditAction.USER_REGISTERED,
        user_id=user.id,
        entity_type=EntityType.USER,
        entity_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=3600 * 24,  # 24 hours
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Login and get access token.
    
    Args:
        credentials: Login credentials
        request: FastAPI request object
        db: Database session
        
    Returns:
        JWT token and user info
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()
    
    # Verify credentials
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    # Log audit event
    await log_audit_event(
        db=db,
        action=AuditAction.USER_LOGIN,
        user_id=user.id,
        entity_type=EntityType.USER,
        entity_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=3600 * 24,  # 24 hours
        user={
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user info.
    
    Args:
        current_user: Authenticated user
        
    Returns:
        User info
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=bool(current_user.is_active),
        created_at=current_user.created_at.isoformat() if current_user.created_at else None
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Logout user (client should discard token).
    
    Args:
        request: FastAPI request object
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    # Log audit event
    await log_audit_event(
        db=db,
        action=AuditAction.USER_LOGOUT,
        user_id=current_user.id,
        entity_type=EntityType.USER,
        entity_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"message": "Successfully logged out"}


@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str = Field(..., min_length=8),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password.
    
    Args:
        old_password: Current password
        new_password: New password
        current_user: Authenticated user
        db: Database session
        
    Returns:
        Success message
    """
    # Verify old password
    if not verify_password(old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(new_password)
    await db.commit()
    
    # Log audit event
    await log_audit_event(
        db=db,
        action=AuditAction.PASSWORD_CHANGED,
        user_id=current_user.id,
        entity_type=EntityType.USER,
        entity_id=current_user.id
    )
    
    return {"message": "Password changed successfully"}
