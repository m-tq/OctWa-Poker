/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-foreground": "var(--color-primary-foreground)",
        secondary: "var(--color-secondary)",
        muted: "var(--color-muted)",
        destructive: "#dc2626",
        success: "#16a34a",
        warning: "#ca8a04",
        // Poker-specific
        "table-felt": "var(--color-table-felt)",
        "table-border": "var(--color-table-border)",
        "chip-gold": "var(--color-chip-gold)",
        "chip-red": "var(--color-chip-red)",
        "chip-blue": "var(--color-chip-blue)",
        "chip-green": "var(--color-chip-green)",
        "chip-black": "var(--color-chip-black)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["Fira Code", "Cascadia Code", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        none: "0",
      },
      animation: {
        // Card animations
        "card-deal": "cardDeal 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "card-flip": "cardFlip 0.4s ease-out both",
        "card-reveal": "cardReveal 0.3s ease-out both",
        // Chip animations
        "chip-move": "chipMove 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "chip-collect": "chipCollect 0.5s ease-in both",
        "pot-grow": "potGrow 0.3s ease-out",
        // Glow / pulse
        "turn-glow": "turnGlow 1.5s ease-in-out infinite",
        "urgent-glow": "urgentGlow 0.8s ease-in-out infinite",
        "pulse-slow": "subtlePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "win-pulse": "winPulse 1.5s ease-in-out infinite",
        // Slide / Fade
        "slide-in-bottom": "slideInFromBottom 0.3s ease-out both",
        "slide-in-left": "slideInFromLeft 0.25s ease-out both",
        "fade-in": "fadeIn 0.3s ease-out both",
        "fade-in-up": "fadeInUp 0.35s ease-out both",
        "fade-in-scale": "fadeInScale 0.25s ease-out both",
        "zoom-in": "zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        // Dealer
        "dealer-bounce": "dealerBounce 2s ease-in-out infinite",
        // Chat / notifications
        "new-message": "newMessage 1s ease-out both",
        "notification-badge":
          "notificationBadge 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
      keyframes: {
        // Card
        cardDeal: {
          "0%": {
            transform: "translateY(-60px) scale(0.85) rotate(-5deg)",
            opacity: "0",
          },
          "50%": { opacity: "0.7" },
          "100%": {
            transform: "translateY(0) scale(1) rotate(0deg)",
            opacity: "1",
          },
        },
        cardFlip: {
          "0%": {
            transform: "perspective(400px) rotateY(90deg) scale(0.9)",
            opacity: "0.3",
          },
          "50%": {
            transform: "perspective(400px) rotateY(45deg) scale(0.95)",
            opacity: "0.6",
          },
          "100%": {
            transform: "perspective(400px) rotateY(0deg) scale(1)",
            opacity: "1",
          },
        },
        cardReveal: {
          "0%": { transform: "scale(0.9)", opacity: "0", filter: "blur(4px)" },
          "100%": { transform: "scale(1)", opacity: "1", filter: "blur(0)" },
        },
        // Chip
        chipMove: {
          "0%": { transform: "scale(0.3) translateY(20px)", opacity: "0" },
          "60%": { transform: "scale(1.1) translateY(-4px)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        chipCollect: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.3) translateY(-40px)", opacity: "0" },
        },
        potGrow: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        // Glow / Pulse
        turnGlow: {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(250, 204, 21, 0.25)" },
          "50%": { boxShadow: "0 0 20px 6px rgba(250, 204, 21, 0.45)" },
        },
        urgentGlow: {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(239, 68, 68, 0.3)" },
          "50%": { boxShadow: "0 0 24px 8px rgba(239, 68, 68, 0.6)" },
        },
        subtlePulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        winPulse: {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(250, 204, 21, 0.4)",
          },
          "50%": {
            transform: "scale(1.02)",
            boxShadow: "0 0 20px 10px rgba(250, 204, 21, 0.15)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(250, 204, 21, 0)",
          },
        },
        // Slide / Fade
        slideInFromBottom: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInFromLeft: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInScale: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        zoomIn: {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Dealer
        dealerBounce: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        // Chat / Notification
        newMessage: {
          "0%": { backgroundColor: "rgba(59, 130, 246, 0.15)" },
          "100%": { backgroundColor: "transparent" },
        },
        notificationBadge: {
          "0%": { transform: "scale(0)" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        88: "22rem",
        100: "25rem",
        112: "28rem",
        128: "32rem",
      },
      transitionDuration: {
        400: "400ms",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "glow-yellow": "0 0 12px 4px rgba(250, 204, 21, 0.3)",
        "glow-red": "0 0 12px 4px rgba(239, 68, 68, 0.3)",
        "glow-green": "0 0 12px 4px rgba(34, 197, 94, 0.3)",
        "glow-blue": "0 0 12px 4px rgba(59, 130, 246, 0.3)",
        "inner-glow": "inset 0 0 30px rgba(0, 0, 0, 0.4)",
        card: "0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)",
        "card-hover":
          "0 8px 25px rgba(0, 0, 0, 0.3), 0 3px 8px rgba(0, 0, 0, 0.15)",
      },
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        100: "100",
      },
    },
  },
  plugins: [],
};
