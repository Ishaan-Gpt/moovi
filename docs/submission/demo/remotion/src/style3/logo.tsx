import React from "react";
import { LogoMark, wordmark } from "./kit/type";

// Our own mark for the study clone (never the reference's logo): a tilted shopping bag in two pinks + wordmark.
const drawIcon = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.rotate(-0.18);
  c.strokeStyle = "#6E3FD8";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(0, -8, 14, Math.PI, 0);
  c.stroke();
  const g = c.createLinearGradient(-26, -8, 26, 30);
  g.addColorStop(0, "#FF4F8B");
  g.addColorStop(1, "#C21E6E");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-26, -8);
  c.lineTo(26, -8);
  c.lineTo(30, 30);
  c.quadraticCurveTo(0, 38, -30, 30);
  c.closePath();
  c.fill();
  c.fillStyle = "#7B4BE8";
  c.beginPath();
  c.moveTo(-30, 14);
  c.quadraticCurveTo(0, 26, 30, 10);
  c.lineTo(30, 30);
  c.quadraticCurveTo(0, 38, -30, 30);
  c.closePath();
  c.fill();
  c.restore();
};

/** Logo.draw(c, x, y, s, chars?) on any canvas (screens in 3D shots); built with the kit's wordmark() */
// word near-black like ref A's (sampled #0A0508 at 12.2 s; was navy)
export const Logo = wordmark({ word: "Bundance", color: "#150D14", icon: drawIcon, track: 0.4 });

/** the logo as a crisp DOM element (canvas, 2x); `ks` = per-letter type-on progress (tracking closes as it types) */
export const LogoDom: React.FC<{ scale: number; style?: React.CSSProperties; chars?: number; ks?: number[] }> = ({ scale, style, chars = 8, ks }) => (
  <LogoMark mark={Logo} scale={scale} chars={chars} ks={ks} style={style} />
);
/** the icon alone (no word) as a DOM canvas, same 360×90 frame as LogoDom so it lines up */
export const LogoIcon: React.FC<{ scale: number; style?: React.CSSProperties }> = ({ scale, style }) => <LogoMark mark={Logo} scale={scale} chars={0} style={style} />;
