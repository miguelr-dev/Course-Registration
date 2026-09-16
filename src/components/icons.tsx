import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, sw = 1.8): SVGProps<SVGSVGElement> => ({ width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true });

export const Check = ({ size = 14, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M3 8.5l3 3 7-7" /></svg>;
export const X = ({ size = 14, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M4 4l8 8" /><path d="M12 4l-8 8" /></svg>;
export const Warn = ({ size = 14, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 2.5L14.5 13.5H1.5L8 2.5z" /><path d="M8 7v3" /><path d="M8 12.2v.1" /></svg>;
export const ErrorIcon = ({ size = 16, ...p }: P) => <svg {...base(size)} {...p}><circle cx="8" cy="8" r="6.5" /><path d="M8 5v3.5" /><path d="M8 11v.1" /></svg>;
export const Info = ({ size = 16, ...p }: P) => <svg {...base(size)} {...p}><circle cx="8" cy="8" r="6.5" /><path d="M8 7.5V11" /><path d="M8 5v.1" /></svg>;
export const Clock = ({ size = 14, ...p }: P) => <svg {...base(size, 1.6)} {...p}><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>;
export const UserIcon = ({ size = 16, ...p }: P) => <svg {...base(size, 1.6)} {...p}><circle cx="8" cy="5.5" r="3" /><path d="M2.5 14c.7-3 3-4.5 5.5-4.5s4.8 1.5 5.5 4.5" /></svg>;
export const Search = ({ size = 16, ...p }: P) => <svg {...base(size)} {...p}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>;
export const ChevronDown = ({ size = 14, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 6l4 4 4-4" /></svg>;
export const ChevronUp = ({ size = 14, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 10l4-4 4 4" /></svg>;
export const Print = ({ size = 16, ...p }: P) => <svg {...base(size, 1.6)} {...p}><path d="M4 6V2.5h8V6" /><rect x="2" y="6" width="12" height="5.5" rx="1" /><path d="M4.5 9.5h7v4h-7z" /></svg>;
export const Help = ({ size = 16, ...p }: P) => <svg {...base(size, 1.6)} {...p}><circle cx="8" cy="8" r="6.5" /><path d="M6.2 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.8.7-.8 1.3" /><path d="M8 11.5v.1" /></svg>;
export const Note = ({ size = 14, ...p }: P) => <svg {...base(size, 1.6)} {...p}><path d="M3 2.5h7l3 3v8H3z" /><path d="M5.5 8h5" /><path d="M5.5 10.5h5" /></svg>;
export const Lock = ({ size = 14, ...p }: P) => <svg {...base(size, 1.6)} {...p}><rect x="3" y="7" width="10" height="7" rx="1.2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>;
export const Plus = ({ size = 14, ...p }: P) => <svg {...base(size, 2)} {...p}><path d="M8 3v10" /><path d="M3 8h10" /></svg>;
export const SignOut = ({ size = 14, ...p }: P) => <svg {...base(size, 1.6)} {...p}><path d="M6 2.5H3v11h3" /><path d="M10 5l3 3-3 3" /><path d="M13 8H6.5" /></svg>;
