from backend.app.parser import parse_student_email

def test_parse_valid_student_email():
    """
    Test correct parsing of standard student email: YYDDRRR@college-domain
    """
    # Test case: 24ad119@kpriet.ac.in
    year, dept, roll = parse_student_email("24ad119@kpriet.ac.in")
    assert year == 2024
    assert dept == "ad"
    assert roll == 119

    # Test case: case insensitivity (24AD119)
    year, dept, roll = parse_student_email("24AD119@kpriet.ac.in")
    assert year == 2024
    assert dept == "ad"
    assert roll == 119

    # Test case: single or multiple digits in roll number
    year, dept, roll = parse_student_email("20cs1@kpriet.ac.in")
    assert year == 2020
    assert dept == "cs"
    assert roll == 1

def test_parse_invalid_formats():
    """
    Test safe fallback to None values for non-standard or invalid formats.
    """
    # General non-student formats
    assert parse_student_email("staff@kpriet.ac.in") == (None, None, None)
    assert parse_student_email("principal@kpriet.ac.in") == (None, None, None)
    
    # Missing parts or bad characters
    assert parse_student_email("24ad11a@kpriet.ac.in") == (None, None, None) # alpha in roll
    assert parse_student_email("24a119@kpriet.ac.in") == (None, None, None) # single letter department
    assert parse_student_email("2cs119@kpriet.ac.in") == (None, None, None) # single digit year
    assert parse_student_email("24ad119") == (None, None, None) # missing domain
    assert parse_student_email("") == (None, None, None) # empty string
    assert parse_student_email(None) == (None, None, None) # None input
