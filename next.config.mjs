/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uxyqhzfpmmbikftxolta.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/product-images/**',
      },
      {
        protocol: 'https',
        hostname: 'iorikcwltdeiitgygebk.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/templateassets/**',
      },
    ],
  },
};

export default nextConfig;
