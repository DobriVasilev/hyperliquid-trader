import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  // Only admins can mark as implemented
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { implementationNotes } = body;

    // Fetch feedback to get user email
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
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

    // Update feedback status
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: {
        status: "IMPLEMENTED",
        implementedAt: new Date(),
        implementedById: session.user.id,
        implementationNotes: implementationNotes || undefined,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        implementedBy: {
          select: {
            name: true,
          },
        },
      },
    });

    // TODO: Send email notification to user
    // This would use Resend or similar email service
    // Example:
    // await sendFeedbackImplementedEmail({
    //   to: feedback.user.email,
    //   userName: feedback.user.name,
    //   feedbackTitle: feedback.title,
    //   feedbackId: feedback.id,
    // });

    return NextResponse.json({
      success: true,
      data: updatedFeedback,
    });
  } catch (error) {
    console.error("Error marking feedback as implemented:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update feedback" },
      { status: 500 }
    );
  }
}
