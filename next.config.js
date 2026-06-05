/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit이 내부적으로 읽는 .afm 폰트 메타데이터를 서버 번들에 포함시킨다.
  outputFileTracingIncludes: {
    "/api/submit": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

module.exports = nextConfig;
