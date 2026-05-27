import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';

interface SecurityGuardProps {
  children: React.ReactNode;
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({ children }) => {
  const { user } = useAuthStore();
  const [isScreenHidden, setIsScreenHidden] = useState(false);
  const [currentHour, setCurrentHour] = useState('');

  // 1. Dynamic Watermark Hour Update (keeps the timestamp accurate)
  useEffect(() => {
    const updateHour = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const timePart = now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      setCurrentHour(`${datePart} ${timePart}`);
    };
    
    updateHour();
    const interval = setInterval(updateHour, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // 2. Focus Loss Detection (Instantly blanks the screen when focusing out / switching apps)
  useEffect(() => {
    const handleBlur = () => {
      setIsScreenHidden(true);
    };

    const handleFocus = () => {
      setIsScreenHidden(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsScreenHidden(true);
      } else if (document.visibilityState === 'visible') {
        setIsScreenHidden(false);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // If the document is not active on initial mount, hide it
    if (!document.hasFocus()) {
      setIsScreenHidden(true);
    }

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 3. Keyboard Shortcut and Context Menu Overrides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        try {
          navigator.clipboard.writeText(''); // Clear clipboard contents
        } catch {
          // Clipboard API might be restricted under certain browsers
        }
      }

      // Block Ctrl+P / Cmd+P (Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Block Ctrl+S / Cmd+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Block F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
      }

      // Block Ctrl+Shift+I / Ctrl+Shift+C / Ctrl+Shift+J / Cmd+Opt+I (Developer Console / Element Inspect)
      if (
        (e.ctrlKey || e.metaKey) && 
        e.shiftKey && 
        (e.key === 'I' || e.key === 'C' || e.key === 'J' || e.key === 'i' || e.key === 'c' || e.key === 'j')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Block Ctrl+U / Cmd+Opt+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  // 4. Construct tiled SVG dynamic watermark background
  const userName = user?.name || 'KATTALAI SYSTEM';
  const userEmail = user?.email || 'SECURE WORKSPACE';
  
  // Escape potential SVG/HTML breaking characters to avoid security/parsing issues
  const cleanName = userName.replace(/["'<>]/g, '');
  const cleanEmail = userEmail.replace(/["'<>]/g, '');

  const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
  <style>
    .wm-txt {
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      fill: #848E9C;
    }
  </style>
  <g transform="rotate(-20 150 100)">
    <text x="150" y="80" class="wm-txt" font-size="10.5" text-anchor="middle" opacity="0.11">
      ${cleanName}
    </text>
    <text x="150" y="100" class="wm-txt" font-size="8.5" text-anchor="middle" opacity="0.11">
      ${cleanEmail}
    </text>
    <text x="150" y="120" class="wm-txt" font-size="8" text-anchor="middle" opacity="0.11">
      ${currentHour}
    </text>
  </g>
</svg>
  `.trim();

  const base64Svg = typeof window !== 'undefined' ? btoa(unescape(encodeURIComponent(svgString))) : '';
  const watermarkBg = base64Svg ? `url("data:image/svg+xml;base64,${base64Svg}")` : '';

  return (
    <>
      {/* Dynamic Watermark Overlay */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: watermarkBg,
          backgroundRepeat: 'repeat',
          pointerEvents: 'none',
          zIndex: 999999,
        }}
      />

      {/* Focus Loss Protection Overlay (Blank Screen) */}
      {isScreenHidden && <div className="security-blank-screen" />}

      {/* Actual App Pages */}
      {children}
    </>
  );
};
