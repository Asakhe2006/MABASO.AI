import asyncio
import sys
import unittest
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

    async def test_resume_revision_prevents_abandon_cancellation(self):
        job_id = main.create_job("study_guide", "student@example.com")
        main.update_job(job_id, status="processing", _abandon_revision=1)

        pending_cancel = asyncio.create_task(
            main.cancel_abandoned_study_guide_job(job_id, 1, delay_seconds=0.01)
        )
        main.jobs[job_id]["_abandon_revision"] = 2
        await pending_cancel

        self.assertEqual(main.jobs[job_id]["status"], "processing")
        self.assertFalse(main.job_cancel_requested(job_id))

    async def test_expired_client_lease_cancels_generation(self):
        job_id = main.create_job("study_guide", "student@example.com")
        main.update_job(
            job_id,
            status="processing",
            _last_client_seen_monotonic=main.time.monotonic() - 2,
        )

        with patch.object(main, "refund_job_usage_if_failed", return_value=True):
            await main.monitor_study_guide_client_lease(
                job_id,
                timeout_seconds=0.01,
                check_interval_seconds=0.01,
            )

        self.assertEqual(main.jobs[job_id]["status"], "cancelled")


if __name__ == "__main__":
    unittest.main()
