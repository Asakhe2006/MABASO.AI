import unittest
from pathlib import Path


class PlanChatQuotaTests(unittest.TestCase):
    def test_upload_and_ai_chat_defaults_match_product_plans(self):
        source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")

        expected_defaults = (
            '"study_chat_upload": get_int_env("FREE_PLAN_STUDY_CHAT_UPLOADS_PER_DAY", 3)',
            '"study_chat_upload": get_int_env("PRO_STUDENT_STUDY_CHAT_UPLOADS_PER_DAY", 10)',
        )
        for expected in expected_defaults:
            self.assertIn(expected, source)

        quotas_start = source.index("BILLING_PLAN_QUOTAS = {")
        premium_start = source.index('"premium_student": {', quotas_start)
        premium_end = source.index("\n    },", premium_start)
        premium_source = source[premium_start:premium_end]
        self.assertIn('"study_chat_upload": get_int_env("PREMIUM_STUDENT_STUDY_CHAT_UPLOADS_PER_DAY", 25)', premium_source)

        self.assertIn('"study_chat": get_int_env("FREE_PLAN_AI_CHAT_MESSAGES_PER_DAY", 15)', source)
        self.assertIn('"study_chat": get_int_env("PRO_STUDENT_AI_CHAT_MESSAGES_PER_DAY", 40)', source)
        self.assertIn('"study_chat": get_int_env("PREMIUM_STUDENT_AI_CHAT_MESSAGES_PER_DAY", 100)', premium_source)
        self.assertIn('"free": max(1, get_early_int_env("FREE_PLAN_AI_CHAT_MESSAGES_PER_CONVERSATION", 5))', source)
        self.assertIn('"premium_student": max(1, get_early_int_env("PREMIUM_STUDENT_AI_CHAT_MESSAGES_PER_CONVERSATION", 75))', source)


if __name__ == "__main__":
    unittest.main()
