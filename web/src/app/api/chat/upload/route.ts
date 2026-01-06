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

// Allowed file types and limits
const ALLOWED_TYPES: Record<string, { maxSize: number; category: string }> = {
  // Images
  "image/jpeg": { maxSize: 10 * 1024 * 1024, category: "image" }, // 10MB
  "image/png": { maxSize: 10 * 1024 * 1024, category: "image" },
  "image/gif": { maxSize: 5 * 1024 * 1024, category: "image" }, // 5MB for GIFs
  "image/webp": { maxSize: 10 * 1024 * 1024, category: "image" },
  // Videos
  "video/mp4": { maxSize: 50 * 1024 * 1024, category: "video" }, // 50MB
  "video/webm": { maxSize: 50 * 1024 * 1024, category: "video" },
  "video/quicktime": { maxSize: 50 * 1024 * 1024, category: "video" },
  // Audio
  "audio/mpeg": { maxSize: 10 * 1024 * 1024, category: "audio" }, // 10MB
  "audio/mp4": { maxSize: 10 * 1024 * 1024, category: "audio" },
  "audio/webm": { maxSize: 10 * 1024 * 1024, category: "audio" },
  "audio/ogg": { maxSize: 10 * 1024 * 1024, category: "audio" },
  "audio/wav": { maxSize: 20 * 1024 * 1024, category: "audio" }, // 20MB for WAV
  // Documents
  "application/pdf": { maxSize: 20 * 1024 * 1024, category: "document" }, // 20MB
  "application/msword": { maxSize: 10 * 1024 * 1024, category: "document" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    maxSize: 10 * 1024 * 1024,
    category: "document",
  },
  "application/vnd.ms-excel": { maxSize: 10 * 1024 * 1024, category: "document" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    maxSize: 10 * 1024 * 1024,
    category: "document",
  },
  "text/plain": { maxSize: 1 * 1024 * 1024, category: "document" }, // 1MB
  "text/csv": { maxSize: 5 * 1024 * 1024, category: "document" },
  // Archives
  "application/zip": { maxSize: 50 * 1024 * 1024, category: "archive" },
  "application/x-rar-compressed": { maxSize: 50 * 1024 * 1024, category: "archive" },
};

// POST /api/chat/upload - Get presigned URL for direct upload
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
    // Rate limiting
    const allowed = await checkUploadRateLimit(session.user.id);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Too many uploads. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { filename, contentType, fileSize, channelId } = body;

    // Validate file type
    const typeConfig = ALLOWED_TYPES[contentType];
    if (!typeConfig) {
      return NextResponse.json(
        { success: false, error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > typeConfig.maxSize) {
      const maxMB = Math.round(typeConfig.maxSize / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${maxMB}MB` },
        { status: 400 }
      );
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString("hex");
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `chat/${session.user.id}/${timestamp}-${randomId}-${sanitizedFilename}`;

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
        "user-id": session.user.id,
        "original-filename": filename,
        "uploaded-at": new Date().toISOString(),
        "channel-id": channelId || "global",
        category: typeConfig.category,
      },
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 300, // 5 minutes
    });

    // Generate public URL
    const publicUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;

    // Create attachment record in database
    const attachment = await prisma.chatAttachment.create({
      data: {
        userId: session.user.id,
        channelId: channelId || null,
        filename: filename,
        key: key,
        url: publicUrl || key,
        contentType: contentType,
        size: fileSize,
        category: typeConfig.category,
        status: "pending", // Will be updated to 'uploaded' after successful upload
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: presignedUrl,
        key: key,
        publicUrl: publicUrl,
        attachmentId: attachment.id,
        expiresIn: 300,
      },
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { success: false, error: "Failed to prepare upload" },
      { status: 500 }
    );
  }
}

// PATCH /api/chat/upload - Confirm upload completed
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
    const { attachmentId, thumbnailUrl } = body;

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "Attachment ID required" },
        { status: 400 }
      );
    }

    // Update attachment status
    const attachment = await prisma.chatAttachment.update({
      where: {
        id: attachmentId,
        userId: session.user.id, // Ensure user owns this attachment
      },
      data: {
        status: "uploaded",
        thumbnailUrl: thumbnailUrl || null,
        uploadedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: attachment,
    });
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/upload - Delete an attachment
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("id");

    if (!attachmentId) {
      return NextResponse.json(
        { success: false, error: "Attachment ID required" },
        { status: 400 }
      );
    }

    // Mark as deleted (soft delete)
    await prisma.chatAttachment.update({
      where: {
        id: attachmentId,
        userId: session.user.id,
      },
      data: {
        status: "deleted",
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
