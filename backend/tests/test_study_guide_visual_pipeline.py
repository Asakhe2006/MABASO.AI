import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class StudyGuideVisualPipelineTests(unittest.TestCase):
    def test_planner_uses_educational_need_not_account_plan(self):
        summary = """# Amplitude Modulation

        ## Signal flow
        The input signal passes through a modulator, channel and demodulator before reaching the output, so each component changes how the message is carried.

        ## Waveform behaviour
        The sine carrier waveform changes in amplitude according to the message signal, making the changing relationship visible over a complete cycle.
        """
        plans = main.build_study_guide_visual_plan(summary)
        self.assertEqual([plan["visual_type"] for plan in plans], ["process_diagram", "mathematical_graph"])
        self.assertFalse(any("plan" in repr(plan).lower() for plan in plans))

    def test_programmatic_visual_is_a_exportable_png(self):
        plan = {"concept": "CPU data flow", "content": "Input then processing then output.", "visual_type": "process_diagram", "matched_section": "CPU", "concept_key": "cpu-data-flow", "reason": "Shows data movement."}
        visual = main.build_programmatic_study_visual(plan)
        self.assertIsNotNone(visual)
        self.assertTrue(visual["image_url"].startswith("data:image/png;base64,"))
        self.assertEqual(visual["source_type"], "programmatic_diagram")

    def test_resolver_stops_at_programmatic_visual_before_external_or_ai(self):
        summary = """# System

        ## Process
        The input passes through three stages in a defined process before the output is produced, so students must understand the relationship and order of every stage.
        """
        with patch.object(main, "record_study_guide_visual_event"), patch.object(main, "cache_study_guide_visual"), patch.object(main, "get_cached_study_guide_visual", return_value=None), patch.object(main, "generate_openai_study_image_url") as ai_image:
            visuals = asyncio.run(main.resolve_study_guide_visuals(summary=summary, reference_images=[], visual_analysis=[], job_id="visual-test", owner_email="student@example.com"))
        self.assertEqual(len(visuals), 1)
        self.assertEqual(visuals[0]["source_type"], "programmatic_diagram")
        ai_image.assert_not_called()

    def test_openai_study_image_model_is_centralized(self):
        self.assertTrue(main.OPENAI_STUDY_GUIDE_IMAGE_MODEL)
        self.assertNotEqual(main.OPENAI_STUDY_GUIDE_IMAGE_MODEL, "gpt-image-1")


if __name__ == "__main__":
    unittest.main()
