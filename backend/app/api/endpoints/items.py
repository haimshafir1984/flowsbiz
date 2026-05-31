from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

router = APIRouter()

# Schema definitions
class ItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, examples=["Building Boilerplate"])
    description: Optional[str] = Field(None, max_length=500, examples=["Setting up FastAPI + React templates."])
    completed: bool = Field(default=False)

class ItemCreate(ItemBase):
    pass

class Item(ItemBase):
    id: str

# Mock Database
mock_db = [
    {
        "id": "1",
        "title": "FastAPI Setup",
        "description": "Construct the robust Python backend with Pydantic and CORS middlewares.",
        "completed": True,
    },
    {
        "id": "2",
        "title": "React Vite Setup",
        "description": "Initialize Vite + TypeScript, configure hot reloading and standard layout.",
        "completed": False,
    },
    {
        "id": "3",
        "title": "Premium CSS Design System",
        "description": "Introduce glassmorphism, responsive dashboard patterns, and high-fidelity typography.",
        "completed": False,
    }
]

@router.get("", response_model=List[Item])
def get_items():
    """
    Retrieve all checklist items.
    """
    return mock_db

@router.post("", response_model=Item, status_code=201)
def create_item(item: ItemCreate):
    """
    Create a new item.
    """
    new_item = {
        "id": str(uuid.uuid4()),
        "title": item.title,
        "description": item.description,
        "completed": item.completed
    }
    mock_db.append(new_item)
    return new_item

@router.put("/{item_id}", response_model=Item)
def update_item(item_id: str, updated_fields: ItemCreate):
    """
    Update an existing item by its ID.
    """
    for index, item in enumerate(mock_db):
        if item["id"] == item_id:
            mock_db[index].update({
                "title": updated_fields.title,
                "description": updated_fields.description,
                "completed": updated_fields.completed
            })
            return mock_db[index]
    raise HTTPException(status_code=404, detail="Item not found")

@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str):
    """
    Delete an item by its ID.
    """
    for index, item in enumerate(mock_db):
        if item["id"] == item_id:
            mock_db.pop(index)
            return
    raise HTTPException(status_code=404, detail="Item not found")
