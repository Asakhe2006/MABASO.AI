import unittest

from backend import main


class ConversationTitleTests(unittest.TestCase):
    def test_fallback_title_is_clear_and_at_most_four_words(self):
        title = main.build_fallback_conversation_title(
            "Please explain Fourier series coefficients with a worked example",
            "",
        )

        self.assertGreaterEqual(len(title.split()), 2)
        self.assertLessEqual(len(title.split()), 4)
        self.assertIn("Fourier", title)

    def test_generated_title_cleanup_clamps_long_titles(self):
        title = main.cleanup_generated_conversation_title(
            "Understanding Advanced Laplace Transform Worked Examples Today",
            "Study Chat",
        )

        self.assertLessEqual(len(title.split()), 4)

    def test_single_word_question_gets_a_readable_topic(self):
        title = main.build_fallback_conversation_title("Fourier", "")

        self.assertEqual(title, "Fourier Discussion")


if __name__ == "__main__":
    unittest.main()
