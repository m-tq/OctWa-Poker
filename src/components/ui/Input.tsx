import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label 
            htmlFor={inputId} 
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            px-3 py-2 text-sm
            bg-background border border-border
            text-foreground placeholder:text-muted
            focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-destructive focus:border-destructive focus:ring-destructive' : ''}
            ${className}
          `}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <span 
            id={`${inputId}-error`} 
            className="text-xs text-destructive"
            role="alert"
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
