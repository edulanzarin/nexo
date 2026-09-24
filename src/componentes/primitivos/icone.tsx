import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Ban,
  BarChart3,
  Building2,
  Calculator,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  Circle,
  CircleDashed,
  CircleSlash,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  Command,
  Copy,
  CornerDownLeft,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Filter,
  Gauge,
  GitCompareArrows,
  Hash,
  Heart,
  History,
  Home,
  Import,
  Info,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  ListChecks,
  Loader2,
  LogOut,
  type LucideIcon,
  Mail,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Printer,
  Receipt,
  RefreshCcw,
  Repeat2,
  RotateCcw,
  Save,
  Scale,
  ScanSearch,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Table2,
  Tags,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Undo2,
  Upload,
  User,
  Users,
  Wand2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Registro de ícones por nome. Menu, seção e módulo vêm de catálogo em dado, e
 * aí o ícone precisa ser escolhido por texto. O nome diz o que o ícone
 * SIGNIFICA aqui, não o desenho da biblioteca: trocar o desenho de "conferencia"
 * é mudar uma linha, e nenhuma tela fica sabendo.
 */
export const ICONES = {
  // navegação e módulos
  inicio: Home,
  painel: LayoutDashboard,
  grade: LayoutGrid,
  banco: Landmark,
  conferencia: ClipboardCheck,
  fila: ListChecks,
  nota: FileText,
  balanca: Scale,
  planilha: FileSpreadsheet,
  lupa: ScanSearch,
  pessoas: Users,
  importar: Import,
  velocimetro: Gauge,
  relatorio: ClipboardList,
  "relatorio-conferido": FileCheck2,
  tendencia: TrendingUp,
  "tendencia-baixa": TrendingDown,
  moedas: Coins,
  escudo: ShieldCheck,
  rotatividade: Repeat2,
  calendario: CalendarDays,
  intervalo: CalendarRange,
  recibo: Receipt,
  coracao: Heart,
  calculadora: Calculator,
  engrenagem: Settings,
  camadas: Layers,
  contrato: ScrollText,
  empresa: Building2,
  tabela: Table2,
  cruzar: GitCompareArrows,
  frete: Truck,
  etiquetas: Tags,
  banco_de_dados: Database,
  atividade: Activity,
  grafico: BarChart3,
  relogio: Clock,
  cronometro: Timer,
  historico: History,
  usuario: User,
  chave: KeyRound,
  email: Mail,
  escudo_simples: Shield,
  hash: Hash,

  // ações
  executar: Play,
  buscar: Search,
  filtrar: Filter,
  baixar: Download,
  enviar: Upload,
  "enviar-arquivo": FileUp,
  imprimir: Printer,
  copiar: Copy,
  editar: Pencil,
  apagar: Trash2,
  salvar: Save,
  mais: Plus,
  menos: Minus,
  fechar: X,
  atualizar: RefreshCcw,
  desfazer: Undo2,
  reabrir: RotateCcw,
  ver: Eye,
  esconder: EyeOff,
  link: Link2,
  sair: LogOut,
  comando: Command,
  enter: CornerDownLeft,
  aprender: Wand2,
  ia: Sparkles,
  raio: Zap,
  opcoes: MoreHorizontal,
  "recolher-lateral": PanelLeftClose,
  "abrir-lateral": PanelLeftOpen,

  // direção
  "seta-direita": ArrowRight,
  "seta-esquerda": ArrowLeft,
  "seta-cima": ArrowUp,
  "seta-baixo": ArrowDown,
  "sobe-direita": ArrowUpRight,
  "desce-direita": ArrowDownRight,
  "chevron-direita": ChevronRight,
  "chevron-esquerda": ChevronLeft,
  "chevron-baixo": ChevronDown,
  "chevron-cima": ChevronUp,
  "chevrons-direita": ChevronsRight,
  "chevrons-esquerda": ChevronsLeft,
  "abre-fecha": ChevronsUpDown,
  ordenar: ArrowUpDown,

  // estado
  certo: Check,
  "certo-duplo": CheckCheck,
  ok: CheckCircle2,
  alerta: AlertTriangle,
  info: Info,
  erro: XCircle,
  bloqueado: Ban,
  ignorado: CircleSlash,
  pendente: CircleDashed,
  circulo: Circle,
  carregando: Loader2,

  // tema
  noite: Moon,
  dia: Sun,
  sistema: Monitor,
} satisfies Record<string, LucideIcon>;

export type NomeIcone = keyof typeof ICONES;

export function ehNomeIcone(nome: string): nome is NomeIcone {
  return nome in ICONES;
}

/**
 * Traço 1.75 e tamanho em px. Abaixo de 14px o ícone de linha vira mancha, então
 * o piso é 14.
 */
export function Icone({
  nome,
  tamanho = 16,
  className,
  titulo,
}: {
  nome: NomeIcone | string;
  tamanho?: number;
  className?: string;
  /** Rótulo para leitor de tela; sem ele o ícone é decorativo. */
  titulo?: string;
}) {
  const Componente = ehNomeIcone(nome) ? ICONES[nome] : CircleDashed;
  return (
    <Componente
      width={Math.max(14, tamanho)}
      height={Math.max(14, tamanho)}
      strokeWidth={1.75}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
      role={titulo ? "img" : undefined}
      className={cn("shrink-0", nome === "carregando" && "animate-spin", className)}
    />
  );
}
