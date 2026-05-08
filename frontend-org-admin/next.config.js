/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // required for the Docker multi-stage build
};

module.exports = nextConfig;
