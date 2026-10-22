import type { ScannerErrorKind } from "@yudiel/react-qr-scanner";

const messages: Record<ScannerErrorKind, string> = {
  "permission-denied": "Camera permission was denied. Open the browser site controls, allow Camera, then try again.",
  "no-camera": "No camera was found. Connect or enable a camera, or use the manual QR fallback.",
  "in-use": "The camera is being used by another app or browser tab. Close it there, then try again.",
  "overconstrained": "This camera cannot satisfy the requested settings. Try another camera or use the manual fallback.",
  "insecure-context": "Camera access requires HTTPS or http://localhost. Open Movmak using http://localhost:3000.",
  unsupported: "This browser does not support camera access. Use a current Chrome, Edge, Firefox, or Safari browser.",
  aborted: "Camera startup was interrupted. Try again.",
  security: "The browser blocked camera access. Check site and operating-system camera permissions.",
  "type-error": "The camera could not start because the browser rejected its settings.",
  unknown: "The camera could not start. Check browser permission and whether another app is using it.",
};

export function cameraErrorMessage(kind: ScannerErrorKind) {
  return messages[kind];
}
