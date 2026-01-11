/**
 * Security Module
 *
 * Handles PIN verification, email codes, and security levels for sensitive actions.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

// ============================================================================
// SECURITY LEVELS
// ============================================================================

export type SecurityAction =
  | 'withdraw'
  | 'emergency_withdraw'
  | 'delete_wallet'
  | 'change_settings'
  | 'add_wallet';

export interface SecurityRequirement {
  pin: boolean;
  email: boolean;
}

export const SECURITY_LEVELS: Record<SecurityAction, SecurityRequirement> = {
  withdraw: { pin: true, email: true },
  emergency_withdraw: { pin: true, email: true },
  delete_wallet: { pin: true, email: false },
  change_settings: { pin: true, email: false },
  add_wallet: { pin: false, email: false },
};

// ============================================================================
// PIN CONSTANTS
// ============================================================================

const PIN_LENGTH = 6;
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_ROUNDS = 10;

// Weak PINs to reject
const WEAK_PINS = [
  '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999',
  '123456', '654321', '012345', '543210',
  '123123', '456456', '789789',
];

// ============================================================================
// EMAIL CODE CONSTANTS
// ============================================================================

const CODE_LENGTH = 6;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CODE_ATTEMPTS = 3;
const MIN_CODE_INTERVAL_MS = 60 * 1000; // 1 minute between sends

// ============================================================================
// PIN FUNCTIONS
// ============================================================================

/**
 * Validate PIN format and strength
 */
export function validatePinFormat(pin: string): { valid: boolean; error?: string } {
  // Must be exactly 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: 'PIN must be exactly 6 digits' };
  }

  // Reject weak PINs
  if (WEAK_PINS.includes(pin)) {
    return { valid: false, error: 'PIN is too simple. Avoid sequential or repeated digits.' };
  }

  // Reject if all digits are the same
  if (/^(\d)\1{5}$/.test(pin)) {
    return { valid: false, error: 'PIN cannot be all the same digit' };
  }

  // Reject sequential patterns (ascending or descending)
  const digits = pin.split('').map(Number);
  let isSequential = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) {
      isSequential = false;
      break;
    }
  }
  if (isSequential) {
    return { valid: false, error: 'PIN cannot be sequential digits' };
  }

  isSequential = true;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] - 1) {
      isSequential = false;
      break;
    }
  }
  if (isSequential) {
    return { valid: false, error: 'PIN cannot be sequential digits' };
  }

  return { valid: true };
}

/**
 * Hash a PIN for storage
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

/**
 * Verify a PIN against stored hash
 */
export async function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Check if user is locked out from PIN attempts
 */
export function isUserLockedOut(pinLockedUntil: Date | null): boolean {
  if (!pinLockedUntil) return false;
  return new Date() < pinLockedUntil;
}

/**
 * Get lockout remaining time in seconds
 */
