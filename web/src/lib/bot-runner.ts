/**
 * Bot Runner Service
 *
 * Manages running trading bots in memory.
 * Each bot runs on an interval and executes its strategy.
 */

import { prisma } from '@/lib/db';
import { deserializeEncryptedData, decryptPrivateKey } from '@/lib/wallet-encryption';
import { HyperliquidClient } from '@/lib/hyperliquid';

interface RunningBot {
  id: string;
  password: string;
  intervalId: NodeJS.Timeout | null;
  isExecuting: boolean;
}

class BotRunner {
  private runningBots: Map<string, RunningBot> = new Map();
  private readonly checkInterval = 60000; // 1 minute

  /**
   * Register a bot to start running
   */
  register(botId: string, password: string) {
    if (this.runningBots.has(botId)) {
      console.log(`Bot ${botId} already registered`);
      return;
    }

    const bot: RunningBot = {
      id: botId,
      password,
      intervalId: null,
      isExecuting: false,
    };

    // Start the interval
    bot.intervalId = setInterval(() => {
      this.runBot(botId);
    }, this.checkInterval);

    this.runningBots.set(botId, bot);
    console.log(`Bot ${botId} registered and started`);

    // Run immediately
    this.runBot(botId);
  }

  /**
   * Unregister and stop a bot
   */
  unregister(botId: string) {
    const bot = this.runningBots.get(botId);
    if (!bot) {
      console.log(`Bot ${botId} not found in registry`);
      return;
    }

    if (bot.intervalId) {
      clearInterval(bot.intervalId);
    }

    this.runningBots.delete(botId);
    console.log(`Bot ${botId} unregistered and stopped`);
  }

  /**
   * Check if a bot is running
   */
  isRunning(botId: string): boolean {
    return this.runningBots.has(botId);
  }

  /**
   * Get all running bot IDs
   */
  getRunningBotIds(): string[] {
    return Array.from(this.runningBots.keys());
  }

