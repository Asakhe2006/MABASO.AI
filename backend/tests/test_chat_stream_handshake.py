import unittest
from pathlib import Path


class ChatStreamHandshakeTests(unittest.TestCase):
    def test_stream_opens_before_history_context_is_loaded(self):
        source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")
        function_start = source.index("def create_lecture_assistant_stream(")
        function_end = source.index("\n\n@app.post(\"/api/chat/stream\")", function_start)
        function_source = source[function_start:function_end]

        ready_event = function_source.index('push(\n                "ready"')
        context_load = function_source.index("load_persisted_lecture_assistant_context(")
        context_event = function_source.index('push(\n                "context_ready"')

        self.assertLess(ready_event, context_load)
        self.assertLess(context_load, context_event)

    def test_stream_meters_successful_user_chat_requests(self):
        source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")
        function_start = source.index("def create_lecture_assistant_stream(")
        function_end = source.index('\n\n@app.post("/api/chat/stream")', function_start)
        function_source = source[function_start:function_end]

        self.assertIn("consume_plan_quota(", function_source)
        self.assertIn("reserve_ai_chat_conversation_turn(", function_source)
        self.assertIn("refund_usage_event(", function_source)
        self.assertIn('push("usage"', function_source)
        self.assertIn("threading.Thread(", function_source)
        self.assertIn("set_assistant_generation_state(", function_source)


if __name__ == "__main__":
    unittest.main()
