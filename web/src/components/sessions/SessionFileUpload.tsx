"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, Image, Video, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface SessionAttachment {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  category: string;
}

interface SessionFileUploadProps {
  sessionId: string;
  onUploadComplete: (attachment: SessionAttachment) => void;
  onRemove: (attachment: SessionAttachment) => void;
  attachments: SessionAttachment[];
  maxFiles?: number;
  disabled?: boolean;
}

interface PendingUpload {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "complete" | "error";
  error?: string;
  previewUrl?: string;
  attachment?: SessionAttachment;
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "image":
      return Image;
    case "video":
      return Video;
    default:
      return FileText;
  }
}

export function SessionFileUpload({
  sessionId,
  onUploadComplete,
  onRemove,
  attachments,
  maxFiles = 5,
  disabled = false,
}: SessionFileUploadProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = attachments.length + pendingUploads.length < maxFiles;

  const uploadFile = useCallback(
    async (file: File) => {
      const uploadId = crypto.randomUUID();

      // Create preview for images
      let previewUrl: string | undefined;
      if (file.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
      }

      // Add to pending uploads
      const pendingUpload: PendingUpload = {
        id: uploadId,
        file,
        progress: 0,
        status: "uploading",
        previewUrl,
      };

      setPendingUploads((prev) => [...prev, pendingUpload]);

      try {
        // Step 1: Get presigned URL
        const initResponse = await fetch("/api/sessions/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
            sessionId,
          }),
        });

        if (!initResponse.ok) {
          const errorData = await initResponse.json();
          throw new Error(errorData.error || "Failed to initialize upload");
        }

        const { data } = await initResponse.json();
        const { uploadUrl, attachment } = data;

        // Step 2: Upload file to R2
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        // Step 3: Confirm upload
        await fetch("/api/sessions/upload", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId: attachment.id }),
        });

        // Update pending upload to complete
        setPendingUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: "complete" as const, attachment, progress: 100 }
              : u
          )
        );

        // Notify parent
        onUploadComplete(attachment);

        // Remove from pending after a short delay
        setTimeout(() => {
          setPendingUploads((prev) => prev.filter((u) => u.id !== uploadId));
        }, 1000);
      } catch (error) {
        console.error("Upload error:", error);
        setPendingUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? {
                  ...u,
                  status: "error" as const,
                  error: error instanceof Error ? error.message : "Upload failed",
                }
              : u
          )
        );
      }
    },
    [sessionId, onUploadComplete]
  );

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || disabled || !canAddMore) return;

      const filesArray = Array.from(files);
      const remainingSlots = maxFiles - (attachments.length + pendingUploads.length);
      const filesToUpload = filesArray.slice(0, remainingSlots);

      filesToUpload.forEach((file) => {
        // Validate file type
        const category = getFileCategory(file.type);
        if (!["image", "video", "document"].includes(category)) {
          alert(`File type not supported: ${file.type}`);
          return;
        }

        uploadFile(file);
      });
    },
    [disabled, canAddMore, maxFiles, attachments.length, pendingUploads.length, uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const Icon = Upload;

  return (
    <div className="space-y-3">
      {/* Upload area */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
            transition-colors
            ${
              dragOver
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <Icon className="w-8 h-8 mx-auto mb-2 text-gray-500" />
          <p className="text-sm text-gray-400">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Images, videos, PDFs • Max {maxFiles} files
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}

      {/* Uploaded files */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const CategoryIcon = getCategoryIcon(attachment.category);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg group"
              >
                <div className="flex-shrink-0">
                  {attachment.category === "image" ? (
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                      <CategoryIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(attachment)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
                  disabled={disabled}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending uploads */}
      {pendingUploads.length > 0 && (
        <div className="space-y-2">
          {pendingUploads.map((upload) => {
            const CategoryIcon = getCategoryIcon(getFileCategory(upload.file.type));
            return (
              <div
                key={upload.id}
                className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
              >
                <div className="flex-shrink-0">
                  {upload.previewUrl ? (
                    <img
                      src={upload.previewUrl}
                      alt={upload.file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                      <CategoryIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {upload.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(upload.file.size)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {upload.status === "uploading" && (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                  {upload.status === "complete" && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                  {upload.status === "error" && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
