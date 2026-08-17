import os
import unittest
from unittest.mock import patch

from backend.chat_assistant import (
    DEFAULT_OPENAI_CHAT_MODEL,
    FALLBACK_OPENAI_CHAT_MODEL,
    PREMIUM_OPENAI_CHAT_MODEL,
    normalize_openai_model_name,
    resolve_provider_attempts,
)


class ChatModelFallbackTests(unittest.TestCase):
    def test_terra_alias_stays_explicit_for_plan_enforcement(self):
        self.assertEqual(normalize_openai_model_name("gpt-terra-5.6"), PREMIUM_OPENAI_CHAT_MODEL)

    def test_custom_model_keeps_default_as_second_attempt(self):
        with patch.dict(
            os.environ,
            {"OPENAI_API_KEY": "test-key", "OPENAI_CHAT_MODEL": "custom-model"},
            clear=False,
        ):
            attempts = resolve_provider_attempts("openai")

        self.assertEqual([attempt["model"] for attempt in attempts], ["custom-model", FALLBACK_OPENAI_CHAT_MODEL])

    def test_restricted_environment_model_is_returned_for_backend_enforcement(self):
        with patch.dict(
            os.environ,
            {"OPENAI_API_KEY": "test-key", "OPENAI_CHAT_MODEL": "gpt-terra-5.6"},
            clear=False,
        ):
            attempts = resolve_provider_attempts("openai")

        self.assertEqual(
            [attempt["model"] for attempt in attempts],
            [PREMIUM_OPENAI_CHAT_MODEL, FALLBACK_OPENAI_CHAT_MODEL],
        )


if __name__ == "__main__":
    unittest.main()
