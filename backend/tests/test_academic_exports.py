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
        normalized = main.normalize_study_guide_export_theme(self.theme)
        self.assertEqual(normalized["typography"]["bodyPt"], 12)
        self.assertEqual(normalized["typography"]["lineHeight"], 1.65)
        unsafe = main.normalize_study_guide_export_theme({"typography": {"bodyPt": 99, "lineHeight": 0}})
        self.assertEqual(unsafe["typography"]["bodyPt"], 13)
        self.assertEqual(unsafe["typography"]["lineHeight"], 1.45)

    def test_docx_uses_academic_body_size_leading_and_equation(self):
        document = main.build_docx_study_pack_document("Fourier Series", self.sections, self.theme)
        with zipfile.ZipFile(io.BytesIO(document)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8")
        self.assertIn('w:sz w:val="24"', xml)
        self.assertIn('w:line="396"', xml)
        self.assertIn('w:jc w:val="center"', xml)
        self.assertIn('w:background w:color="F5F5FF"', xml)

    @unittest.skipIf(main.A4 is None, "reportlab is not installed")
    def test_pdf_builds_with_academic_theme_and_math(self):
        document = main.build_pdf_document("Fourier Series", self.sections, self.theme)
        self.assertTrue(document.startswith(b"%PDF"))
        self.assertGreater(len(document), 1000)


if __name__ == "__main__":
    unittest.main()
