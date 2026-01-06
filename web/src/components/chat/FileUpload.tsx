"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, File, Image, Video, Music, FileText, Archive, Check, AlertCircle } from "lucide-react";

interface FileUploadProps {
  channelId?: string | null;
  onUploadComplete: (attachment: UploadedAttachment) => void;
  onUploadStart?: () => void;
  maxFiles?: number;
  disabled?: boolean;
}

interface UploadedAttachment {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  contentType: string;
  size: number;
  category: string;
}

interface PendingUpload {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
  previewUrl?: string;
  attachment?: UploadedAttachment;
}

const FILE_CATEGORIES: Record<string, { icon: React.ElementType; color: string }> = {
  image: { icon: Image, color: "text-blue-400" },
  video: { icon: Video, color: "text-purple-400" },
  audio: { icon: Music, color: "text-green-400" },
  document: { icon: FileText, color: "text-yellow-400" },
  archive: { icon: Archive, color: "text-orange-400" },
};

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("text")
  ) {
    return "document";
  }
  if (mimeType.includes("zip") || mimeType.includes("rar")) return "archive";
  return "document";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

async function generateThumbnail(file: File, maxSize: number = 200): Promise<string | null> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return null;
  }

  return new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.7));
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      video.onloadeddata = () => {
        video.currentTime = 1; // Seek to 1 second
      };

      video.onseeked = () => {
        let { videoWidth: width, videoHeight: height } = video;
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(video, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.7));
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    }
  });
}

