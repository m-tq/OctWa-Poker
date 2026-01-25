import { useState } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/Button';
import { User, AlertCircle, Check } from 'lucide-react';
import { API_URL } from '@/config';

// Username validation: 3-16 chars, alphanumeric only
const USERNAME_REGEX = /^[a-zA-Z0-9]{3,16}$/;

export function UsernameSetupDialog() {
  const { showUsernameSetup, setShowUsernameSetup, setUsername, connection } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 16) {
      return 'Username must be at most 16 characters';
    }
    if (!USERNAME_REGEX.test(value)) {
      return 'Only letters and numbers allowed';
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value) {
      setError(validateUsername(value));
    } else {
      setError(null);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateUsername(inputValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!connection?.walletPubKey) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save username to server
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: connection.walletPubKey,
          name: inputValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save username');
      }

      // Success - save to store and close dialog
      setUsername(inputValue);
      setShowUsernameSetup(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isValid = inputValue.length >= 3 && !error;

  if (!showUsernameSetup) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - no click to close */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Set Your Username</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted">
            Choose a username for your poker profile. This will be visible to other players.
          </p>

          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Enter username"
                maxLength={16}
                className={`
                  w-full px-4 py-3 rounded-lg border bg-secondary text-foreground
                  placeholder:text-muted focus:outline-none focus:ring-2
                  ${error ? 'border-red-500 focus:ring-red-500/50' : 'border-border focus:ring-primary/50'}
                `}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid) {
                    handleSubmit();
                  }
                }}
              />
              {isValid && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <p className="text-xs text-muted">
              3-16 characters, letters and numbers only
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            loading={loading}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
