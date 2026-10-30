/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel provides its own build output; standalone is only needed when
  // self-hosting the Docker image.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
