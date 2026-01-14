/**
 * Session Attachment Upload API
 *
 * Handles file uploads for pattern session corrections and comments
 * Uses presigned URLs for direct R2 upload
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/db";
import { checkUploadRateLimit } from "@/lib/redis";
import crypto from "crypto";

// R2 Client
const r2Client =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "pattern-tool-uploads";
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Allowed file types for session attachments (screenshots, videos, documents)
const ALLOWED_TYPES: Record<string, { maxSize: number; category: string }> = {
  // Images (most common for feedback)
  "image/jpeg": { maxSize: 10 * 1024 * 1024, category: "image" }, // 10MB
  "image/png": { maxSize: 10 * 1024 * 1024, category: "image" },
  "image/gif": { maxSize: 5 * 1024 * 1024, category: "image" },
  "image/webp": { maxSize: 10 * 1024 * 1024, category: "image" },
  // Videos (screen recordings)
  "video/mp4": { maxSize: 100 * 1024 * 1024, category: "video" }, // 100MB for recordings
  "video/webm": { maxSize: 100 * 1024 * 1024, category: "video" },
  "video/quicktime": { maxSize: 100 * 1024 * 1024, category: "video" },
  // Documents
  "application/pdf": { maxSize: 20 * 1024 * 1024, category: "document" },
  "text/plain": { maxSize: 1 * 1024 * 1024, category: "document" },
};

interface SessionAttachmentMetadata {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  category: string;
}

// POST /api/sessions/upload - Get presigned URL for direct upload
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!r2Client) {
    return NextResponse.json(
      { success: false, error: "File storage not configured" },
      { status: 503 }
    );
  }

  try {
    // Rate limiting (5 uploads per minute)
    const allowed = await checkUploadRateLimit(session.user.id);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Too many uploads. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { filename, contentType, fileSize, sessionId } = body;

    // Validate required fields
    if (!filename || !contentType || !fileSize) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate file type
    const typeConfig = ALLOWED_TYPES[contentType];
    if (!typeConfig) {
      return NextResponse.json(
        { success: false, error: `File type '${contentType}' not allowed. Supported: images, videos, PDF` },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > typeConfig.maxSize) {
      const maxMB = Math.round(typeConfig.maxSize / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${maxMB}MB for ${typeConfig.category}` },
        { status: 400 }
      );
    }

    // Generate unique key for R2 storage
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString("hex");
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `session-attachments/${session.user.id}/${timestamp}-${randomId}-${sanitizedFilename}`;

    // Generate presigned URL for upload (valid for 5 minutes)
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
        "user-id": session.user.id,
        "original-filename": filename,
        "uploaded-at": new Date().toISOString(),
        "session-id": sessionId || "unknown",
        category: typeConfig.category,
      },
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 300, // 5 minutes
    });

    // Generate public URL (or use key if public URL not configured)
    const publicUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : key;

    // Create temporary attachment ID for tracking
    const attachmentId = crypto.randomBytes(16).toString("hex");

    // Return presigned URL and metadata
    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: presignedUrl,
        attachment: {
          id: attachmentId,
          url: publicUrl,
          name: filename,
          size: fileSize,
          type: contentType,
          category: typeConfig.category,
        } as SessionAttachmentMetadata,
      },
    });
  } catch (error) {
    console.error("Session upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/upload - Confirm upload completion
export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { attachmentId } = body;

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "Missing attachment ID" },
        { status: 400 }
      );
    }

    // For session attachments, we don't create DB records until they're attached to corrections/comments
    // This endpoint just confirms the upload was successful

    return NextResponse.json({
      success: true,
      message: "Upload confirmed",
    });
  } catch (error) {
    console.error("Upload confirmation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}