  /**
   * Execute a single bot run
   */
  private async runBot(botId: string) {
    const runningBot = this.runningBots.get(botId);
    if (!runningBot) return;

    // Prevent concurrent executions
    if (runningBot.isExecuting) {
      console.log(`Bot ${botId} is still executing, skipping`);
      return;
    }

    runningBot.isExecuting = true;

    try {
      // Fetch bot config from database
      const botConfig = await prisma.botConfig.findUnique({
        where: { id: botId },
        include: {
          wallet: {
            select: {
              id: true,
              encryptedKey: true,
              address: true,
            },
          },
        },
      });

      if (!botConfig) {
        console.error(`Bot ${botId} not found in database`);
        this.unregister(botId);
        return;
      }

      if (botConfig.status !== 'running') {
        console.log(`Bot ${botId} status is ${botConfig.status}, unregistering`);
        this.unregister(botId);
        return;
      }

      // Decrypt private key
      const encryptedData = deserializeEncryptedData(botConfig.wallet.encryptedKey);
      const privateKey = await decryptPrivateKey(encryptedData, runningBot.password);

      // Create Hyperliquid client
      const client = new HyperliquidClient(privateKey);
      await client.initialize();

      // Execute strategy
      await this.executeStrategy(botConfig, client);

      // Update last run time
      await prisma.botConfig.update({
        where: { id: botId },
        data: { lastRunAt: new Date() },
      });
    } catch (error) {
      console.error(`Bot ${botId} execution error:`, error);

      // Update bot status to error
      await prisma.botConfig.update({
        where: { id: botId },
        data: {
          status: 'error',
          statusMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Unregister failed bot
      this.unregister(botId);
    } finally {
      runningBot.isExecuting = false;
    }
  }

  /**
   * Execute the bot's trading strategy
   */
  private async executeStrategy(
    botConfig: {
      id: string;
      userId: string;
      walletId: string;
      symbol: string;
      strategyType: string;
      parameters: unknown;
      riskSettings: unknown;
    },
    client: HyperliquidClient
  ) {
    const { strategyType, symbol } = botConfig;
    const params = botConfig.parameters as Record<string, unknown>;
    const risk = botConfig.riskSettings as {
      riskPerTrade: number;
      maxDailyLoss: number;
      leverage: number;
      maxPositions: number;
    };

    // Get current market data
    const [accountInfo, positions, prices] = await Promise.all([
      client.getAccountInfo(),
      client.getPositions(),
      client.getMarketPrices(),
    ]);

    const currentPrice = prices[symbol];
    if (!currentPrice) {
      console.log(`No price for ${symbol}, skipping`);
      return;
    }

    // Check if we already have a position in this symbol
    const existingPosition = positions.find((p) => p.symbol === symbol);
    const positionSizeNum = existingPosition ? parseFloat(String(existingPosition.size)) : 0;
    const hasPosition = Boolean(existingPosition && Math.abs(positionSizeNum) > 0);

    // Calculate position size based on risk
    const accountValue = parseFloat(accountInfo.balance) || 0;
    const riskAmount = accountValue * (risk.riskPerTrade / 100);
    const positionSize = (riskAmount * risk.leverage) / currentPrice;

    console.log(`Bot ${botConfig.id} running strategy ${strategyType} for ${symbol}`);
    console.log(`Current price: ${currentPrice}, Account: ${accountValue}, Risk amount: ${riskAmount}`);

    // Execute strategy based on type
    switch (strategyType) {
      case 'simple-breakout':
        await this.simpleBreakoutStrategy(botConfig, client, {
          currentPrice,
          hasPosition,
          existingPosition,
          positionSize,
          risk,
          params,
        });
        break;

      case 'mean-reversion':
        await this.meanReversionStrategy(botConfig, client, {
          currentPrice,
          hasPosition,
          existingPosition,
          positionSize,
          risk,
          params,
        });
        break;

      default:
        console.log(`Unknown strategy type: ${strategyType}`);
    }
  }

  /**
   * Simple breakout strategy
   * Enters long when price breaks above resistance, short when breaks below support
   */
  private async simpleBreakoutStrategy(
    botConfig: {
      id: string;
      userId: string;
      walletId: string;
      symbol: string;
    },
    client: HyperliquidClient,
    context: {
      currentPrice: number;
      hasPosition: boolean;
      existingPosition: { size: string; entryPrice: string } | undefined;
      positionSize: number;
      risk: { leverage: number };
      params: Record<string, unknown>;
    }
  ) {
    const { currentPrice, hasPosition, existingPosition, positionSize, risk, params } = context;
    const { symbol } = botConfig;

    // Strategy parameters
    const resistance = (params.resistance as number) || currentPrice * 1.01;
    const support = (params.support as number) || currentPrice * 0.99;
    const stopLossPercent = (params.stopLossPercent as number) || 2;
    const takeProfitPercent = (params.takeProfitPercent as number) || 4;

    console.log(`Breakout: price=${currentPrice}, resistance=${resistance}, support=${support}`);

    if (hasPosition) {
      // Check if we should close existing position
      if (existingPosition) {
        const posSize = parseFloat(existingPosition.size);
        const entryPx = parseFloat(existingPosition.entryPrice);
        const pnlPercent =
          ((currentPrice - entryPx) / entryPx) *
          100 *
          (posSize > 0 ? 1 : -1);

        if (pnlPercent <= -stopLossPercent || pnlPercent >= takeProfitPercent) {
          console.log(`Closing position: PnL ${pnlPercent.toFixed(2)}%`);
          await client.closePosition(symbol);

          // Record trade
          await this.recordBotTrade(botConfig, {
            side: posSize > 0 ? 'long' : 'short',
            size: Math.abs(posSize),
            entryPrice: entryPx,
            exitPrice: currentPrice,
            pnl: pnlPercent,
            status: 'closed',
            closeReason: pnlPercent >= takeProfitPercent ? 'tp_hit' : 'sl_hit',
          });
        }
      }
    } else {
      // Look for entry signals
      if (currentPrice > resistance) {
        console.log(`LONG signal: price ${currentPrice} > resistance ${resistance}`);
        await client.setLeverage(symbol, risk.leverage);
        await client.placeMarketOrder(symbol, true, positionSize);

        const stopLoss = currentPrice * (1 - stopLossPercent / 100);
        const takeProfit = currentPrice * (1 + takeProfitPercent / 100);
        await client.placeStopLoss(symbol, true, positionSize, stopLoss);
        await client.placeTakeProfit(symbol, true, positionSize, takeProfit);

        await this.recordBotTrade(botConfig, {
          side: 'long',
          size: positionSize,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          status: 'open',
        });
      } else if (currentPrice < support) {
        console.log(`SHORT signal: price ${currentPrice} < support ${support}`);
        await client.setLeverage(symbol, risk.leverage);
        await client.placeMarketOrder(symbol, false, positionSize);

        const stopLoss = currentPrice * (1 + stopLossPercent / 100);
        const takeProfit = currentPrice * (1 - takeProfitPercent / 100);
        await client.placeStopLoss(symbol, false, positionSize, stopLoss);
        await client.placeTakeProfit(symbol, false, positionSize, takeProfit);

        await this.recordBotTrade(botConfig, {
          side: 'short',
          size: positionSize,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit,
          status: 'open',
        });
      } else {
        console.log(`No signal: price ${currentPrice} between support and resistance`);
      }
    }
  }

  /**
   * Mean reversion strategy
   * Buys when price deviates significantly below average, sells when above
   */
  private async meanReversionStrategy(
    botConfig: {
      id: string;
      userId: string;
      walletId: string;
      symbol: string;
    },
    client: HyperliquidClient,
    context: {
      currentPrice: number;
      hasPosition: boolean;
      existingPosition: { size: string; entryPrice: string } | undefined;
      positionSize: number;
      risk: { leverage: number };
      params: Record<string, unknown>;
    }
  ) {
    const { currentPrice, hasPosition, positionSize, risk, params } = context;
    const { symbol } = botConfig;

    // Strategy parameters
    const avgPrice = (params.avgPrice as number) || currentPrice;
    const deviationPercent = (params.deviationPercent as number) || 3;
    const stopLossPercent = (params.stopLossPercent as number) || 2;

    const upperBand = avgPrice * (1 + deviationPercent / 100);
    const lowerBand = avgPrice * (1 - deviationPercent / 100);

    console.log(`Mean Reversion: price=${currentPrice}, avg=${avgPrice}, bands=[${lowerBand}, ${upperBand}]`);

    if (!hasPosition) {
      if (currentPrice < lowerBand) {
        console.log(`LONG signal: price below lower band`);
        await client.setLeverage(symbol, risk.leverage);
        await client.placeMarketOrder(symbol, true, positionSize);

        const stopLoss = currentPrice * (1 - stopLossPercent / 100);
        await client.placeStopLoss(symbol, true, positionSize, stopLoss);

        await this.recordBotTrade(botConfig, {
          side: 'long',
          size: positionSize,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit: avgPrice,
          status: 'open',
        });
      } else if (currentPrice > upperBand) {
        console.log(`SHORT signal: price above upper band`);
        await client.setLeverage(symbol, risk.leverage);
        await client.placeMarketOrder(symbol, false, positionSize);

        const stopLoss = currentPrice * (1 + stopLossPercent / 100);
        await client.placeStopLoss(symbol, false, positionSize, stopLoss);

        await this.recordBotTrade(botConfig, {
          side: 'short',
          size: positionSize,
          entryPrice: currentPrice,
          stopLoss,
          takeProfit: avgPrice,
          status: 'open',
        });
      }
    }
  }

  /**
   * Record a trade made by the bot
   */
  private async recordBotTrade(
    botConfig: {
      id: string;
      userId: string;
      walletId: string;
      symbol: string;
    },
    trade: {
      side: 'long' | 'short';
      size: number;
      entryPrice: number;
      exitPrice?: number;
      stopLoss?: number;
      takeProfit?: number;
      pnl?: number;
      status: string;
      closeReason?: string;
    }
  ) {
    const tradeRecord = await prisma.trade.create({
      data: {
        userId: botConfig.userId,
        walletId: botConfig.walletId,
        botId: botConfig.id,
        symbol: botConfig.symbol,
        side: trade.side,
        size: trade.size,
        leverage: 1,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        pnl: trade.pnl,
        status: trade.status,
        closeReason: trade.closeReason,
      },
    });

    // Update bot stats
    if (trade.status === 'closed' && trade.pnl !== undefined) {
      await prisma.botConfig.update({
        where: { id: botConfig.id },
        data: {
          totalTrades: { increment: 1 },
          winningTrades: trade.pnl > 0 ? { increment: 1 } : undefined,
          losingTrades: trade.pnl <= 0 ? { increment: 1 } : undefined,
          totalPnl: { increment: trade.pnl },
          lastTradeAt: new Date(),
        },
      });
    }

    return tradeRecord;
  }
}

// Singleton instance
export const botRunner = new BotRunner();
