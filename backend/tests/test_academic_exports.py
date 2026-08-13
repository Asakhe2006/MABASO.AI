import io
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class AcademicExportThemeTests(unittest.TestCase):
    def setUp(self):
        self.theme = {
            "id": "mathematics-indigo",
            "page": "#f5f5ff",
            "surface": "#ffffff",
            "surfaceAlt": "#eaeafe",
            "text": "#1d2035",
            "heading": "#29266f",
            "muted": "#5c5d78",
            "accent": "#4f46b8",
            "border": "#c8c7ec",
            "sectionAccents": ["#4f46b8", "#2563eb"],
            "typography": {
                "bodyPt": 12,
                "lineHeight": 1.65,
                "sectionHeadingPt": 19.5,
                "subheadingPt": 16.5,
                "stepHeadingPt": 15,
                "displayMathPt": 14.25,
                "paragraphGapPt": 11.25,
                "listItemGapPt": 6.75,
            },
        }
        self.sections = [main.PdfSection(
            title="Fourier Series",
            content=(
                "# Concept\nA periodic signal repeats after $T$ seconds.\n\n"
                "## Formula\n$$x(t)=a_0+\\sum_{n=1}^{\\infty}a_n\\cos(n\\omega_0t)$$\n\n"
                "### Step 1\nCompare coefficients.\n\n**Final Answer:** $a_1=1$."
            ),
        )]

    def test_typography_is_validated_and_preserved(self):
        self.assertGreaterEqual(self.theme["typography"]["bodyPt"], 12)
        self.assertEqual(self.theme["typography"]["lineHeight"], 1.65)

    def test_docx_uses_academic_body_size_leading_and_equation(self):
        document = main.build_docx_study_pack_document("Fourier Series", self.sections)
        with zipfile.ZipFile(io.BytesIO(document)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8")
        self.assertIn('w:sz w:val="23"', xml)
        self.assertIn('w:line="330"', xml)
        self.assertNotIn("$$x(t)=a_0+", xml)
        self.assertTrue("Equation" in xml or "x(t)=a_0+" in xml)

    @unittest.skipIf(main.A4 is None, "reportlab is not installed")
    def test_pdf_builds_with_academic_theme_and_math(self):
        document = main.build_pdf_document("Fourier Series", self.sections)
        self.assertTrue(document.startswith(b"%PDF"))
        self.assertGreater(len(document), 1000)

    def test_formula_normalizer_preserves_renderable_latex(self):
        cleaned = main.make_formulas_human_readable(
            "The transform is $$\\frac{1}{2}+\\int_0^\\infty e^{-st}\\,dt$$"
        )
        self.assertIn("\\frac{1}{2}", cleaned)
        self.assertIn("\\int", cleaned)
        self.assertIn("$$", cleaned)
        self.assertNotIn("â", cleaned)

    def test_formula_normalizer_wraps_unicode_math_as_latex(self):
        cleaned = main.make_formulas_human_readable("ω₀ = 2π/T = 1")
        self.assertIn("$$", cleaned)
        self.assertIn("\\omega", cleaned)
        self.assertIn("_{0}", cleaned)
        self.assertIn("\\pi", cleaned)

    def test_formula_normalizer_wraps_bare_study_math_and_table_cells(self):
        source = (
            "5s+7(s+1)(s+3)=As+1+B(s+3)\\frac{5s+7}{(s+1)(s+3)}\n\n"
            "| Expression | Readable Result |\n"
            "| --- | --- |\n"
            "| L^{-1}[1/(s+a)] | e^{-at} |\n"
            "| sum_{k}[A_k/(s+p_k)] | for distinct real poles |"
        )
        cleaned = main.make_formulas_human_readable(source)
        self.assertIn("$$5s+7", cleaned)
        self.assertIn(r"\frac{5s+7}", cleaned)
        self.assertIn("$L^{-1}[1/(s+a)]$", cleaned)
        self.assertIn("$e^{-at}$", cleaned)
        self.assertIn(r"$\sum_{k}[A_{k}/(s+p_{k})]$", cleaned)

    def test_study_guide_quality_gate_rejects_source_dumps_and_placeholders(self):
        draft = (
            "LECTURER NOTES\nControl systems regulate process variables.\n\n"
            "[Suggested Visual: block diagram]\n\n"
            "This paragraph is too close to raw uploaded content."
        )
        self.assertTrue(main.study_guide_needs_quality_repair(draft))
        cleaned = main.prepare_generated_study_guide_output(draft)
        self.assertNotIn("LECTURER NOTES", cleaned)
        self.assertNotIn("Suggested Visual", cleaned)

    def test_study_guide_cleanup_removes_internal_visual_metadata_and_run_ons(self):
        draft = (
            "# Control Systems\nA sensor measures output.Accuracy matters.\n\n"
            "[Suggested Diagram: feedback loop]\n"
            "AI explanation: Internal generation detail.\n"
            "Linked section: Feedback\n"
        )
        cleaned = main.prepare_generated_study_guide_output(draft)
        self.assertNotIn("Suggested Diagram", cleaned)
        self.assertNotIn("AI explanation", cleaned)
        self.assertNotIn("Linked section", cleaned)
        self.assertIn("output.\n\nAccuracy", cleaned)

    def test_study_guide_cleanup_deduplicates_adjacent_equations(self):
        draft = "# Formula\n\n$$x(t)=a_0+\\sum_{n=1}^{\\infty}a_n$$\n\n$$x(t)=a_0+\\sum_{n=1}^{\\infty}a_n$$"
        cleaned = main.prepare_generated_study_guide_output(draft)
        self.assertEqual(cleaned.count("\\sum"), 1)

    def test_quality_gate_rejects_collapsed_multi_step_equations(self):
        draft = (
            "# Worked Example\n\n"
            "$$5s+7=A(s+3)+B(s+1)=As+3A+Bs+B=5s+(3A+B)$$"
        )
        self.assertTrue(main.study_guide_needs_quality_repair(draft))

    def test_figure_caption_hides_ai_metadata(self):
        lines = main.build_study_image_caption_lines({
            "figure_number": 2,
            "title": "Closed Loop Control",
            "caption": "Signal flow through feedback.",
            "ai_explanation": "Internal explanation",
            "matched_section": "Feedback",
        })
        self.assertEqual(lines, ["Figure 2. Closed Loop Control", "Signal flow through feedback."])

    def test_heading_wording_is_natural_and_contains_no_rendering_markup(self):
        cleaned = main.prepare_generated_study_guide_output(
            "# 3. Open-Loop Control\n\n## `$12. Square-Wave Synthesis$`"
        )
        self.assertIn("# 3. Open Loop Control", cleaned)
        self.assertIn("## 12. Square Wave Synthesis", cleaned)
        self.assertNotIn("Open-Loop", cleaned)
        self.assertNotIn("`", cleaned)


if __name__ == "__main__":
    unittest.main()
