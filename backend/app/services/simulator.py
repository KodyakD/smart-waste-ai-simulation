from __future__ import annotations

import asyncio
import random

from .. import database


class SimulationRunner:
    """Generates virtual ultrasonic readings for bins marked as running."""

    def __init__(self, interval_seconds: float = 3.0) -> None:
        self.interval_seconds = max(1.0, interval_seconds)
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._stopping.clear()
            self._task = asyncio.create_task(self._run(), name="virtual-bin-simulator")

    async def stop(self) -> None:
        self._stopping.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self) -> None:
        while not self._stopping.is_set():
            await asyncio.sleep(self.interval_seconds)
            for bin_state in database.list_bins():
                if not bin_state["is_running"]:
                    continue
                current = float(bin_state["fill_percentage"])
                # Small, bounded increments mimic incoming waste. Values are simulated.
                increment = random.uniform(0.3, 1.8)
                next_level = min(100.0, current + increment)
                database.record_reading(bin_state["id"], next_level)
                if next_level >= 100:
                    database.set_bin_running(bin_state["id"], False)
