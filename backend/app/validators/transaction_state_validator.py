class InvalidStateTransitionException(Exception):
    """
    Raised when an invalid transaction state transition is attempted.
    """
    def __init__(self, old_status: str, new_status: str, detail: str = ""):
        self.old_status = old_status
        self.new_status = new_status
        self.detail = detail or f"Invalid state transition from '{old_status}' to '{new_status}'."
        super().__init__(self.detail)


def validate_status_transition(old_status: str, new_status: str):
    """
    Validates if a transition from old_status to new_status is allowed.
    Raises InvalidStateTransitionException if the transition is forbidden.
    """
    if old_status == new_status:
        return

    valid_transitions = {
        "PENDING": {"ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"},
        "ACCEPTED": {"COMPLETED", "CANCELLED"},
        "REJECTED": set(),
        "CANCELLED": set(),
        "EXPIRED": set(),
        "COMPLETED": set()
    }

    allowed = valid_transitions.get(old_status, set())
    if new_status not in allowed:
        raise InvalidStateTransitionException(
            old_status=old_status,
            new_status=new_status,
            detail=f"Forbidden transaction status transition from '{old_status}' to '{new_status}'."
        )
