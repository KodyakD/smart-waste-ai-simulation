from pydantic import BaseModel, ConfigDict, Field, field_validator


class FillLevelRequest(BaseModel):
    fill_percentage: float = Field(ge=0, le=100)


class BinCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[A-Z0-9-]{3,16}$")
    name: str = Field(min_length=1, max_length=60)
    location: str = Field(min_length=1, max_length=60)
    capacity_cm: float = Field(ge=20, le=400)
    fill_percentage: float = Field(default=0, ge=0, le=100)

    @field_validator("name", "location")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class BinUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=60)
    location: str | None = Field(default=None, min_length=1, max_length=60)
    capacity_cm: float | None = Field(default=None, ge=20, le=400)

    @field_validator("name", "location")
    @classmethod
    def reject_blank_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class SimulationActionResponse(BaseModel):
    message: str
    bin: dict
