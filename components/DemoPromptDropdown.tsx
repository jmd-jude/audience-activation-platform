'use client';

import { useState, useRef, useEffect } from 'react';

export const DEMO_PROMPTS = [
  "Help me reach eco-conscious luxury car shoppers for our new electric SUV launch",
  "Find high-value homeowners likely to need HVAC replacement or home improvement financing",
  "Identify affluent frequent travelers for a premium credit card acquisition campaign",
  "Reach households with young children who are likely in-market for life insurance",
  "Identify skilled Blue Collar professionals in rural areas who have been offered high credit limits ($5k+) and show high purchase activity in the outdoors category for a targeted campaign on high-end ATVs or camping trailers",
];

interface DemoPromptDropdownProps {
  onSelect: (prompt: string) => void;
  prompts?: string[];
}

export function DemoPromptDropdown({ onSelect, prompts = DEMO_PROMPTS }: DemoPromptDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
          color: open ? 'var(--orange, #7c8d44)' : 'var(--gray-400, #9ca3af)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          textTransform: 'uppercase',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--orange, #7c8d44)')}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.color = 'var(--gray-400, #9ca3af)';
        }}
      >
        Try an example {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 50,
            background: 'white',
            border: '1px solid var(--cream-dark, #dce2da)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            minWidth: '320px',
            maxWidth: '400px',
          }}
        >
          {prompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelect(prompt);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.875rem',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '0.82rem',
                color: 'var(--navy, #1e2a33)',
                background: 'none',
                border: 'none',
                borderBottom: idx < prompts.length - 1 ? '1px solid var(--cream-dark, #dce2da)' : 'none',
                cursor: 'pointer',
                lineHeight: '1.4',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cream, #ecf0ea)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
