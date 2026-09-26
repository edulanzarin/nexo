import { apiRoute } from "@/lib/api-route";
import { listarRegistro } from "@/lib/ti-acessos";

/** Quem viu, copiou, trocou ou mexeu em cada acesso, do mais recente para trás. */
export const GET = apiRoute(async () => listarRegistro());
