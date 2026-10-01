import asyncio
import unittest
from uuid import uuid4
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

    def test_astra_is_premium_only(self):
        self.assertFalse(main.can_use_model("free", "gpt-6-astra", "global"))
        self.assertFalse(main.can_use_model("pro_student", "gpt-6-astra", "global"))
        self.assertTrue(main.can_use_model("premium_student", "gpt-6-astra", "global"))

    def test_student_facing_mode_matrix_respects_plan_access(self):
        self.assertTrue(main.can_use_ai_chat_mode("free", "quick"))
        self.assertFalse(main.can_use_ai_chat_mode("free", "study"))
        self.assertTrue(main.can_use_ai_chat_mode("pro_student", "think_deeper"))
        self.assertFalse(main.can_use_ai_chat_mode("pro_student", "maximum"))
        self.assertTrue(main.can_use_ai_chat_mode("premium_student", "maximum"))
        self.assertTrue(main.can_use_ai_chat_mode("premium_student", "astra"))

    def test_auto_router_never_bypasses_plan_gating(self):
        self.assertEqual(main.route_auto_ai_chat_mode("Solve a Fourier series", "free"), "quick")
        self.assertEqual(main.route_auto_ai_chat_mode("Explain resistance", "pro_student"), "study")
        self.assertEqual(main.route_auto_ai_chat_mode("Solve a Fourier series", "pro_student"), "think_deeper")
        self.assertNotEqual(main.route_auto_ai_chat_mode("Use the most rigorous exhaustive proof", "free"), "astra")

    def test_exact_gpt6_mode_mapping_is_centralized(self):
        expected = {
            "quick": ("gpt-6-luna", "none"),
            "study": ("gpt-6-luna", "medium"),
            "think_deeper": ("gpt-6.1-sol", "high"),
            "expert": ("gpt-6.1-sol", "xhigh"),
            "maximum": ("gpt-6.1-sol", "max"),
            "astra": ("gpt-6-astra", "high"),
        }
        self.assertEqual(
            {key: (value["model"], value["reasoning_effort"]) for key, value in main.AI_CHAT_MODE_CONFIG.items()},
            expected,
        )

    def test_presentation_overflow_creates_continuation_slides(self):
        source_bullets = ["A detailed teaching point " * 12, "A second detailed teaching point " * 12]
        slides = main.normalize_presentation_slides([{"title": "Long topic", "bullets": source_bullets}])
        self.assertGreater(len(slides), 1)
        self.assertEqual(slides[0]["title"], "Long topic")
        self.assertTrue(slides[1]["title"].endswith("(continued)"))
        self.assertTrue(all(len(slide["bullets"]) <= main.PRESENTATION_MAX_BULLETS_PER_SLIDE for slide in slides))
        self.assertTrue(all(sum(len(bullet) for bullet in slide["bullets"]) <= main.PRESENTATION_MAX_BODY_CHARS for slide in slides))

    def test_ai_chat_mode_is_account_default_then_persists_last_selection(self):
        email = f"mode-preference-{uuid4().hex}@example.com"
        self.assertEqual(main.sync_user_account_snapshot(email)["preferred_ai_chat_mode"], "think_deeper")
        result = asyncio.run(main.update_ai_chat_mode_preference(
            main.AiChatModePreferenceRequest(mode="maximum"),
            current_user=email,
        ))
        self.assertEqual(result["preferred_ai_chat_mode"], "maximum")
        self.assertEqual(main.sync_user_account_snapshot(email)["preferred_ai_chat_mode"], "maximum")


if __name__ == "__main__":
    unittest.main()
