import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateFeedbackPrompt, generateQuickPrompt, generateEmailFormat } from "@/lib/feedback-prompt-generator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Only admins can generate prompts
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { format = "full" } = body; // "full", "quick", or "email"

    // Fetch feedback with all related data
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        attachments: {
          select: {
            url: true,
            filename: true,
            category: true,
          },
        },
      },
    });

    if (!feedback) {
      return NextResponse.json(
        { success: false, error: "Feedback not found" },
        { status: 404 }
      );
    }

    // Transform feedback data to match expected format (convert Date to string)
    const feedbackData = {
      ...feedback,
      createdAt: feedback.createdAt.toISOString(),
    };

    let result;

    switch (format) {
      case "quick":
        result = {
          prompt: generateQuickPrompt(feedbackData),
        };
        break;

      case "email":
        result = generateEmailFormat(feedbackData);
        break;

      case "full":
      default:
        result = {
          prompt: generateFeedbackPrompt(feedbackData),
        };
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error generating prompt:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate prompt" },
      { status: 500 }
    );
  }
}
