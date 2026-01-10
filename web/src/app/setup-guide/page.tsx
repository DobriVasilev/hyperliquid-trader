"use client";

import Link from "next/link";

export default function SetupGuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Getting Started with Hyperliquid</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="mb-8">
          <p className="text-gray-400 text-lg">
            This guide will help you set up your Hyperliquid account and connect it to our trading platform.
            The entire process takes about 5-10 minutes.
          </p>
        </div>

        {/* Important Notice */}
        <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-semibold text-yellow-400">US Users: VPN Required for Setup Only</div>
              <p className="text-sm text-yellow-200/70 mt-1">
                Hyperliquid is not available in the US. You&apos;ll need a VPN to create your account initially.
                After setup, you can use our platform to trade without a VPN - we handle the routing for you.
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">1</div>
              <h2 className="text-lg font-semibold">Get a Free VPN (US users only)</h2>
            </div>
            <p className="text-gray-400 mb-4">
              Download one of these free VPNs and connect to a European server (Germany, Netherlands, etc.):
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <a
                href="https://protonvpn.com/free-vpn"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
              >
                <div className="font-semibold text-blue-400">ProtonVPN</div>
                <div className="text-sm text-gray-500">Free tier available, no data limits</div>
                <div className="text-xs text-gray-600 mt-2">Recommended - Swiss privacy</div>
              </a>
              <a
                href="https://windscribe.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
              >
                <div className="font-semibold text-blue-400">Windscribe</div>
                <div className="text-sm text-gray-500">10GB/month free</div>
                <div className="text-xs text-gray-600 mt-2">Good speeds, many locations</div>
              </a>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              You only need the VPN for the next 5 minutes while creating your account.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">2</div>
              <h2 className="text-lg font-semibold">Create Hyperliquid Account</h2>
            </div>
            <p className="text-gray-400 mb-4">
              With VPN connected to Europe:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>
                Go to{" "}
                <a
                  href="https://app.hyperliquid.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  app.hyperliquid.xyz
                </a>
              </li>
              <li>Click &quot;Connect Wallet&quot; and connect with MetaMask or another wallet</li>
              <li>Sign the message to authenticate</li>
              <li>Your account is now created!</li>
            </ol>
          </div>

          {/* Step 3 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">3</div>
              <h2 className="text-lg font-semibold">Export Your Private Key</h2>
            </div>
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-red-200">
                  <strong>Security Tip:</strong> Create a NEW wallet just for trading. Never use your main wallet
                  with significant funds. Only deposit what you&apos;re willing to risk.
                </div>
              </div>
            </div>
            <p className="text-gray-400 mb-4">
              To trade through our platform, you need your wallet&apos;s private key:
            </p>
            <div className="space-y-3 text-gray-300">
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="font-medium mb-1">MetaMask:</div>
                <div className="text-sm text-gray-400">
                  Settings → Security & Privacy → Reveal Secret Recovery Phrase
                  <br />
                  Or for specific account: Account Details → Export Private Key
                </div>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="font-medium mb-1">Other Wallets:</div>
                <div className="text-sm text-gray-400">
                  Look for &quot;Export Private Key&quot; or &quot;Backup&quot; in settings
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">4</div>
              <h2 className="text-lg font-semibold">Deposit Funds</h2>
            </div>
            <p className="text-gray-400 mb-4">
              Deposit USDC to your Hyperliquid account:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>On Hyperliquid, click &quot;Deposit&quot;</li>
              <li>Choose &quot;Arbitrum&quot; network (lowest fees)</li>
              <li>Send USDC from your wallet or exchange</li>
              <li>Wait 1-2 minutes for confirmation</li>
            </ol>
            <p className="text-sm text-gray-500 mt-4">
              Minimum deposit: $10 USDC. Start small while testing!
            </p>
          </div>

          {/* Step 5 */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold">5</div>
              <h2 className="text-lg font-semibold">Add Wallet to Our Platform</h2>
            </div>
            <p className="text-gray-400 mb-4">
              Now disconnect your VPN - you won&apos;t need it anymore!
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>
                Go to{" "}
                <Link href="/trading" className="text-blue-400 hover:underline">
                  Trading
                </Link>
              </li>
              <li>Click &quot;+ Add Wallet&quot;</li>
              <li>Enter a nickname (e.g., &quot;Trading Account&quot;)</li>
              <li>Paste your private key</li>
              <li>Create a strong encryption password</li>
              <li>Click &quot;Add Wallet&quot;</li>
            </ol>
            <div className="mt-4 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="text-sm text-green-200">
                  Your private key is encrypted with AES-256 before storage.
                  Only you can decrypt it with your password.
                </div>
              </div>
            </div>
          </div>

          {/* Done */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-lg font-semibold mb-2">You&apos;re All Set!</h2>
            <p className="text-gray-400 mb-6">
              You can now trade on Hyperliquid through our platform, set up automated bots,
              and manage your positions - all without needing a VPN.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/trading"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Start Trading
              </Link>
              <Link
                href="/bots/new"
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Create a Bot
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Is my private key safe?</h3>
              <p className="text-gray-400 text-sm">
                Your private key is encrypted using AES-256-GCM encryption with a key derived from your password
                using scrypt (a secure key derivation function). The encrypted key is stored on our server,
                but can only be decrypted with your password, which we never store.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Why do I need a VPN only once?</h3>
              <p className="text-gray-400 text-sm">
                The VPN is only needed to create your Hyperliquid account from a non-US IP address.
                After that, our server (located in Europe) handles all communication with Hyperliquid,
                so you don&apos;t need a VPN for everyday trading.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">What if I forget my encryption password?</h3>
              <p className="text-gray-400 text-sm">
                We cannot recover your encryption password. If you forget it, you&apos;ll need to remove
                the wallet from our platform and add it again with a new password.
                Your funds on Hyperliquid are safe - only the local encryption is affected.
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Can I withdraw funds through this platform?</h3>
              <p className="text-gray-400 text-sm">
                Currently, withdrawals must be done directly on Hyperliquid (use VPN if needed).
                Our platform is focused on trading and bot automation.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
