import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CHANNELS = [
  {
    name: "General",
    description: "General discussion and announcements",
    icon: "💬",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Trading",
    description: "Discuss trading strategies, setups, and market analysis",
    icon: "📈",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Technical Analysis",
    description: "Share and discuss technical analysis patterns and indicators",
    icon: "📊",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Market News",
    description: "Latest market news, events, and macro updates",
    icon: "📰",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Crypto",
    description: "Cryptocurrency trading and analysis",
    icon: "🪙",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Stocks",
    description: "Stock market discussions and equity analysis",
    icon: "🏛️",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Forex",
    description: "Foreign exchange market discussions",
    icon: "💱",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Help & Support",
    description: "Get help with the platform and ask questions",
    icon: "❓",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Pattern Tool",
    description: "Discussions about the Pattern Tool and swing detection",
    icon: "🎯",
    isDefault: true,
    type: "public" as const,
  },
  {
    name: "Feedback",
    description: "Share feedback, suggestions, and feature requests",
    icon: "💡",
    isDefault: true,
    type: "public" as const,
  },
];

async function main() {
  console.log("🌱 Starting seed...\n");

  // Find or create a system user for default channel creation
  let systemUser = await prisma.user.findFirst({
    where: { email: "system@pattern-tool.app" },
  });

  if (!systemUser) {
    console.log("Creating system user...");
    systemUser = await prisma.user.create({
      data: {
        id: "system",
        email: "system@pattern-tool.app",
        name: "System",
        image: null,
      },
    });
    console.log("✅ System user created\n");
  }

  // Create default channels
  console.log("Creating default channels...\n");

  for (const channelData of DEFAULT_CHANNELS) {
    const existing = await prisma.chatChannel.findFirst({
      where: { name: channelData.name, isDefault: true },
    });

    if (existing) {
      console.log(`⏭️  Channel "${channelData.name}" already exists, skipping`);
      continue;
    }

    const channel = await prisma.chatChannel.create({
      data: {
        name: channelData.name,
        description: channelData.description,
        icon: channelData.icon,
        type: channelData.type,
        isDefault: channelData.isDefault,
        createdById: systemUser.id,
      },
    });

    console.log(`✅ Created channel: ${channelData.icon} ${channel.name}`);
  }

  console.log("\n🎉 Seed completed successfully!");

  // Print summary
  const channelCount = await prisma.chatChannel.count({ where: { isDefault: true } });
  console.log(`\n📊 Summary:`);
  console.log(`   - Default channels: ${channelCount}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
