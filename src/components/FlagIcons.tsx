import React from 'react';
import type { AppLanguage } from '../services/i18n';

interface FlagProps {
  className?: string;
}

/**
 * Local SVG flag of Spain — renders identically on Windows, Android, iOS, and macOS
 * without relying on OS flag emoji support.
 */
export const SpainFlagSvg: React.FC<FlagProps> = ({ className = 'w-7 h-5' }) => (
  <svg
    viewBox="0 0 36 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} rounded-[3px] shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`}
    aria-hidden="true"
  >
    <rect width="36" height="24" rx="2" fill="#AA151B" />
    <rect y="6" width="36" height="12" fill="#F1BF00" />
    {/* Simplified coat of arms emblem */}
    <g transform="translate(8, 8.2)">
      <rect x="0.8" y="1.6" width="4.4" height="4.8" rx="0.8" fill="#AA151B" stroke="#8C1015" strokeWidth="0.35" />
      <rect x="1.1" y="1.9" width="1.9" height="2.1" fill="#C60B1E" />
      <rect x="3" y="1.9" width="1.9" height="2.1" fill="#FFFFFF" />
      <rect x="1.1" y="4" width="1.9" height="2.1" fill="#F1BF00" />
      <rect x="3" y="4" width="1.9" height="2.1" fill="#AA151B" />
      <circle cx="3" cy="4" r="0.7" fill="#0039A6" />
      <path d="M1.2 1.4 L3 0.2 L4.8 1.4 Z" fill="#F1BF00" stroke="#8C6D00" strokeWidth="0.3" />
      <rect x="-0.4" y="2.2" width="0.7" height="3.8" rx="0.2" fill="#E5E7EB" />
      <rect x="5.7" y="2.2" width="0.7" height="3.8" rx="0.2" fill="#E5E7EB" />
    </g>
  </svg>
);

/**
 * Local SVG flag of the United States — renders identically on Windows, Android, iOS, and macOS
 * without relying on OS flag emoji support.
 */
export const UsFlagSvg: React.FC<FlagProps> = ({ className = 'w-7 h-5' }) => (
  <svg
    viewBox="0 0 36 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} rounded-[3px] shrink-0 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`}
    aria-hidden="true"
  >
    <rect width="36" height="24" rx="2" fill="#FFFFFF" />
    {/* 7 red stripes out of 13 total */}
    <rect y="0" width="36" height="1.85" fill="#B22234" />
    <rect y="3.69" width="36" height="1.85" fill="#B22234" />
    <rect y="7.38" width="36" height="1.85" fill="#B22234" />
    <rect y="11.08" width="36" height="1.85" fill="#B22234" />
    <rect y="14.77" width="36" height="1.85" fill="#B22234" />
    <rect y="18.46" width="36" height="1.85" fill="#B22234" />
    <rect y="22.15" width="36" height="1.85" fill="#B22234" />
    {/* Blue canton */}
    <rect width="15.5" height="12.93" fill="#3C3B6E" />
    {/* Clean white stars grid */}
    <g fill="#FFFFFF">
      <circle cx="2.2" cy="2.1" r="0.65" />
      <circle cx="5.0" cy="2.1" r="0.65" />
      <circle cx="7.8" cy="2.1" r="0.65" />
      <circle cx="10.6" cy="2.1" r="0.65" />
      <circle cx="13.4" cy="2.1" r="0.65" />

      <circle cx="3.6" cy="4.3" r="0.65" />
      <circle cx="6.4" cy="4.3" r="0.65" />
      <circle cx="9.2" cy="4.3" r="0.65" />
      <circle cx="12.0" cy="4.3" r="0.65" />

      <circle cx="2.2" cy="6.5" r="0.65" />
      <circle cx="5.0" cy="6.5" r="0.65" />
      <circle cx="7.8" cy="6.5" r="0.65" />
      <circle cx="10.6" cy="6.5" r="0.65" />
      <circle cx="13.4" cy="6.5" r="0.65" />

      <circle cx="3.6" cy="8.7" r="0.65" />
      <circle cx="6.4" cy="8.7" r="0.65" />
      <circle cx="9.2" cy="8.7" r="0.65" />
      <circle cx="12.0" cy="8.7" r="0.65" />

      <circle cx="2.2" cy="10.9" r="0.65" />
      <circle cx="5.0" cy="10.9" r="0.65" />
      <circle cx="7.8" cy="10.9" r="0.65" />
      <circle cx="10.6" cy="10.9" r="0.65" />
      <circle cx="13.4" cy="10.9" r="0.65" />
    </g>
  </svg>
);

export const LanguageFlag: React.FC<{ lang: AppLanguage; className?: string }> = ({
  lang,
  className = 'w-6 h-4',
}) => (lang === 'en' ? <UsFlagSvg className={className} /> : <SpainFlagSvg className={className} />);