export function FileUpload({
  channelId,
  onUploadComplete,
  onUploadStart,
  maxFiles = 10,
  disabled = false,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File, uploadId: string) => {
      try {
        // Update status to uploading
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, status: "uploading" as const, progress: 5 } : u))
        );

        // Check if we need to compress image
        let fileToUpload: File | Blob = file;
        if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
          setUploads((prev) =>
            prev.map((u) => (u.id === uploadId ? { ...u, status: "processing" as const, progress: 10 } : u))
          );
          fileToUpload = await compressImage(file);
        }

        // Generate thumbnail for images/videos
        let thumbnailDataUrl: string | null = null;
        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
          thumbnailDataUrl = await generateThumbnail(file);
        }

        setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 20 } : u)));

        // Get presigned URL
        const response = await fetch("/api/chat/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: fileToUpload instanceof Blob ? fileToUpload.size : file.size,
            channelId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to prepare upload");
        }

        const { data } = await response.json();
        const { uploadUrl, publicUrl, attachmentId } = data;

        setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 30 } : u)));

        // Upload to R2 using presigned URL
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = 30 + (e.loaded / e.total) * 60;
              setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress } : u)));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Upload failed"));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(fileToUpload);
        });

        setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 95 } : u)));

        // Confirm upload
        const confirmResponse = await fetch("/api/chat/upload", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attachmentId,
            thumbnailUrl: thumbnailDataUrl,
          }),
        });

        if (!confirmResponse.ok) {
          throw new Error("Failed to confirm upload");
        }

        const { data: attachment } = await confirmResponse.json();

        const uploadedAttachment: UploadedAttachment = {
          id: attachment.id,
          filename: file.name,
          url: publicUrl || attachment.url,
          thumbnailUrl: thumbnailDataUrl || undefined,
          contentType: file.type,
          size: file.size,
          category: getFileCategory(file.type),
        };

        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: "complete" as const, progress: 100, attachment: uploadedAttachment }
              : u
          )
        );

        onUploadComplete(uploadedAttachment);
      } catch (error) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: "error" as const, error: error instanceof Error ? error.message : "Upload failed" }
              : u
          )
        );
      }
    },
    [channelId, onUploadComplete]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, maxFiles - uploads.length);
      if (fileArray.length === 0) return;

      onUploadStart?.();

      const newUploads: PendingUpload[] = fileArray.map((file) => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: "pending" as const,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      // Start uploads
      for (const upload of newUploads) {
        uploadFile(upload.file, upload.id);
      }
    },
    [maxFiles, uploads.length, uploadFile, onUploadStart]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeUpload = useCallback((uploadId: string) => {
    setUploads((prev) => {
      const upload = prev.find((u) => u.id === uploadId);
      if (upload?.previewUrl) {
        URL.revokeObjectURL(upload.previewUrl);
      }
      return prev.filter((u) => u.id !== uploadId);
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads((prev) => {
      prev.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
      });
      return prev.filter((u) => u.status !== "complete" && u.status !== "error");
    });
  }, []);

  const pendingUploads = uploads.filter((u) => u.status !== "complete");
  const hasActiveUploads = pendingUploads.some((u) => u.status === "uploading" || u.status === "processing");

  return (
    <div className="relative">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 transition-all
          ${isDragOver ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-600"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          disabled={disabled}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
        />

        <div className="flex flex-col items-center gap-2 text-gray-400">
          <Upload className="w-8 h-8" />
          <p className="text-sm">
            <span className="text-blue-400">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">Images, videos, audio, documents up to 50MB</p>
        </div>
      </div>

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div className="mt-3 space-y-2">
          {uploads.map((upload) => {
            const category = getFileCategory(upload.file.type);
            const { icon: Icon, color } = FILE_CATEGORIES[category] || FILE_CATEGORIES.document;

            return (
              <div
                key={upload.id}
                className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-2"
              >
                {/* Preview/Icon */}
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-700 flex items-center justify-center">
                  {upload.previewUrl ? (
                    <img src={upload.previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon className={`w-5 h-5 ${color}`} />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{upload.file.name}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">{formatFileSize(upload.file.size)}</span>
                    {upload.status === "uploading" && (
                      <span className="text-blue-400">{Math.round(upload.progress)}%</span>
                    )}
                    {upload.status === "processing" && (
                      <span className="text-yellow-400">Compressing...</span>
                    )}
                    {upload.status === "complete" && (
                      <span className="text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    )}
                    {upload.status === "error" && (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {upload.error}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(upload.status === "uploading" || upload.status === "processing") && (
                    <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeUpload(upload.id);
                  }}
                  className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  disabled={upload.status === "uploading"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* Clear Completed Button */}
          {uploads.some((u) => u.status === "complete" || u.status === "error") && !hasActiveUploads && (
            <button
              onClick={clearCompleted}
              className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
            >
              Clear completed
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Compact inline upload button for chat input
export function InlineUploadButton({
  channelId,
  onUploadComplete,
  disabled = false,
}: {
  channelId?: string | null;
  onUploadComplete: (attachment: UploadedAttachment) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);
    const file = files[0];

    try {
      // Compress if needed
      let fileToUpload: File | Blob = file;
      if (file.type.startsWith("image/") && file.size > 1024 * 1024) {
        fileToUpload = await compressImage(file);
      }

      // Generate thumbnail
      const thumbnailDataUrl = await generateThumbnail(file);

      // Get presigned URL
      const response = await fetch("/api/chat/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: fileToUpload instanceof Blob ? fileToUpload.size : file.size,
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
        headers: { "Content-Type": file.type },
        body: fileToUpload,
      });

      // Confirm
      await fetch("/api/chat/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachmentId: data.attachmentId,
          thumbnailUrl: thumbnailDataUrl,
        }),
      });

      onUploadComplete({
        id: data.attachmentId,
        filename: file.name,
        url: data.publicUrl || data.key,
        thumbnailUrl: thumbnailDataUrl || undefined,
        contentType: file.type,
        size: file.size,
        category: getFileCategory(file.type),
      });
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        className={`
          p-2 rounded-lg transition-colors
          ${isUploading ? "text-blue-400 animate-pulse" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        title="Upload file"
      >
        <Upload className="w-5 h-5" />
      </button>
    </>
  );
}
