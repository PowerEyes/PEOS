from app.main import parse_values, valid_range


def test_extracts_labeled_fields_and_keeps_confidence():
    values, confidence, warnings = parse_values([
        ("OD SPH -2.00 CYL -0.50 AXIS 180 ADD +1.50", 0.96),
        ("OS SPH +1.25 CYL -0.25 AXIS 90 ADD +1.50", 0.92),
        ("PD FAR 64", 0.88),
    ])
    assert values["od"] == {"sph": -2.0, "cyl": -0.5, "axis": 180, "add": 1.5}
    assert values["os"]["sph"] == 1.25
    assert values["pd_far"] == 64
    assert confidence["od.sph"] == 0.96
    assert not warnings


def test_missing_and_low_confidence_fields_warn_without_guessing():
    values, confidence, warnings = parse_values([("OD SPH -1.00", 0.5)])
    assert values["od"]["sph"] == -1
    assert values["os"]["sph"] is None
    assert confidence["os.sph"] is None
    assert any("low OCR confidence" in warning for warning in warnings)
    assert any("os.sph: not confidently extracted" in warning for warning in warnings)


def test_prescription_specific_ranges():
    assert valid_range("axis", 180)
    assert not valid_range("axis", 181)
    assert valid_range("pd_far", 64)
    assert not valid_range("pd_far", 12)


def test_extracts_measurements_below_an_explicit_eye_heading():
    values, confidence, _ = parse_values([
        ("RIGHT EYE (OD)", 0.99),
        ("SPH -2.00 CYL -0.50 AXIS 180", 0.97),
        ("ADD +0.00", 0.96),
        ("LEFT EYE (OS)", 0.99),
        ("SPH -1.75 CYL -0.25 AXIS 175", 0.95),
        ("ADD +0.00", 0.94),
        ("PD FAR: 62", 0.93),
        ("PD NEAR: 58", 0.92),
    ])
    assert values["od"] == {"sph": -2.0, "cyl": -0.5, "axis": 180, "add": 0.0}
    assert values["os"] == {"sph": -1.75, "cyl": -0.25, "axis": 175, "add": 0.0}
    assert values["pd_far"] == 62
    assert values["pd_near"] == 58
    assert confidence["os.axis"] == 0.95
