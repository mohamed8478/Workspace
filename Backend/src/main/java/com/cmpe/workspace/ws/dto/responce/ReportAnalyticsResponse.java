package com.cmpe.workspace.ws.dto.responce;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportAnalyticsResponse {
    private String reportId;
    private String title;
    private long totalRows;
    private long totalClients;
    private long totalProducts;
    private long totalTrucks;
    private double totalQuantity;
    private double totalWeight;
    private List<ReportProductMetricResponse> productBreakdown;
    private List<ReportEntityMetricResponse> topClients;
}
