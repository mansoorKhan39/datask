class ApiError(Exception):
    """An error with a stable code and a message that is safe to show to the user."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class PlanError(Exception):
    """The AI produced a plan that cannot be run on this dataset."""


class LLMError(Exception):
    """The AI service failed. The message is safe to show to the user."""
