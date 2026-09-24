import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota só o necessário em .next/standalone: imagem Docker menor e sem
  // node_modules no runtime.
  output: "standalone",
  experimental: {
    // Foto de perfil via Server Action passa do 1 MB padrão. Folga acima do teto
    // de 2 MB do avatar, para a validação do servidor responder antes do 413.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
