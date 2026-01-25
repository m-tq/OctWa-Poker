import {
  OctraSDK,
  OctraError,
} from '@octwa/sdk';
import type {
  Connection,
  Capability,
  CapabilityRequest,
  InvocationRequest,
  InvocationResult,
} from '@octwa/sdk';
import { POKER_CIRCLE, POKER_METHODS } from '@/config';

// Singleton SDK instance
let sdkInstance: OctraSDK | null = null;

// Cached capability
let cachedCapability: Capability | null = null;

export async function initSDK(): Promise<OctraSDK> {
  if (!sdkInstance) {
    sdkInstance = await OctraSDK.init({
      timeout: 5000,
      skipSignatureVerification: false,
    });
  }
  return sdkInstance;
}

export function getSDK(): OctraSDK | null {
  return sdkInstance;
}

export function isInstalled(): boolean {
  return sdkInstance?.isInstalled() ?? false;
}

export async function connect(): Promise<Connection> {
  const sdk = await initSDK();
  return sdk.connect({
    circle: POKER_CIRCLE,
    appOrigin: window.location.origin,
  });
}

export async function disconnect(): Promise<void> {
  const sdk = getSDK();
  if (sdk) {
    await sdk.disconnect();
  }
  cachedCapability = null;
}

export async function requestCapability(
  request?: Partial<Omit<CapabilityRequest, 'circle'>>
): Promise<Capability> {
  const sdk = getSDK();
  if (!sdk) {
    throw new OctraError('NOT_CONNECTED', 'SDK not initialized');
  }

  const state = sdk.getSessionState();
  if (!state.circle) {
    throw new OctraError('NOT_CONNECTED', 'No circle connected');
  }

  const cap = await sdk.requestCapability({
    circle: state.circle,
    methods: [...POKER_METHODS],
    scope: 'write',
    encrypted: false,
    ttlSeconds: 14400, // 4 hours (same as DEX)
    ...request,
  });
  
  cachedCapability = cap;
  return cap;
}

/**
 * Try to find valid capability from SDK session
 * Returns null if no valid capability found
 */
export async function findValidCapability(storedCapabilityId?: string): Promise<Capability | null> {
  const sdk = getSDK();
  if (!sdk) return null;

  const state = sdk.getSessionState();
  if (!state.connected) return null;

  // First try to find by stored ID
  if (storedCapabilityId) {
    const existingCap = state.activeCapabilities.find(
      c => c.id === storedCapabilityId && c.expiresAt > Date.now()
    );
    if (existingCap) {
      cachedCapability = existingCap;
      return existingCap;
    }
  }

  // Try to find any valid capability with get_balance method
  const validCap = state.activeCapabilities.find(
    c => c.methods.includes('get_balance') && c.expiresAt > Date.now()
  );
  
  if (validCap) {
    cachedCapability = validCap;
    return validCap;
  }

  return null;
}

/**
 * Get or request capability
 * First tries to find existing valid capability
 * If requestIfMissing is true, will request new capability if none found
 */
export async function getOrRequestCapability(
  storedCapabilityId?: string,
  requestIfMissing: boolean = false
): Promise<Capability | null> {
  // Check cached capability
  if (cachedCapability && cachedCapability.expiresAt > Date.now()) {
    return cachedCapability;
  }

  // Try to find valid capability in SDK session
  const existingCap = await findValidCapability(storedCapabilityId);
  if (existingCap) {
    return existingCap;
  }

  // Only request new capability if explicitly asked
  if (requestIfMissing) {
    try {
      return await requestCapability();
    } catch (err) {
      console.error('[SDK] Failed to request capability:', err);
      return null;
    }
  }

  return null;
}

export async function invoke(request: InvocationRequest): Promise<InvocationResult> {
  const sdk = getSDK();
  if (!sdk) {
    throw new OctraError('NOT_CONNECTED', 'SDK not initialized');
  }
  return sdk.invoke(request);
}

// Helper to parse invoke result data
export function parseInvokeData<T>(data: unknown): T {
  if (data instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(data));
  }

  if (typeof data === 'object' && data !== null) {
    // Check if already parsed
    if (!('0' in data)) {
      return data as T;
    }

    // Object with numeric keys (serialized Uint8Array)
    const obj = data as Record<string, number>;
    const keys = Object.keys(obj).filter((k) => !isNaN(Number(k)));
    const length = keys.length;
    if (length > 0) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = obj[i.toString()];
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    }
  }

  throw new Error('Invalid data format');
}

// Get balance using capability
export async function getBalance(capabilityId: string): Promise<number> {
  const result = await invoke({
    capabilityId,
    method: 'get_balance',
  });

  if (result.success && result.data) {
    const data = parseInvokeData<{ balance?: number; octBalance?: number }>(result.data);
    return data.balance ?? data.octBalance ?? 0;
  }

  return 0;
}

// Send transaction using capability
export async function sendTransaction(
  capabilityId: string,
  to: string,
  amount: number,
  message?: string
): Promise<{ txHash: string }> {
  const payload: { to: string; amount: number; message?: string } = { to, amount };
  if (message) {
    payload.message = message;
  }

  const result = await invoke({
    capabilityId,
    method: 'send_transaction',
    payload: new TextEncoder().encode(JSON.stringify(payload)),
  });

  if (!result.success) {
    throw new Error('Transaction failed');
  }

  const data = parseInvokeData<{ txHash: string }>(result.data);
  return data;
}

export { OctraError };
