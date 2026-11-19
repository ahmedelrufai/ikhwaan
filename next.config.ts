import type { NextConfig } from 'next';
import path from 'node:path';
const config:NextConfig={poweredByHeader:false,distDir:process.env.NEXT_DIST_DIR||'.next',outputFileTracingRoot:path.resolve(process.cwd())};
export default config;
