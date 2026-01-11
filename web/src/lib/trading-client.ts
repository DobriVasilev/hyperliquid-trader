/**
 * Trading Client Helper
 *
 * Handles wallet decryption and Hyperliquid client creation.
 */

import { prisma } from '@/lib/db';
import { deserializeEncryptedData, decryptPrivateKeyServerSide } from '@/lib/wallet-encryption';
import { HyperliquidClient } from '@/lib/hyperliquid';

interface WalletWithClient {
  wallet: {
    id: string;
    address: string;
    nickname: string;
  };
  client: HyperliquidClient;
}

/**
 * Get a wallet and initialized Hyperliquid client
 * Uses server-side encryption - no user password needed
 *
 * @param userId - The user's ID
 * @param walletId - The wallet ID (or null for default wallet)
 * @returns The wallet and initialized client
 */
export async function getWalletClient(
  userId: string,
  walletId: string | null
): Promise<WalletWithClient> {
  // Get wallet (specific or default)
  const wallet = await prisma.userWallet.findFirst({
    where: walletId
      ? { id: walletId, userId }
      : { userId, isDefault: true },
    select: {
      id: true,
      address: true,
      nickname: true,
      encryptedKey: true,
    },
  });

  if (!wallet) {
    throw new Error(walletId ? 'Wallet not found' : 'No default wallet found');
  }

  // Decrypt private key using server-side key
  const encryptedData = deserializeEncryptedData(wallet.encryptedKey);
  const privateKey = await decryptPrivateKeyServerSide(encryptedData);

  // Create and initialize client
  const client = new HyperliquidClient(privateKey);
  await client.initialize();

  // Update last used timestamp
  await prisma.userWallet.update({
    where: { id: wallet.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    wallet: {
      id: wallet.id,
      address: wallet.address,
      nickname: wallet.nickname,
    },
    client,
  };
}

/**
 * Record a trade in the database
 */
export async function recordTrade(params: {
  userId: string;
  walletId: string;
  botId?: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  status: string;
  entryOrderId?: string;
  slOrderId?: string;
  tpOrderId?: string;
}) {
  return prisma.trade.create({
    data: {
      userId: params.userId,
      walletId: params.walletId,
      botId: params.botId,
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      leverage: params.leverage,
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      status: params.status,
      entryOrderId: params.entryOrderId,
      slOrderId: params.slOrderId,
      tpOrderId: params.tpOrderId,
    },
  });
}