export function getLockoutRemaining(pinLockedUntil: Date | null): number {
  if (!pinLockedUntil) return 0;
  const remaining = pinLockedUntil.getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Set up a new PIN for user
 */
export async function setupPin(userId: string, pin: string): Promise<{ success: boolean; error?: string }> {
  const validation = validatePinFormat(pin);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const hashedPin = await hashPin(pin);

  await prisma.user.update({
    where: { id: userId },
    data: {
      securityPin: hashedPin,
      pinAttempts: 0,
      pinLockedUntil: null,
      pinSetAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Verify user's PIN
 */
export async function verifyPin(
  userId: string,
  pin: string
): Promise<{ success: boolean; error?: string; attemptsRemaining?: number; lockedUntil?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      securityPin: true,
      pinAttempts: true,
      pinLockedUntil: true,
    },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (!user.securityPin) {
    return { success: false, error: 'PIN not set up' };
  }

  // Check lockout
  if (isUserLockedOut(user.pinLockedUntil)) {
    const remaining = getLockoutRemaining(user.pinLockedUntil);
    return {
      success: false,
      error: `Too many attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
      lockedUntil: user.pinLockedUntil!,
    };
  }

  // Verify PIN
  const isValid = await verifyPinHash(pin, user.securityPin);

  if (isValid) {
    // Reset attempts on success
    await prisma.user.update({
      where: { id: userId },
      data: { pinAttempts: 0, pinLockedUntil: null },
    });
    return { success: true };
  }

  // Increment attempts
  const newAttempts = user.pinAttempts + 1;
  const shouldLock = newAttempts >= MAX_PIN_ATTEMPTS;

  await prisma.user.update({
    where: { id: userId },
    data: {
      pinAttempts: newAttempts,
      pinLockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
    },
  });

  if (shouldLock) {
    return {
      success: false,
      error: 'Too many incorrect attempts. Account locked for 15 minutes.',
      lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
    };
  }

  return {
    success: false,
    error: 'Incorrect PIN',
    attemptsRemaining: MAX_PIN_ATTEMPTS - newAttempts,
  };
}

/**
 * Check if user has PIN set up
 */
export async function hasPinSetup(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { securityPin: true },
  });
  return !!user?.securityPin;
}

// ============================================================================
// EMAIL CODE FUNCTIONS
// ============================================================================

/**
 * Generate a random 6-digit code
 */
function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash an email code for storage
 */
async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

/**
 * Create and send a security code
 */
export async function createSecurityCode(
  userId: string,
  action: SecurityAction
): Promise<{ success: boolean; error?: string; code?: string }> {
  // Check for recent code (rate limiting)
  const recentCode = await prisma.securityCode.findFirst({
    where: {
      userId,
      action,
      createdAt: { gt: new Date(Date.now() - MIN_CODE_INTERVAL_MS) },
    },
  });

  if (recentCode) {
    return { success: false, error: 'Please wait 1 minute before requesting another code' };
  }

  // Generate and hash code
  const code = generateCode();
  const hashedCode = await hashCode(code);

  // Delete old codes for this action
  await prisma.securityCode.deleteMany({
    where: { userId, action },
  });

  // Create new code
  await prisma.securityCode.create({
    data: {
      userId,
      code: hashedCode,
      action,
      expiresAt: new Date(Date.now() + CODE_EXPIRY_MS),
    },
  });

  // Return the plain code (to be sent via email)
  return { success: true, code };
}

/**
 * Verify an email security code
 */
export async function verifySecurityCode(
  userId: string,
  action: SecurityAction,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const securityCode = await prisma.securityCode.findFirst({
    where: {
      userId,
      action,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!securityCode) {
    return { success: false, error: 'No verification code found. Please request a new one.' };
  }

  // Check expiry
  if (new Date() > securityCode.expiresAt) {
    return { success: false, error: 'Verification code expired. Please request a new one.' };
  }

  // Check attempts
  if (securityCode.attempts >= MAX_CODE_ATTEMPTS) {
    return { success: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  // Verify code
  const isValid = await bcrypt.compare(code, securityCode.code);

  if (!isValid) {
    // Increment attempts
    await prisma.securityCode.update({
      where: { id: securityCode.id },
      data: { attempts: securityCode.attempts + 1 },
    });
    return {
      success: false,
      error: `Incorrect code. ${MAX_CODE_ATTEMPTS - securityCode.attempts - 1} attempts remaining.`,
    };
  }

  // Mark as used
  await prisma.securityCode.update({
    where: { id: securityCode.id },
    data: { usedAt: new Date() },
  });

  return { success: true };
}

// ============================================================================
// COMBINED SECURITY CHECK
// ============================================================================

/**
 * Get security requirements for an action
 */
export function getSecurityRequirements(action: SecurityAction): SecurityRequirement {
  return SECURITY_LEVELS[action] || { pin: false, email: false };
}

/**
 * Check if user needs to set up PIN before performing action
 */
export async function needsPinSetup(userId: string, action: SecurityAction): Promise<boolean> {
  const requirements = getSecurityRequirements(action);
  if (!requirements.pin) return false;
  return !(await hasPinSetup(userId));
}

/**
 * Mask email for display (d***@gmail.com)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 5))}@${domain}`;
}
