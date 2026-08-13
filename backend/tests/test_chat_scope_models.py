import unittest
from unittest.mock import patch

from backend import main


class ChatScopeModelTests(unittest.TestCase):
    @patch("backend.main.resolve_provider_attempts")
    def test_study_chat_uses_study_model(self, resolve_attempts):
        resolve_attempts.return_value = [{"provider": "openai", "label": "OpenAI", "model": "gpt-5.6-terra"}]
        payload = main.LectureAssistantRequest(question="Explain feedback", chat_scope="study")
        attempts = main.resolve_lecture_assistant_attempts(payload, "openai")
        self.assertEqual(attempts[0]["model"], main.STUDY_CHAT_MODEL)

    @patch("backend.main.resolve_provider_attempts")
    def test_global_chat_keeps_configured_ai_chat_model(self, resolve_attempts):
        resolve_attempts.return_value = [{"provider": "openai", "label": "OpenAI", "model": "gpt-5.6-terra"}]
        payload = main.LectureAssistantRequest(question="Hello", chat_scope="global")
        attempts = main.resolve_lecture_assistant_attempts(payload, "openai")
        self.assertEqual(attempts[0]["model"], "gpt-5.6-terra")


if __name__ == "__main__":
    unittest.main()
