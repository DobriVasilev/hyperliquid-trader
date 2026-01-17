import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as fs from "fs";
import * as path from "path";

const WORKSPACE_DIR = "/tmp/claude-workspace";
const FEEDBACK_QUEUE_DIR = path.join(WORKSPACE_DIR, "feedback-queue");

/**
 * GET /api/admin/queue - Get all queue items
 * Admin only
 *
 * Returns pending, processing, completed, and failed queue items
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    // Ensure queue directory exists
    if (!fs.existsSync(FEEDBACK_QUEUE_DIR)) {
      fs.mkdirSync(FEEDBACK_QUEUE_DIR, { recursive: true });
    }

    // Read all files in queue directory
    const files = fs.readdirSync(FEEDBACK_QUEUE_DIR);

    // Categorize queue items
    const pending: any[] = [];
    const processing: any[] = [];
    const completed: any[] = [];
    const failed: any[] = [];
    const retry: any[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(FEEDBACK_QUEUE_DIR, file);
        const stats = fs.statSync(filePath);

        // Parse file data
        let fileData: any = {};
        if (file.endsWith(".json")) {
          const content = fs.readFileSync(filePath, "utf8");
          fileData = JSON.parse(content);
        }

        const item = {
          filename: file,
          path: filePath,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          ...fileData,
        };

        // Categorize by suffix
        if (file.endsWith(".processed")) {
          completed.push(item);
        } else if (file.endsWith(".failed")) {
          failed.push(item);
        } else if (file.includes(".retry.")) {
          const retryMatch = file.match(/\.retry\.(\d+)/);
          const retryCount = retryMatch ? parseInt(retryMatch[1]) : 0;
          retry.push({ ...item, retryCount });
        } else if (file.endsWith(".json")) {
          // Check if currently processing (modified recently)
          const ageMs = Date.now() - stats.mtime.getTime();
          if (ageMs < 60000) {
            // Modified in last minute
            processing.push(item);
          } else {
            pending.push(item);
          }
        }
      } catch (error) {
        console.error(`Error reading queue file ${file}:`, error);
      }
    }

    // Sort by creation time (newest first)
    const sortByDate = (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    pending.sort(sortByDate);
    processing.sort(sortByDate);
    completed.sort(sortByDate);
    failed.sort(sortByDate);
    retry.sort(sortByDate);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          pending: pending.length,
          processing: processing.length,
          completed: completed.length,
          failed: failed.length,
          retry: retry.length,
        },
        items: {
          pending,
          processing,
          completed: completed.slice(0, 20), // Limit to recent 20
          failed,
          retry,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/queue - Manually trigger queue item processing
 * Admin only
 *
 * Body: { action: "retry", executionId: "..." }
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, executionId } = body;

    if (action === "retry") {
      // Find failed file
      const failedFile = path.join(
        FEEDBACK_QUEUE_DIR,
        `${executionId}.json.failed`
      );

      if (!fs.existsSync(failedFile)) {
        return NextResponse.json(
          { success: false, error: "Failed queue item not found" },
          { status: 404 }
        );
      }

      // Rename back to .json to retry
      const retryFile = path.join(FEEDBACK_QUEUE_DIR, `${executionId}.json`);
      fs.renameSync(failedFile, retryFile);

      return NextResponse.json({
        success: true,
        message: "Queue item marked for retry",
      });
    } else if (action === "cancel") {
      // Find pending or retry file
      const pendingFile = path.join(
        FEEDBACK_QUEUE_DIR,
        `${executionId}.json`
      );
      const retryFiles = fs
        .readdirSync(FEEDBACK_QUEUE_DIR)
        .filter((f) => f.startsWith(executionId) && f.includes(".retry."));

      let found = false;

      if (fs.existsSync(pendingFile)) {
        fs.unlinkSync(pendingFile);
        found = true;
      }

      for (const retryFile of retryFiles) {
        const retryPath = path.join(FEEDBACK_QUEUE_DIR, retryFile);
        fs.unlinkSync(retryPath);
        found = true;
      }

      if (!found) {
        return NextResponse.json(
          { success: false, error: "Queue item not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Queue item cancelled",
      });
    } else if (action === "clear_completed") {
      // Clear all .processed files
      const files = fs.readdirSync(FEEDBACK_QUEUE_DIR);
      let count = 0;

      for (const file of files) {
        if (file.endsWith(".processed")) {
          const filePath = path.join(FEEDBACK_QUEUE_DIR, file);
          fs.unlinkSync(filePath);
          count++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Cleared ${count} completed items`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error managing queue:", error);
    return NextResponse.json(
      { success: false, error: "Failed to manage queue" },
      { status: 500 }
    );
  }
}
