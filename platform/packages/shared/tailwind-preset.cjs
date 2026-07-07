/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Canvas & Surface (CSS variable bridge) ────────────
        bg:      { DEFAULT: 'var(--bg)', elevated: 'var(--bg-elevated)' },
        surface: { DEFAULT: 'var(--surface)', raised: 'var(--surface-raised)', overlay: 'var(--surface-overlay)' },

        // ── Text ──────────────────────────────────────────────
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          inverse:   'var(--text-inverse)',
        },

        // ── Borders ───────────────────────────────────────────
        border: {
          DEFAULT: 'var(--border)',
          subtle:  'var(--border-subtle)',
          strong:  'var(--border-strong)',
          accent:  'var(--border-accent)',
        },

        // ── Hover ─────────────────────────────────────────────
        hover: { DEFAULT: 'var(--hover-bg)' },

        // ── Accent (per-app override in app tailwind.config) ──
        accent: {
          DEFAULT:    'var(--accent)',
          hover:      'var(--accent-hover)',
          muted:      'var(--accent-muted)',
          subtle:     'var(--accent-subtle)',
          fg:         'var(--accent-fg)',
        },

        // ── Severity Colors (shared across both apps) ─────────
        critical: { DEFAULT: 'var(--critical)', bg: 'var(--critical-bg)', text: 'var(--critical-text)' },
        high:     { DEFAULT: 'var(--high)',     bg: 'var(--high-bg)',     text: 'var(--high-text)' },
        medium:   { DEFAULT: 'var(--medium)',   bg: 'var(--medium-bg)',   text: 'var(--medium-text)' },
        low:      { DEFAULT: 'var(--low)',      bg: 'var(--low-bg)',      text: 'var(--low-text)' },
        info:     { DEFAULT: 'var(--info-color)', bg: 'var(--info-bg)',   text: 'var(--info-text)' },
        success:  { DEFAULT: 'var(--success)',  bg: 'var(--success-bg)',  text: 'var(--success-text)' },
      },

      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },

      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4' }],
        xs:    ['12px', { lineHeight: '1.4' }],
        sm:    ['13px', { lineHeight: '1.5' }],
        base:  ['14px', { lineHeight: '1.5' }],
        md:    ['15px', { lineHeight: '1.5' }],
        lg:    ['16px', { lineHeight: '1.4' }],
        xl:    ['18px', { lineHeight: '1.3' }],
        '2xl': ['20px', { lineHeight: '1.3' }],
        '3xl': ['24px', { lineHeight: '1.2' }],
        '4xl': ['30px', { lineHeight: '1.1' }],
        '5xl': ['36px', { lineHeight: '1.1' }],
      },

      borderRadius: {
        card:  '6px',
        btn:   '4px',
        input: '4px',
        tag:   '3px',
        pill:  '9999px',
      },

      boxShadow: {
        card:       'var(--glow-card)',
        'card-hover': 'var(--glow-hover)',
        'card-accent': 'var(--glow-accent)',
        focus:      'var(--glow-focus)',
        none:       'none',
      },

      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '64px',
        header:  '56px',
      },

      transitionDuration: {
        fast:    '120ms',
        DEFAULT: '150ms',
        slow:    '350ms',
      },

      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'slide-right': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'reveal-up': {
          from: { opacity: '0', transform: 'translateY(16px)', filter: 'blur(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'count-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        'stroke-draw': {
          from: { strokeDashoffset: '100' },
          to:   { strokeDashoffset: '0' },
        },
      },

      animation: {
        'fade-up':     'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in':     'fade-in 0.3s ease both',
        'scale-in':    'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-right': 'slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'reveal-up':   'reveal-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer:       'shimmer 1.8s ease-in-out infinite',
        'count-up':    'count-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-soft':  'pulse-soft 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
