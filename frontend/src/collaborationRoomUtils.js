export function getCollaborationRoomSourceContext(room = null) {
  if (!room || typeof room !== "object") {
    return { transcript: "", summary: "", formula: "", example: "", lectureNotes: "", lectureSlides: "", studyImages: [], hasContent: false };
  }
  const snapshots = (room.materials || [])
    .map((item) => item?.source?.snapshot)
    .filter((snapshot) => snapshot && typeof snapshot === "object");
  const sources = [room, ...snapshots];
  const firstText = (...keys) => {
    for (const source of sources) {
      for (const key of keys) {
        const value = String(source?.[key] || "").trim();
        if (value) return value;
      }
    }
    return "";
  };
  const firstImages = () => {
    for (const source of sources) {
      const images = source?.study_images || source?.studyImages;
      if (Array.isArray(images) && images.length) return images;
    }
    return [];
  };
  const context = {
    transcript: firstText("transcript"),
    summary: firstText("summary"),
    formula: firstText("formula"),
    example: firstText("example", "worked_example"),
    lectureNotes: firstText("lecture_notes", "lectureNotes"),
    lectureSlides: firstText("lecture_slides", "lectureSlides"),
    studyImages: firstImages(),
  };
  return { ...context, hasContent: Boolean(context.transcript || context.summary || context.lectureNotes || context.lectureSlides) };
}

export function formatRoomActivityTime(value = "") {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return "Just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)} min ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)} hr ago`;
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)} d ago`;
  return new Date(timestamp).toLocaleDateString();
}
