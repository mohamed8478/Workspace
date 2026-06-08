import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type ReportKind = 'client' | 'camion';

export interface ReportItem {
  readonly id: string;
  readonly name: string;
  readonly type: ReportKind | 'excel';
  readonly label: string;
  readonly description: string;
  readonly filename?: string;
  readonly available?: boolean;
  readonly sizeBytes?: number | null;
  readonly lastModified?: string | null;
}

interface HealthResponse {
  readonly status?: string;
  readonly message?: string;
}

export interface ReportProductMetric {
  readonly name: string;
  readonly salesCount: number;
  readonly quantity: number;
  readonly totalWeight: number;
  readonly averageWaitingMinutes: number;
  readonly averageLoadingMinutes: number;
}

export interface ReportEntityMetric {
  readonly name: string;
  readonly salesCount: number;
  readonly totalWeight: number;
}

export interface ReportAnalytics {
  readonly reportId: ReportKind;
  readonly title: string;
  readonly totalRows: number;
  readonly totalClients: number;
  readonly totalProducts: number;
  readonly totalTrucks: number;
  readonly totalQuantity: number;
  readonly totalWeight: number;
  readonly productBreakdown: ReportProductMetric[];
  readonly topClients: ReportEntityMetric[];
}

@Injectable({
  providedIn: 'root',
})
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/reports`;

  getReports(): Observable<ReportItem[]> {
    return this.http
      .get<unknown>(this.api)
      .pipe(map((response) => this.normalizeReports(response)));
  }

  checkHealth(): Observable<HealthResponse> {
    return this.http.get<ReportItem[]>(this.api).pipe(map(() => ({ status: 'ok' })));
  }

  downloadReport(type: ReportKind): Observable<Blob> {
    return this.http.get(`${this.api}/${type}/download`, {
      responseType: 'blob',
    });
  }

  getAnalytics(type: ReportKind): Observable<ReportAnalytics> {
    return this.http
      .get<unknown>(`${this.api}/${type}/analytics`)
      .pipe(map((response) => this.normalizeAnalytics(response, type)));
  }

  private normalizeReports(response: unknown): ReportItem[] {
    const rawReports = Array.isArray(response)
      ? response
      : this.isRecord(response) && Array.isArray(response['reports'])
        ? response['reports']
        : [];

    return rawReports.map((report, index) => this.normalizeReport(report, index));
  }

  private normalizeReport(report: unknown, index: number): ReportItem {
    const fallbackName = `Report ${index + 1}`;

    if (typeof report === 'string') {
      return this.buildReportItem(report, report, index);
    }

    if (this.isRecord(report)) {
      const name = String(report['name'] ?? report['filename'] ?? report['title'] ?? fallbackName);
      const typeValue = String(report['id'] ?? report['type'] ?? report['kind'] ?? name).toLowerCase();

      return {
        ...this.buildReportItem(name, typeValue, index),
        id: String(report['id'] ?? this.buildReportItem(name, typeValue, index).id),
        label: String(report['label'] ?? this.buildReportItem(name, typeValue, index).label),
        filename: String(report['filename'] ?? name),
        available: Boolean(report['available'] ?? true),
        sizeBytes: typeof report['sizeBytes'] === 'number' ? report['sizeBytes'] : null,
        lastModified: report['lastModified'] ? String(report['lastModified']) : null,
      };
    }

    return this.buildReportItem(fallbackName, fallbackName, index);
  }

  private buildReportItem(name: string, typeValue: string, index: number): ReportItem {
    const normalized = typeValue.toLowerCase();
    const type: ReportItem['type'] = normalized.includes('camion')
      ? 'camion'
      : normalized.includes('client')
        ? 'client'
        : 'excel';

    const label = type === 'camion' ? 'Camion report' : type === 'client' ? 'Client report' : 'Excel report';

    return {
      id: `${type}-${index}-${name}`,
      name: this.humanizeName(name),
      type,
      label,
      description:
        type === 'camion'
          ? 'Fleet and camion-level export ready for operations review.'
          : type === 'client'
            ? 'Client performance export ready for account review.'
            : 'Generated Excel report from the report service.',
    };
  }

  private normalizeAnalytics(response: unknown, fallbackReportId: ReportKind): ReportAnalytics {
    const data = this.isRecord(response) ? response : {};
    const productBreakdown = Array.isArray(data['productBreakdown'])
      ? data['productBreakdown'].map((metric, index) => this.normalizeProductMetric(metric, index))
      : [];
    const topClients = Array.isArray(data['topClients'])
      ? data['topClients'].map((metric, index) => this.normalizeEntityMetric(metric, index))
      : [];

    return {
      reportId: this.normalizeReportKind(data['reportId'], fallbackReportId),
      title: String(data['title'] ?? (fallbackReportId === 'camion' ? 'Sortie Platre par Camion' : 'Sortie Platre par Client')),
      totalRows: this.toFiniteNumber(data['totalRows']),
      totalClients: this.toFiniteNumber(data['totalClients']),
      totalProducts: this.toFiniteNumber(data['totalProducts']),
      totalTrucks: this.toFiniteNumber(data['totalTrucks']),
      totalQuantity: this.toFiniteNumber(data['totalQuantity']),
      totalWeight: this.toFiniteNumber(data['totalWeight']),
      productBreakdown,
      topClients,
    };
  }

  private normalizeProductMetric(metric: unknown, index: number): ReportProductMetric {
    const data = this.isRecord(metric) ? metric : {};

    return {
      name: String(data['name'] ?? `Product ${index + 1}`),
      salesCount: this.toFiniteNumber(data['salesCount']),
      quantity: this.toFiniteNumber(data['quantity']),
      totalWeight: this.toFiniteNumber(data['totalWeight']),
      averageWaitingMinutes: this.toFiniteNumber(data['averageWaitingMinutes']),
      averageLoadingMinutes: this.toFiniteNumber(data['averageLoadingMinutes']),
    };
  }

  private normalizeEntityMetric(metric: unknown, index: number): ReportEntityMetric {
    const data = this.isRecord(metric) ? metric : {};

    return {
      name: String(data['name'] ?? `Client ${index + 1}`),
      salesCount: this.toFiniteNumber(data['salesCount']),
      totalWeight: this.toFiniteNumber(data['totalWeight']),
    };
  }

  private normalizeReportKind(value: unknown, fallback: ReportKind): ReportKind {
    const normalized = String(value ?? fallback).toLowerCase();

    return normalized === 'camion' ? 'camion' : normalized === 'client' ? 'client' : fallback;
  }

  private humanizeName(name: string): string {
    return name
      .replace(/\.(xlsx|xls|csv)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private toFiniteNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim().replace(',', '.'));

      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
