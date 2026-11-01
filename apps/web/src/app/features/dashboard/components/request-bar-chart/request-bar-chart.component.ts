import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RequestChartDataPoint {
  id: string;
  code: string;
  title: string;
  department: string;
  deptCode: string;
  value: number;
  requester: string;
  date: string;
}

interface SvgBar {
  item: RequestChartDataPoint;
  x: number;
  y: number;
  width: number;
  height: number;
  isAboveAverage: boolean;
  color: string;
  diffFromAverage: number;
}

interface YTick {
  value: number;
  label: string;
  y: number;
}

@Component({
  selector: 'app-request-bar-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './request-bar-chart.component.html',
  styleUrl: './request-bar-chart.component.scss',
})
export class RequestBarChartComponent {
  // Entradas configuráveis
  readonly title = input<string>('Distribuição de Valores por Solicitação');
  readonly subtitle = input<string>(
    'Comparativo de requisições frente ao teto de alçada e à média aceita de aprovação direta'
  );
  readonly acceptedAverage = input<number>(45000);
  readonly data = input<RequestChartDataPoint[]>([
    {
      id: 'req-1',
      code: 'REQ-001',
      title: 'Licenciamento Microsoft 365',
      department: 'Tecnologia da Informação',
      deptCode: 'TI',
      value: 38500,
      requester: 'Lucas Silveira',
      date: '28/10',
    },
    {
      id: 'req-2',
      code: 'REQ-002',
      title: 'Renovação AWS Cloud',
      department: 'Infraestrutura',
      deptCode: 'INFRA',
      value: 68000,
      requester: 'Mariana Costa',
      date: '29/10',
    },
    {
      id: 'req-3',
      code: 'REQ-003',
      title: 'Monitores Dell 27 4K',
      department: 'Compras & Suprimentos',
      deptCode: 'SUP',
      value: 22400,
      requester: 'Rafael Ramos',
      date: '29/10',
    },
    {
      id: 'req-4',
      code: 'REQ-004',
      title: 'Campanha de Marketing Q4',
      department: 'Marketing & Growth',
      deptCode: 'MKT',
      value: 84000,
      requester: 'Beatriz Almeida',
      date: '30/10',
    },
    {
      id: 'req-5',
      code: 'REQ-005',
      title: 'Consultoria Tributária Big 4',
      department: 'Controladoria & Fiscal',
      deptCode: 'CTRL',
      value: 41200,
      requester: 'Carlos Eduardo',
      date: '30/10',
    },
    {
      id: 'req-6',
      code: 'REQ-006',
      title: 'Licenças Figma Enterprise',
      department: 'Design & Produto',
      deptCode: 'UX',
      value: 15600,
      requester: 'Camila Lima',
      date: '31/10',
    },
    {
      id: 'req-7',
      code: 'REQ-007',
      title: 'Servidores GPU On-Premise',
      department: 'Tecnologia da Informação',
      deptCode: 'TI',
      value: 94000,
      requester: 'Guilherme Santos',
      date: '31/10',
    },
    {
      id: 'req-8',
      code: 'REQ-008',
      title: 'Certificados Digitais SSL',
      department: 'Segurança da Informação',
      deptCode: 'SEC',
      value: 18900,
      requester: 'Ana Clara Torres',
      date: '31/10',
    },
  ]);

  // Filtro de Categoria/Escalação
  readonly activeFilter = signal<'TODOS' | 'DENTRO' | 'ACIMA'>('TODOS');

  // Estado de Hover do Tooltip
  readonly hoveredBar = signal<SvgBar | null>(null);

  // Constantes de Dimensão do SVG
  readonly svgWidth = 760;
  readonly svgHeight = 240;
  readonly marginLeft = 60;
  readonly marginRight = 25;
  readonly marginTop = 30;
  readonly marginBottom = 45;

  readonly chartWidth = this.svgWidth - this.marginLeft - this.marginRight;
  readonly chartHeight = this.svgHeight - this.marginTop - this.marginBottom;

  // Filtragem de Itens
  readonly displayedItems = computed(() => {
    const list = this.data();
    const filter = this.activeFilter();
    const avg = this.acceptedAverage();

    if (filter === 'DENTRO') {
      return list.filter((item) => item.value <= avg);
    }
    if (filter === 'ACIMA') {
      return list.filter((item) => item.value > avg);
    }
    return list;
  });

  // Escala Máxima do Eixo Y (arredondada para múltiplas dezenas de milhares)
  readonly maxY = computed(() => {
    const items = this.data();
    const avg = this.acceptedAverage();
    const maxVal = Math.max(...items.map((i) => i.value), avg, 50000);
    const step = 25000;
    return Math.ceil((maxVal * 1.1) / step) * step;
  });

  // Ticks do Eixo Y
  readonly yTicks = computed<YTick[]>(() => {
    const max = this.maxY();
    const steps = 4;
    const ticks: YTick[] = [];

    for (let i = 0; i <= steps; i++) {
      const val = (max / steps) * i;
      const y = this.marginTop + this.chartHeight * (1 - i / steps);
      ticks.push({
        value: val,
        label: val === 0 ? 'R$ 0' : `R$ ${Math.round(val / 1000)}k`,
        y,
      });
    }
    return ticks;
  });

  // Posição Y da Linha da Média Aceita
  readonly averageY = computed<number>(() => {
    const avg = this.acceptedAverage();
    const max = this.maxY();
    const ratio = Math.min(1, Math.max(0, avg / max));
    return this.marginTop + this.chartHeight * (1 - ratio);
  });

  // Geometria das Barras SVG
  readonly svgBars = computed<SvgBar[]>(() => {
    const items = this.displayedItems();
    if (items.length === 0) return [];

    const slotWidth = this.chartWidth / items.length;
    const barWidth = Math.min(38, Math.max(18, slotWidth * 0.55));
    const max = this.maxY();
    const avg = this.acceptedAverage();

    return items.map((item, index) => {
      const x = this.marginLeft + index * slotWidth + (slotWidth - barWidth) / 2;
      const height = Math.max(4, (item.value / max) * this.chartHeight);
      const y = this.marginTop + this.chartHeight - height;
      const isAbove = item.value > avg;
      const diff = item.value - avg;

      return {
        item,
        x,
        y,
        width: barWidth,
        height,
        isAboveAverage: isAbove,
        color: isAbove ? '#f59e0b' : '#644EF3',
        diffFromAverage: diff,
      };
    });
  });

  // Estatísticas Rápidas do Conjunto
  readonly stats = computed(() => {
    const items = this.data();
    const avg = this.acceptedAverage();
    const total = items.reduce((acc, curr) => acc + curr.value, 0);
    const inside = items.filter((i) => i.value <= avg).length;
    const above = items.filter((i) => i.value > avg).length;
    const conformityPct = items.length > 0 ? Math.round((inside / items.length) * 100) : 100;
    const maxValue = items.length > 0 ? Math.max(...items.map((i) => i.value)) : 0;

    return {
      total,
      insideCount: inside,
      aboveCount: above,
      conformityPct,
      maxValue,
      totalCount: items.length,
    };
  });

  setFilter(filter: 'TODOS' | 'DENTRO' | 'ACIMA'): void {
    this.activeFilter.set(filter);
    this.hoveredBar.set(null);
  }

  onBarHover(bar: SvgBar): void {
    this.hoveredBar.set(bar);
  }

  onBarLeave(): void {
    this.hoveredBar.set(null);
  }
}
