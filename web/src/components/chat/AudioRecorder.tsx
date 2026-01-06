"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Send, Trash2, Play, Pause } from "lucide-react";

interface AudioRecorderProps {
  channelId?: string | null;
  onRecordingComplete: (attachment: {
    id: string;
    filename: string;
    url: string;
    contentType: string;
    size: number;
    category: string;
    duration: number;
  }) => void;
  disabled?: boolean;
}

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
}

function AudioVisualizer({ analyser, isRecording }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!analyser || !canvasRef.current || !isRecording) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "rgb(17, 24, 39)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, "rgb(59, 130, 246)");
        gradient.addColorStop(1, "rgb(37, 99, 235)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="rounded bg-gray-900"
    />
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ channelId, onRecordingComplete, disabled = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio context for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      setAnalyser(null);
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  }, [isRecording, isPaused]);

  const cancelRecording = useCallback(() => {
    stopRecording();
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setDuration(0);
  }, [stopRecording, audioUrl]);

  const playPreview = useCallback(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  const uploadRecording = useCallback(async () => {
    if (!audioBlob) return;

    setIsUploading(true);

    try {
      const filename = `voice-message-${Date.now()}.webm`;

      // Get presigned URL
      const response = await fetch("/api/chat/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          contentType: "audio/webm",
          fileSize: audioBlob.size,
          channelId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to prepare upload");
      }

      const { data } = await response.json();

      // Upload to R2
      await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/webm" },
        body: audioBlob,
      });

      // Confirm upload
      await fetch("/api/chat/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId: data.attachmentId }),
      });

      onRecordingComplete({
        id: data.attachmentId,
        filename,
        url: data.publicUrl || data.key,
        contentType: "audio/webm",
        size: audioBlob.size,
        category: "audio",
        duration,
      });

      // Cleanup
      cancelRecording();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload voice message");
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, channelId, duration, onRecordingComplete, cancelRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl]);

  // Not recording and no audio - show record button
  if (!isRecording && !audioBlob) {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className={`
          p-2 rounded-lg transition-colors
          ${disabled ? "opacity-50 cursor-not-allowed" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"}
        `}
        title="Record voice message"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  // Recording in progress
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
        {/* Recording indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPaused ? "bg-yellow-500" : "bg-red-500 animate-pulse"}`} />
          <span className="text-sm text-gray-300 font-mono">{formatDuration(duration)}</span>
        </div>

        {/* Visualizer */}
        <AudioVisualizer analyser={analyser} isRecording={isRecording && !isPaused} />

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={pauseRecording}
            className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={cancelRecording}
            className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
            title="Cancel"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={stopRecording}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            title="Stop and preview"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Preview recorded audio
  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
      {/* Preview info */}
      <div className="flex items-center gap-2">
        <button
          onClick={playPreview}
          className="p-1.5 text-gray-300 hover:text-white transition-colors"
          title={isPlaying ? "Pause" : "Play preview"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <span className="text-sm text-gray-300 font-mono">{formatDuration(duration)}</span>
      </div>

      {/* Waveform placeholder */}
      <div className="flex-1 h-8 bg-gray-700 rounded flex items-center justify-center">
        <div className="flex items-end gap-0.5 h-6">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-500 rounded-full"
              style={{ height: `${Math.random() * 100}%` }}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={cancelRecording}
          className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={uploadRecording}
          disabled={isUploading}
          className={`
            p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors
            ${isUploading ? "opacity-50 cursor-not-allowed animate-pulse" : ""}
          `}
          title="Send voice message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
