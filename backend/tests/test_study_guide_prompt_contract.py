import unittest

from backend import main


class StudyGuidePromptContractTests(unittest.TestCase):
    def test_canonical_prompt_is_single_source_scoped_contract(self):
        prompt = main.STUDY_GUIDE_PROMPT

        self.assertEqual(
            prompt.count("You are Mabaso AI's academic Study Guide engine."),
            1,
        )
        self.assertIn("CURRENT-REQUEST SOURCE BOUNDARY", prompt)
        self.assertIn("Never reuse facts, headings, examples, images, topics", prompt)
        self.assertIn("Generate only the Study Guide", prompt)
        self.assertIn("Never output literal placeholders", prompt)
        self.assertNotIn("## Visual Learning", prompt)


if __name__ == "__main__":
    unittest.main()
