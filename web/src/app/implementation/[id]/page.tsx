import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ImplementationSession } from "@/components/implementation/ImplementationSession";

export default async function ImplementationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  const implementation = await prisma.implementationSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      phase: true,
      status: true,
    },
  });

  if (!implementation) {
    redirect("/admin");
  }

  return (
    <ImplementationSession
      sessionId={implementation.id}
      title={implementation.title}
      description={implementation.description || undefined}
      type={implementation.type}
    />
  );
}
