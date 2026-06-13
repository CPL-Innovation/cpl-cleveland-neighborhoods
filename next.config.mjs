/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The derived JPEGs are served from Supabase Storage public URLs. We use plain <img>
  // (not next/image) in the ported components, so no remotePatterns config is required yet.
};

export default nextConfig;
