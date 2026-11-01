from pydantic import BaseModel, Field


class FillLevelRequest(BaseModel):
    fill_percentage: float = Field(ge=0, le=100)


class SimulationActionResponse(BaseModel):
    message: str
    bin: dict
