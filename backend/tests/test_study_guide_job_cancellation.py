import sys
import unittest
import asyncio
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class StudyGuideJobCancellationTests(unittest.IsolatedAsyncioTestCase):
    def tearDown(self):
        main.jobs.clear()
        main.job_tasks.clear()

    def test_cancel_marks_job_and_hides_internal_state(self):
        job_id = main.create_job("study_guide", "student@example.com")
        class FakeStream:
            def __init__(self):
                self.closed = False

            def close(self):
                self.closed = True

        stream = FakeStream()
        main.update_job(job_id, status="processing", progress=55, _openai_stream=stream)

        with patch.object(main, "refund_job_usage_if_failed", return_value=True) as refund:
            cancelled = main.cancel_study_guide_job(job_id)

        self.assertTrue(cancelled)
        self.assertEqual(main.jobs[job_id]["status"], "cancelled")
        self.assertTrue(main.job_cancel_requested(job_id))
        self.assertTrue(stream.closed)
        self.assertNotIn("_cancel_requested", main.serialize_job(main.jobs[job_id]))
        refund.assert_called_once_with(job_id, "cancelled_by_user")

    async def test_backgrounded_job_stays_active_without_explicit_cancel(self):
        job_id = main.create_job("study_guide", "student@example.com")
        main.update_job(
            job_id,
            status="processing",
            _last_client_seen_monotonic=main.time.monotonic() - 120,
        )
        await main.asyncio.sleep(0.02)

        self.assertEqual(main.jobs[job_id]["status"], "processing")
        self.assertFalse(main.job_cancel_requested(job_id))

    def test_only_explicit_cancel_stops_backgrounded_generation(self):
        job_id = main.create_job("study_guide", "student@example.com")
        main.update_job(
            job_id,
            status="processing",
            _last_client_seen_monotonic=main.time.monotonic() - 120,
        )

        with patch.object(main, "refund_job_usage_if_failed", return_value=True):
            main.cancel_study_guide_job(job_id)

        self.assertEqual(main.jobs[job_id]["status"], "cancelled")

    async def test_unexpected_task_interruption_is_not_reported_as_user_cancelled(self):
        job_id = main.create_job("study_guide", "student@example.com")
        main.update_job(job_id, status="processing", progress=92)

        with patch.object(main, "generate_study_guide", side_effect=asyncio.CancelledError), \
             patch.object(main, "refund_job_usage_if_failed", return_value=True) as refund:
            with self.assertRaises(asyncio.CancelledError):
                await main.run_summary_job(
                    job_id,
                    "",
                    "",
                    "",
                    "",
                    "English",
                    [],
                    "student@example.com",
                )

        self.assertEqual(main.jobs[job_id]["status"], "failed")
        self.assertEqual(main.jobs[job_id]["stage"], "Study guide interrupted")
        self.assertFalse(main.job_cancel_requested(job_id))
        refund.assert_called_once_with(job_id, "study_guide_interrupted")


if __name__ == "__main__":
    unittest.main()
