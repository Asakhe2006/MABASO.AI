import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import product_knowledge
import web_search


class _Response:
    status_code = 200
    encoding = "utf-8"

    def __init__(self, body: str):
        self.content = body.encode("utf-8")

    def raise_for_status(self):
        return None


class WebSearchRoutingTests(unittest.TestCase):
    def test_stable_academic_questions_do_not_search(self):
        self.assertFalse(web_search.should_use_web_search("What is 2 + 2?"))
        self.assertFalse(web_search.should_use_web_search("Explain amplitude modulation."))

    def test_current_and_explicit_questions_search(self):
        self.assertTrue(web_search.should_use_web_search("Search the web for NSFAS updates today."))
        self.assertTrue(web_search.should_use_web_search("What are the latest OpenAI announcements?"))
        self.assertTrue(web_search.should_use_web_search("Who won yesterday's match?"))

    def test_south_african_relevance_is_added_only_when_unspecified(self):
        self.assertTrue(web_search.build_search_query("Find bursaries open now").endswith("South Africa"))
        self.assertEqual(
            web_search.build_search_query("Find university applications in Canada"),
            "Find university applications in Canada",
        )

    def test_direct_url_is_separate_and_private_network_is_blocked(self):
        self.assertFalse(web_search.should_use_web_search("Summarize http://127.0.0.1/admin"))
        with self.assertRaises(ValueError):
            web_search.validate_public_url("http://127.0.0.1/admin")

    def test_duckduckgo_parser_reads_real_result_markup(self):
        html = '''<div class="result"><h2><a class="result__a" href="https://example.org/page">Official result</a></h2><a class="result__snippet">Useful current information</a></div>'''
        with patch.object(web_search, "_request", return_value=_Response(html)):
            rows = web_search._search_duckduckgo("test", 3)
        self.assertEqual(rows[0]["title"], "Official result")
        self.assertEqual(rows[0]["url"], "https://example.org/page")


class ProductKnowledgeTests(unittest.TestCase):
    def test_product_queries_use_product_knowledge(self):
        self.assertTrue(product_knowledge.is_mabaso_product_query("How does Mabaso AI Collaboration work?"))
        results = product_knowledge.search_product_knowledge("How does the Mabaso AI free trial work?", limit=5)
        self.assertTrue(results)
        self.assertTrue(all(item["visibility"] in {"public", "authenticated_feature_documentation"} for item in results))
        self.assertNotIn("user_email", {key for item in results for key in item})
        self.assertTrue(all("source_url" in item for item in results))

    def test_general_internet_question_is_not_product_intent(self):
        self.assertFalse(product_knowledge.is_mabaso_product_query("What are the latest OpenAI announcements?"))


if __name__ == "__main__":
    unittest.main()
