import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  ReportAnalytics,
  ReportItem,
  ReportKind,
  ReportProductMetric,
  ReportsApiService,
} from '../../services/reports-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

interface QuickReport {
  readonly type: ReportKind;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly accent: 'blue' | 'green';
}

@Component({
  selector: 'app-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.css',
})
export class ReportsPageComponent implements OnInit {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly notificationService = inject(NotificationService);

  readonly reports = signal<ReportItem[]>([]);
  readonly analytics = signal<ReportAnalytics | null>(null);
  readonly selectedReport = signal<ReportKind>('client');
  readonly loading = signal(true);
  readonly analyticsLoading = signal(true);
  readonly downloading = signal<ReportKind | null>(null);
  readonly health = signal<'online' | 'offline' | 'checking'>('checking');
  readonly searchQuery = signal('');

  readonly quickReports: QuickReport[] = [
    {
      type: 'client',
      title: 'Client Excel Report',
      eyebrow: 'Account intelligence',
      description: 'Download the ready-made client report for revenue, performance, and account review.',
      accent: 'blue',
    },
    {
      type: 'camion',
      title: 'Camion Excel Report',
      eyebrow: 'Fleet operations',
      description: 'Export the camion report for transport, utilization, and operational tracking.',
      accent: 'green',
    },
  ];

  readonly filteredReports = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    if (!query) {
      return this.reports();
    }

    return this.reports().filter((report) =>
      `${report.name} ${report.label} ${report.description}`.toLowerCase().includes(query)
    );
  });

  readonly totalReports = computed(() => this.reports().length);
  readonly selectedQuickReport = computed(() =>
    this.quickReports.find((report) => report.type === this.selectedReport()) ?? this.quickReports[0]
  );
  readonly productBreakdown = computed(() => this.analytics()?.productBreakdown ?? []);
  readonly maxProductQuantity = computed(() =>
    Math.max(...this.productBreakdown().map((product) => this.toSafeNumber(product.quantity)), 1)
  );
  readonly maxCamionAverage = computed(() =>
    Math.max(
      ...this.productBreakdown().flatMap((product) => [
        this.toSafeNumber(product.averageWaitingMinutes),
        this.toSafeNumber(product.averageLoadingMinutes),
      ]),
      1
    )
  );
  readonly topClients = computed(() => this.analytics()?.topClients ?? []);
  readonly totalRows = computed(() => this.analytics()?.totalRows ?? 0);
  readonly totalClients = computed(() => this.analytics()?.totalClients ?? 0);
  readonly totalProducts = computed(() => this.analytics()?.totalProducts ?? 0);
  readonly totalTrucks = computed(() => this.analytics()?.totalTrucks ?? 0);
  readonly totalQuantity = computed(() => this.analytics()?.totalQuantity ?? 0);
  readonly totalWeight = computed(() => this.analytics()?.totalWeight ?? 0);

  ngOnInit(): void {
    this.loadReports();
    this.checkHealth();
    this.loadAnalytics(this.selectedReport());
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  refresh(): void {
    this.loadReports();
    this.checkHealth();
    this.loadAnalytics(this.selectedReport());
  }

  selectReport(type: ReportKind): void {
    if (this.selectedReport() === type) {
      return;
    }

    this.selectedReport.set(type);
    this.loadAnalytics(type);
  }

  download(type: ReportKind): void {
    this.downloading.set(type);
    this.reportsApi.downloadReport(type).subscribe({
      next: (blob) => {
        this.saveBlob(blob, `${type}-report.xlsx`);
        this.notificationService.success(`${this.capitalize(type)} report downloaded`);
        this.downloading.set(null);
      },
      error: () => {
        this.notificationService.error(`Could not download ${type} report`);
        this.downloading.set(null);
      },
    });
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(this.toSafeNumber(value));
  }

  formatWeight(value: number): string {
    return `${this.formatNumber(value / 1000)} T`;
  }

  formatMinutes(value: number): string {
    return `${this.formatNumber(value)} min`;
  }

  quantityProgressWidth(product: ReportProductMetric): string {
    return this.getProgressWidth(product.quantity, this.maxProductQuantity());
  }

  waitingProgressWidth(product: ReportProductMetric): string {
    return this.getProgressWidth(product.averageWaitingMinutes, this.maxCamionAverage());
  }

  loadingProgressWidth(product: ReportProductMetric): string {
    return this.getProgressWidth(product.averageLoadingMinutes, this.maxCamionAverage());
  }

  formatSize(sizeBytes?: number | null): string {
    if (!sizeBytes) {
      return 'Ready';
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  formatDate(date?: string | null): string {
    if (!date) {
      return 'Recently generated';
    }

    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private loadReports(): void {
    this.loading.set(true);
    this.reportsApi.getReports().subscribe({
      next: (reports) => {
        this.reports.set(reports);
        this.loading.set(false);
      },
      error: () => {
        this.reports.set([]);
        this.loading.set(false);
        this.notificationService.warning('Report list is unavailable. Downloads may still work if Flask is running.');
      },
    });
  }

  private loadAnalytics(type: ReportKind): void {
    this.analyticsLoading.set(true);
    this.reportsApi.getAnalytics(type).subscribe({
      next: (analytics) => {
        this.analytics.set(analytics);
        this.analyticsLoading.set(false);
      },
      error: () => {
        this.analytics.set(null);
        this.analyticsLoading.set(false);
        this.notificationService.error('Could not load report analytics. Make sure Flask and Spring are both running.');
      },
    });
  }

  private checkHealth(): void {
    this.health.set('checking');
    this.reportsApi.checkHealth().subscribe({
      next: () => this.health.set('online'),
      error: () => this.health.set('offline'),
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private getProgressWidth(value: number, maxValue: number): string {
    const safeValue = this.toSafeNumber(value);
    const safeMax = this.toSafeNumber(maxValue);
    const percent = safeMax <= 0 ? 0 : (safeValue / safeMax) * 100;

    return `${Math.min(100, Math.max(4, percent))}%`;
  }

  private toSafeNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}
