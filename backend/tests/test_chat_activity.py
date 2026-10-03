import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from chat_activity import ACTIVITY_TYPES, build_activity_event, infer_request_activity_types


class ChatActivityTests(unittest.TestCase):
    def test_simple_question_has_no_fake_search_or_document_activity(self):
        stages = infer_request_activity_types(question="Explain photosynthesis")
        self.assertEqual(stages, ["UNDERSTANDING_REQUEST", "PREPARING_RESPONSE"])
        self.assertNotIn("SEARCHING_WEB", stages)

    def test_file_and_math_stages_come_from_request_inputs(self):
        stages = infer_request_activity_types(
            question="Solve the integral x^2",
            reference_document_count=1,
            reference_image_count=1,
        )
        self.assertIn("READING_DOCUMENT", stages)
        self.assertIn("ANALYZING_DOCUMENT", stages)
        self.assertIn("ANALYZING_IMAGE", stages)
        self.assertIn("CALCULATING", stages)
        self.assertIn("CHECKING_RESULT", stages)

    def test_activity_metadata_is_allowlisted(self):
        event = build_activity_event(
            "READING_DOCUMENT",
            metadata={"document_count": 2, "secret": "never-return-this"},
            generation_id="generation-1",
        )
        self.assertEqual(event["metadata"], {"document_count": 2})
        self.assertEqual(event["generation_id"], "generation-1")

    def test_standard_activity_types_cover_terminal_states(self):
        self.assertIn("STREAMING_RESPONSE", ACTIVITY_TYPES)
        self.assertIn("COMPLETED", ACTIVITY_TYPES)
        self.assertIn("FAILED", ACTIVITY_TYPES)


if __name__ == "__main__":
    unittest.main()
