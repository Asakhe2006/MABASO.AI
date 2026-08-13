import os
import unittest
from unittest.mock import patch

from backend.chat_assistant import (
    DEFAULT_OPENAI_CHAT_MODEL,
    normalize_openai_model_name,
    resolve_provider_attempts,
)


class ChatModelFallbackTests(unittest.TestCase):
    def test_removed_model_alias_uses_supported_default(self):
        self.assertEqual(normalize_openai_model_name("gpt-terra-5.6"), DEFAULT_OPENAI_CHAT_MODEL)

    def test_custom_model_keeps_default_as_second_attempt(self):
        with patch.dict(
            os.environ,
            {"OPENAI_API_KEY": "test-key", "OPENAI_CHAT_MODEL": "custom-model"},
            clear=False,
        ):
            attempts = resolve_provider_attempts("openai")

        self.assertEqual([attempt["model"] for attempt in attempts], ["custom-model", DEFAULT_OPENAI_CHAT_MODEL])

    def test_removed_environment_model_never_reaches_provider(self):
        with patch.dict(
            os.environ,
            {"OPENAI_API_KEY": "test-key", "OPENAI_CHAT_MODEL": "gpt-terra-5.6"},
            clear=False,
        ):
            attempts = resolve_provider_attempts("openai")

        self.assertEqual([attempt["model"] for attempt in attempts], [DEFAULT_OPENAI_CHAT_MODEL])


if __name__ == "__main__":
    unittest.main()
