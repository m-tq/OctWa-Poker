import { InputHTMLAttributes, forwardRef } from 'react';

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ label, showValue = true, formatValue, className = '', id, value, min, max, ...props }, ref) => {
    const sliderId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
    const displayValue = formatValue ? formatValue(numValue) : numValue;

    return (
      <div className="flex flex-col gap-2">
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <label 
                htmlFor={sliderId} 
                className="text-sm font-medium text-foreground"
              >
                {label}
              </label>
            )}
            {showValue && (
              <span className="text-sm text-muted font-mono">
                {displayValue}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          id={sliderId}
          type="range"
          value={value}
          min={min}
          max={max}
          className={`
            w-full h-2 bg-secondary appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-primary
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          aria-valuemin={Number(min)}
          aria-valuemax={Number(max)}
          aria-valuenow={numValue}
          {...props}
        />
        <div className="flex justify-between text-xs text-muted">
          <span>{formatValue ? formatValue(Number(min)) : min}</span>
          <span>{formatValue ? formatValue(Number(max)) : max}</span>
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';
