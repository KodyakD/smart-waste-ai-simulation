from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai"))

import build_dataset as bd  # noqa: E402

TARGET = bd.target_classes()
SOURCE = ["plastic", "paper", "cardboard", "metal", "glass",
          "organic_waste", "battery_waste", "e_waste", "cloth", "other_waste"]
MAP = bd.SOURCE_BY_ID["synthetic_outdoor"]["class_map"]


def test_target_is_five_classes():
    assert TARGET == ["ordinary_waste", "battery", "electronic_waste",
                      "aerosol", "medical_sharp"]


def test_map_class_known_and_unknown():
    assert bd.map_class(0, SOURCE, MAP, TARGET) == 0      # plastic
    assert bd.map_class(6, SOURCE, MAP, TARGET) == 1      # battery_waste
    assert bd.map_class(7, SOURCE, MAP, TARGET) == 2      # e_waste
    assert bd.map_class(3, SOURCE, MAP, TARGET) == 0      # metal -> ordinary


def test_map_class_rejects_unknown_index():
    assert bd.map_class(99, SOURCE, MAP, TARGET) is None


def test_remap_drops_malformed_and_out_of_range():
    text = "0 0.5 0.5 0.2 0.2\n6 0.1 0.1 0.05 0.05\n3 0.1 0.2 0.3\n4 1.4 0.2 0.3 0.3\n"
    out = bd.remap_label_text(text, SOURCE, MAP, TARGET)
    assert out == ["0 0.5 0.5 0.2 0.2", "1 0.1 0.1 0.05 0.05"]


def test_remap_keeps_class_order():
    text = "6 0.2 0.2 0.1 0.1\n7 0.4 0.4 0.1 0.1\n"
    assert bd.remap_label_text(text, SOURCE, MAP, TARGET) == [
        "1 0.2 0.2 0.1 0.1", "2 0.4 0.4 0.1 0.1"]


def test_split_for_is_deterministic_and_about_ten_percent():
    names = [f"syn_{i:06d}.jpg" for i in range(2000)]
    first = [bd.split_for(n) for n in names]
    assert first == [bd.split_for(n) for n in names]
    test_share = first.count("test") / len(first)
    assert 0.06 < test_share < 0.14
    assert set(first) <= {"train", "test"}


def test_non_redistributable_sources_are_not_fetched():
    assert bd.fetchable_sources() == ["synthetic_outdoor"]
