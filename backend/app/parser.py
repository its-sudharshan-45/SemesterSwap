import re
from typing import Tuple, Optional

# Match local part format: YYDDRRR
# YY -> 2 digits
# DD -> 2 alphabetical characters
# RRR -> 1 or more digits (typically 3 digits)
STUDENT_EMAIL_PATTERN = re.compile(r"^([0-9]{2})([a-zA-Z]{2})([0-9]+)$")

def parse_student_email(email: Optional[str]) -> Tuple[Optional[int], Optional[str], Optional[int]]:
    """
    Parses a student email local part to extract admission year, department code, and roll number.
    Format: YYDDRRR@college-domain
    Example: 24ad119@kpriet.ac.in -> (2024, "ad", 119)
    
    If the format is invalid or cannot be parsed, returns (None, None, None) safely.
    """
    if not email or "@" not in email:
        return None, None, None

    local_part = email.split("@")[0]
    match = STUDENT_EMAIL_PATTERN.match(local_part)
    if not match:
        return None, None, None

    yy_str, dd_str, rrr_str = match.groups()
    try:
        admission_year = 2000 + int(yy_str)
        department_code = dd_str.lower()
        roll_number = int(rrr_str)
        return admission_year, department_code, roll_number
    except ValueError:
        return None, None, None
