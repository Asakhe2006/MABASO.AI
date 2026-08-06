export const ACADEMIC_READING_THEME = Object.freeze({
  readingWidthPx: 800,
  bodyPx: 16,
  mobileBodyPx: 15.5,
  lineHeight: 1.65,
  sectionHeadingPx: 26,
  subheadingPx: 22,
  stepHeadingPx: 20,
  mobileSectionHeadingPx: 22,
  mobileSubheadingPx: 19,
  mobileStepHeadingPx: 17,
  displayMathPx: 19,
  paragraphGapPx: 15,
  listItemGapPx: 9,
  contentPaddingPx: 20,
  mobileContentPaddingPx: 16,
});

export function getAcademicReadingCssVariables() {
  const theme = ACADEMIC_READING_THEME;
  return {
    "--academic-reading-width": `${theme.readingWidthPx}px`,
    "--academic-body-size": `${theme.bodyPx}px`,
    "--academic-mobile-body-size": `${theme.mobileBodyPx}px`,
    "--academic-line-height": theme.lineHeight,
    "--academic-section-heading": `${theme.sectionHeadingPx}px`,
    "--academic-subheading": `${theme.subheadingPx}px`,
    "--academic-step-heading": `${theme.stepHeadingPx}px`,
    "--academic-mobile-section-heading": `${theme.mobileSectionHeadingPx}px`,
    "--academic-mobile-subheading": `${theme.mobileSubheadingPx}px`,
    "--academic-mobile-step-heading": `${theme.mobileStepHeadingPx}px`,
    "--academic-display-math": `${theme.displayMathPx}px`,
    "--academic-paragraph-gap": `${theme.paragraphGapPx}px`,
    "--academic-list-item-gap": `${theme.listItemGapPx}px`,
    "--academic-content-padding": `${theme.contentPaddingPx}px`,
    "--academic-mobile-content-padding": `${theme.mobileContentPaddingPx}px`,
  };
}

export function getAcademicExportTypography() {
  const theme = ACADEMIC_READING_THEME;
  return {
    bodyPt: 12,
    lineHeight: theme.lineHeight,
    sectionHeadingPt: theme.sectionHeadingPx * 0.75,
    subheadingPt: theme.subheadingPx * 0.75,
    stepHeadingPt: theme.stepHeadingPx * 0.75,
    displayMathPt: theme.displayMathPx * 0.75,
    paragraphGapPt: theme.paragraphGapPx * 0.75,
    listItemGapPt: theme.listItemGapPx * 0.75,
  };
}
