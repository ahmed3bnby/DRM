import type { NextConfig } from "next";
const config: NextConfig = {
  output: 'standalone',
  // tesseract.js spawns a worker from its own package path; bundling it breaks that path and
  // the OCR request hangs forever. Load it from node_modules at runtime instead.
  serverExternalPackages: ['tesseract.js'],
  // Files read at runtime by path (not import), so the serverless bundle must include them:
  // OCR language data + tesseract's worker script and WASM core.
  outputFileTracingIncludes: {
    '/api/ocr/scan': ['./ocr-data/**', './node_modules/tesseract.js/src/**', './node_modules/tesseract.js-core/**'],
  },
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-XSS-Protection", value: "1; mode=block" }
    ] }];
  }
};
export default config;
