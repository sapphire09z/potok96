/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media-staging.potok96.ru", pathname: "/media/**" },
      { protocol: "https", hostname: "media.potok96.ru", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
