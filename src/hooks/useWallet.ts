import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import { connect, requestCapability, initSDK, isInstalled, getBalance, disconnect, getOrRequestCapability } from '@/sdk/octra';
import { POKER_CIRCLE, API_URL } from '@/config';

type ConnectionStep = 'connect' | 'authorize' | 'ready';

export function useWallet() {
  const {
    connected,
    connection,
    capability,
    octBalance,
    username,
    _hasHydrated,
    setConnection,
    setCapability,
    setOctBalance,
    setBalanceLoading,
    setUsername,
    setShowUsernameSetup,
    addError,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<ConnectionStep>('connect');
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const initRef = useRef(false);

  // Initialize SDK on mount
  useEffect(() => {
    if (initRef.current) return;
    
    const initializeSDK = async () => {
      if (!_hasHydrated) return;
      
      initRef.current = true;
      
      try {
        await initSDK();
        console.log('[useWallet] SDK initialized');
        
        // Try to restore connection if persisted
        if (connection?.circle === POKER_CIRCLE) {
          console.log('[useWallet] Restoring connection from storage');
          try {
            const restoredConn = await connect();
            console.log('[useWallet] Connection restored:', restoredConn?.walletPubKey);
            // Update connection in case it changed
            if (restoredConn) {
              setConnection(restoredConn);
              
              // Try to find or request capability automatically
              const storedCapId = capability?.id;
              console.log('[useWallet] Trying to restore capability:', storedCapId);
              const validCap = await getOrRequestCapability(storedCapId);
              if (validCap) {
                console.log('[useWallet] Capability restored/obtained:', validCap.id);
                setCapability(validCap);
              } else {
                console.log('[useWallet] No valid capability found, user needs to authorize');
                setCapability(null);
              }
            }
          } catch (err) {
            console.error('[useWallet] Failed to restore connection:', err);
            setConnection(null);
            setCapability(null);
          }
        }
        
        setSdkInitialized(true);
      } catch (err) {
        console.error('[useWallet] Failed to initialize SDK:', err);
        initRef.current = false;
      }
    };
    
    initializeSDK();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]); // Only depend on hydration, not connection/capability to avoid loops

  // Update step based on connection state
  useEffect(() => {
    if (!_hasHydrated || !sdkInitialized) return;
    
    if (!connected || connection?.circle !== POKER_CIRCLE) {
      setStep('connect');
    } else if (!capability) {
      setStep('authorize');
    } else {
      setStep('ready');
    }
  }, [_hasHydrated, sdkInitialized, connected, connection, capability]);

  // Check if user needs to set username after authorization
  useEffect(() => {
    if (!capability || !connection?.walletPubKey || !sdkInitialized) return;
    if (username) return; // Already has username

    const checkUsername = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/${connection.walletPubKey}/exists`);
        if (response.ok) {
          const data = await response.json();
          if (data.exists && data.name) {
            // User exists, restore username
            setUsername(data.name);
          } else {
            // New user, show username setup
            setShowUsernameSetup(true);
          }
        }
      } catch (err) {
        console.error('[useWallet] Failed to check username:', err);
        // Show setup dialog on error to be safe
        setShowUsernameSetup(true);
      }
    };

    checkUsername();
  }, [capability, connection?.walletPubKey, sdkInitialized, username, setUsername, setShowUsernameSetup]);

  // Fetch balance when capability is available and SDK is ready
  useEffect(() => {
    if (!capability || !sdkInitialized) return;

    let isMounted = true;

    const fetchBalance = async () => {
      console.log('[useWallet] Fetching balance for capability:', capability.id);
      setBalanceLoading(true);
      try {
        const balance = await getBalance(capability.id);
        if (isMounted) {
          console.log('[useWallet] Balance fetched:', balance);
          setOctBalance(balance);
        }
      } catch (err) {
        const errorMsg = (err as Error).message || '';
        console.error('[useWallet] Failed to fetch balance:', errorMsg);
        
        // If capability is invalid/expired/not found - try to get new one silently
        if (
          isMounted && (
            errorMsg.includes('not found') ||
            errorMsg.includes('invalid') ||
            errorMsg.includes('expired') ||
            errorMsg.includes('Capability')
          )
        ) {
          console.log('[useWallet] Capability invalid, trying to get new one...');
          try {
            const newCap = await getOrRequestCapability();
            if (newCap && isMounted) {
              console.log('[useWallet] Got new capability:', newCap.id);
              setCapability(newCap);
              // Retry balance fetch with new capability
              const balance = await getBalance(newCap.id);
              setOctBalance(balance);
              return;
            }
          } catch {
            // Failed to get new capability, clear for re-authorization
          }
          
          if (isMounted) {
            console.log('[useWallet] Could not get valid capability, clearing...');
            setCapability(null);
            setOctBalance(null);
          }
        }
      } finally {
        if (isMounted) {
          setBalanceLoading(false);
        }
      }
    };

    fetchBalance();
    
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [capability, sdkInitialized, setOctBalance, setBalanceLoading, setCapability]);

  const handleConnect = useCallback(async () => {
    setLoading(true);
    try {
      await initSDK();
      if (!isInstalled()) {
        addError('NOT_INSTALLED', 'Please install OctWa wallet extension');
        return;
      }
      const conn = await connect();
      setConnection(conn);
    } catch (err) {
      addError('CONNECTION_FAILED', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setConnection, addError]);

  const handleAuthorize = useCallback(async () => {
    setLoading(true);
    try {
      const cap = await requestCapability();
      setCapability(cap);
    } catch (err) {
      addError('AUTHORIZE_FAILED', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setCapability, addError]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('[useWallet] Disconnect error:', err);
    }
    setConnection(null);
    setCapability(null);
    setOctBalance(null);
  }, [setConnection, setCapability, setOctBalance]);

  return {
    // State
    connected,
    connection,
    capability,
    octBalance,
    step,
    loading,
    sdkInitialized,
    isReady: _hasHydrated && sdkInitialized && step === 'ready',
    
    // Actions
    handleConnect,
    handleAuthorize,
    handleDisconnect,
  };
}
