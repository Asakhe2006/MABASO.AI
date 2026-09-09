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

    def test_every_chat_model_is_available_to_every_plan(self):
        self.assertTrue(main.can_use_model("free", "gpt-5.6-terra", "global"))
        self.assertTrue(main.can_use_model("pro_student", "gpt-5.6-terra", "global"))
        self.assertTrue(main.can_use_model("premium_student", "gpt-5.6-terra", "global"))

    def test_student_facing_mode_matrix_is_open(self):
        self.assertTrue(main.can_use_ai_chat_mode("free", "quick"))
        self.assertTrue(main.can_use_ai_chat_mode("free", "study"))
        self.assertTrue(main.can_use_ai_chat_mode("pro_student", "think_deeper"))
        self.assertTrue(main.can_use_ai_chat_mode("pro_student", "maximum"))
        self.assertTrue(main.can_use_ai_chat_mode("premium_student", "maximum"))

    def test_auto_router_uses_study_or_deeper_reasoning_without_plan_gating(self):
        self.assertEqual(main.route_auto_ai_chat_mode("Solve a Fourier series", "free"), "think_deeper")
        self.assertEqual(main.route_auto_ai_chat_mode("Explain resistance", "pro_student"), "study")
        self.assertEqual(main.route_auto_ai_chat_mode("Solve a Fourier series", "pro_student"), "think_deeper")
        self.assertTrue(main.can_use_model("free", "gpt-4.1", "global"))

    def test_presentation_overflow_creates_continuation_slides(self):
        source_bullets = ["A detailed teaching point " * 12, "A second detailed teaching point " * 12]
        slides = main.normalize_presentation_slides([{"title": "Long topic", "bullets": source_bullets}])
        self.assertGreater(len(slides), 1)
        self.assertEqual(slides[0]["title"], "Long topic")
        self.assertTrue(slides[1]["title"].endswith("(continued)"))
        self.assertTrue(all(len(slide["bullets"]) <= main.PRESENTATION_MAX_BULLETS_PER_SLIDE for slide in slides))
        self.assertTrue(all(sum(len(bullet) for bullet in slide["bullets"]) <= main.PRESENTATION_MAX_BODY_CHARS for slide in slides))


if __name__ == "__main__":
    unittest.main()
