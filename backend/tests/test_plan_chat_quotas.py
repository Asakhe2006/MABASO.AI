import unittest
from pathlib import Path


class PlanChatQuotaTests(unittest.TestCase):
    def test_chat_message_and_upload_defaults_match_product_plans(self):
        source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")

        expected_defaults = (
            '"study_chat": get_int_env("FREE_PLAN_AI_CHAT_MESSAGES_PER_DAY", 3)',
            '"study_chat_upload": get_int_env("FREE_PLAN_STUDY_CHAT_UPLOADS_PER_DAY", 1)',
            '"study_chat": get_int_env("PRO_STUDENT_AI_CHAT_MESSAGES_PER_DAY", 15)',
            '"study_chat_upload": get_int_env("PRO_STUDENT_STUDY_CHAT_UPLOADS_PER_DAY", 5)',
        )
        for expected in expected_defaults:
            self.assertIn(expected, source)

        quotas_start = source.index("BILLING_PLAN_QUOTAS = {")
        premium_start = source.index('"premium_student": {', quotas_start)
        premium_end = source.index("\n    },", premium_start)
        premium_source = source[premium_start:premium_end]
        self.assertIn('"study_chat": -1', premium_source)
        self.assertIn('"study_chat_upload": -1', premium_source)


if __name__ == "__main__":
    unittest.main()
