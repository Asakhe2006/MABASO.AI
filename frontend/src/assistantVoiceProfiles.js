function compactText(value = "", fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeKey(value = "") {
  return compactText(value).toLowerCase();
}

function includesKeyword(haystack = "", keywords = []) {
  const normalized = normalizeKey(haystack);
  return keywords.some((keyword) => normalized.includes(normalizeKey(keyword)));
}

const VOICE_PROFILE_CATALOG = [
  {
    id: "wave",
    name: "Wave",
    accent: "British",
    style: "Crisp and polished",
    energy: "Focused",
    personality: "Fast, polished, and professional for clear explanations.",
    previewText: "Hi, I'm Wave. I'll help you with fast and natural conversations.",
    locale: "en-GB",
    rate: 1.01,
    pitch: 1.03,
    chunkPauseMs: 88,
    streamMaxChars: 150,
    voiceHints: [
      "google uk english female",
      "libby",
      "samantha",
      "serena",
      "hazel",
      "aria",
      "emma",
    ],
  },
  {
    id: "rain",
    name: "Rain",
    accent: "American",
    style: "Warm and calm",
    energy: "Steady",
    personality: "Thoughtful, reassuring, and smooth during longer learning sessions.",
    previewText: "Hello, I'm Rain. I speak with a calm and thoughtful tone.",
    locale: "en-US",
    rate: 0.96,
    pitch: 0.97,
    chunkPauseMs: 120,
    streamMaxChars: 145,
    voiceHints: [
      "ava",
      "jenny",
      "zira",
      "susan",
      "aria",
      "allison",
      "salli",
    ],
  },
  {
    id: "canyon",
    name: "Canyon",
    accent: "American",
    style: "Deep and cinematic",
    energy: "Confident",
    personality: "Grounded, confident, and ideal for concise voice answers.",
    previewText: "Hey there, I'm Canyon. Ready when you are.",
    locale: "en-US",
    rate: 0.93,
    pitch: 0.85,
    chunkPauseMs: 130,
    streamMaxChars: 155,
    voiceHints: [
      "david",
      "guy",
      "george",
      "daniel",
      "matthew",
      "fred",
      "ryan",
    ],
  },
  {
    id: "ember",
    name: "Ember",
    accent: "Global English",
    style: "Bright and energetic",
    energy: "High",
    personality: "Lively, upbeat, and quick for snappy voice interactions.",
    previewText: "Hi, I'm Ember. Let's keep this quick, clear, and lively.",
    locale: "en-US",
    rate: 1.05,
    pitch: 1.08,
    chunkPauseMs: 84,
    streamMaxChars: 142,
    voiceHints: [
      "google us english",
      "ana",
      "samantha",
      "aria",
      "serena",
      "zoe",
      "ava",
    ],
  },
];

function scoreSpeechVoiceForProfile(profile, voice) {
  if (!voice) return -1;
  const voiceName = compactText(voice.name);
  const voiceLang = compactText(voice.lang).toLowerCase();
  let score = 0;
  if (voiceLang.startsWith("en")) score += 20;
  if (voiceLang === normalizeKey(profile.locale)) score += 18;
  if (voiceLang.startsWith(`${normalizeKey(profile.locale).split("-")[0]}-`)) score += 10;
  if (includesKeyword(voiceName, profile.voiceHints)) score += 28;
  if (includesKeyword(voiceName, ["natural", "neural", "google", "microsoft", "enhanced"])) score += 12;
  if (voice.default) score += 3;
  return score;
}

export function buildVoiceProfileOptions(voices = []) {
  const englishVoices = Array.isArray(voices)
    ? voices.filter((voice) => compactText(voice?.lang).toLowerCase().startsWith("en"))
    : [];
  const fallbackVoice = englishVoices[0] || voices[0] || null;

  return VOICE_PROFILE_CATALOG.map((profile, index) => {
    const bestMatch = [...englishVoices]
      .sort((left, right) => scoreSpeechVoiceForProfile(profile, right) - scoreSpeechVoiceForProfile(profile, left))[0]
      || fallbackVoice
      || null;
    return {
      ...profile,
      rank: index + 1,
      available: Boolean(bestMatch),
      voiceURI: compactText(bestMatch?.voiceURI),
      voiceName: compactText(bestMatch?.name, compactText(fallbackVoice?.name, "English system voice")),
      voiceLang: compactText(bestMatch?.lang, compactText(fallbackVoice?.lang, profile.locale)),
      source: bestMatch ? "system" : "fallback",
    };
  });
}

export function resolveVoiceProfile(profiles = [], profileId = "") {
  const normalizedId = normalizeKey(profileId);
  return profiles.find((profile) => normalizeKey(profile.id) === normalizedId)
    || profiles[0]
    || null;
}

export function buildVoicePreviewText(profile, customText = "") {
  return compactText(customText, compactText(profile?.previewText));
}
