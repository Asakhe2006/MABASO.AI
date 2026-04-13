import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function App() {
  const [file, setFile] = useState(null);

  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [formula, setFormula] = useState("");
  const [example, setExample] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 🎤 RECORDING
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      audioChunksRef.current = [];
      const audioFile = new File([blob], "lecture.wav");
      setFile(audioFile);
    };

    mediaRecorderRef.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // 🚀 FAST UPLOAD
  const upload = async () => {
    if (!file) return alert("Upload or record a file first");

    setLoading(true);
    setStatus("⚡ Processing lecture... please wait (1–3 min)");

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
    const apiUrl = `${apiBaseUrl.replace(/\/+$/, "")}/upload-audio/`;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      setLoading(false);
      setStatus("❌ Upload failed. Check the backend connection.");
      console.error("Upload error:", res.status, errorText);
      return;
    }

    const data = await res.json();

    setTranscript(data.transcript);
    setSummary(data.summary);
    setFormula(data.formula);
    setExample(data.worked_example);

    setLoading(false);
    setStatus("✅ Done!");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">

        <h1 className="text-4xl font-bold text-center text-blue-700 mb-6">
          MABASO.AI
        </h1>

        {/* Upload */}
        <div className="bg-white p-6 rounded-2xl shadow mb-6">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />

          <button
            onClick={upload}
            className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            {loading ? "Processing..." : "Upload"}
          </button>

          <div className="mt-4">
            {!recording ? (
              <button
                onClick={startRecording}
                className="bg-green-600 text-white px-4 py-2 rounded-xl"
              >
                Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="bg-red-600 text-white px-4 py-2 rounded-xl"
              >
                Stop Recording
              </button>
            )}
          </div>

          {loading && (
            <p className="mt-4 text-gray-600">{status}</p>
          )}
        </div>

        {/* RESULTS */}
        <div className="bg-white p-6 rounded-2xl shadow mb-6">
          <h2 className="text-xl font-semibold mb-2">Transcript</h2>
          <p className="whitespace-pre-wrap">{transcript}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-semibold mb-2">Study Guide</h2>
          <div className="prose max-w-none">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>

      </div>
    </div>
  );
}