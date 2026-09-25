import type { SVGProps } from "react";

/**
 * Os ícones dos setores (módulos) do NaveX, desenhados para o sistema no mesmo
 * idioma do logo NX: peças sólidas, cortes a 45°, um canto arredondado e o
 * respiro entre as peças. Ícone de biblioteca (calculadora, engrenagem) é o
 * mesmo de mil outros sistemas; o do setor é identidade e tem que ser nosso.
 *
 * Cada um é uma peça de 24 × 24 pintada com `currentColor`: quem pinta é o
 * quadrado de identidade do módulo. Julgados no tamanho de uso (18, 28, 36) nos
 * dois temas e na silhueta antes de entrar.
 */
type Props = Omit<SVGProps<SVGSVGElement>, "children"> & { strokeWidth?: number | string };

function fabricar(nome: string, pecas: string[]) {
  function IconeSetor({ strokeWidth: _traco, ...props }: Props) {
    void _traco;
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        {pecas.map((d, i) => (
          <path key={i} d={d} fillRule="evenodd" />
        ))}
      </svg>
    );
  }
  IconeSetor.displayName = nome;
  return IconeSetor;
}

/** Contábil: o razonete, a conta em T, com um lançamento a débito e um a crédito. */
export const SetorContabil = fabricar("SetorContabil", [
  "M2.5 5.9A2.4 2.4 0 0 1 4.9 3.5L21.5 3.5L18 7L2.5 7Z",
  "M10.4 9L13.6 9L13.6 21L10.4 21Z",
  "M2.5 11L8.4 11L8.4 13.8L2.5 13.8Z",
  "M15.6 15.4L21.5 15.4L21.5 18.2L15.6 18.2Z",
]);

/** Fiscal: o % do tributo. */
export const SetorFiscal = fabricar("SetorFiscal", [
  "M3.5 5.9A2.4 2.4 0 0 1 5.9 3.5L9.5 3.5L9.5 9.5L3.5 9.5Z",
  "M3.2 18.2L18.2 3.2L20.8 5.8L5.8 20.8Z",
  "M14.5 14.5L20.5 14.5L20.5 17.5L17.5 20.5L14.5 20.5Z",
]);

/** DP: a pessoa da folha, com os ombros cortados a 45°. */
export const SetorDp = fabricar("SetorDp", [
  "M8.5 6A3.5 3.5 0 0 1 15.5 6L15.5 9.5L8.5 9.5Z",
  "M8 11.8L16 11.8L20.5 16.3L20.5 21L3.5 21L3.5 16.3Z",
]);

/** RH: o coração, geométrico: dois arcos e o V a 45°. */
export const SetorRh = fabricar("SetorRh", ["M12 21L3.4 12.4A4.8 4.8 0 0 1 12 5.8A4.8 4.8 0 0 1 20.6 12.4Z"]);

/** Obrigações: o calendário com o visto vazado. */
export const SetorObrigacoes = fabricar("SetorObrigacoes", [
  "M3 8A3 3 0 0 1 6 5L7 5L7 2.5L9.6 2.5L9.6 5L14.4 5L14.4 2.5L17 2.5L17 5L21 5L21 21L3 21Z" +
    "M7.9 12.9L10.4 15.4L16.3 9.5L18.1 11.3L10.4 19L6.1 14.7Z",
]);

/** Societário: o quadro da estrutura societária, a sociedade sobre os sócios. */
export const SetorSocietario = fabricar("SetorSocietario", [
  "M8 4.9A2.4 2.4 0 0 1 10.4 2.5L16 2.5L16 8.5L8 8.5Z",
  "M2.5 10.4L21.5 10.4L21.5 12.6L2.5 12.6Z",
  "M2.5 14.5L10 14.5L10 21L2.5 21Z",
  "M14 14.5L21.5 14.5L21.5 17.5L18 21L14 21Z",
]);

/** Configurações: os dois controles de ajuste. */
export const SetorConfig = fabricar("SetorConfig", [
  "M2.5 5.2L13 5.2L13 3L18.4 3L18.4 5.2L21.5 5.2L21.5 7.8L18.4 7.8L18.4 10L13 10L13 7.8L2.5 7.8Z",
  "M2.5 16.2L5.6 16.2L5.6 16.4A2.4 2.4 0 0 1 8 14L11 14L11 16.2L21.5 16.2L21.5 18.8L11 18.8L11 21L5.6 21L5.6 18.8L2.5 18.8Z",
]);
