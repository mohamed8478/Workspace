package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.service.impl.ReportProxyService;
import com.cmpe.workspace.ws.dto.responce.ReportAnalyticsResponse;
import com.cmpe.workspace.ws.dto.responce.ReportInfoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {
    private final ReportProxyService reportProxyService;

    @GetMapping
    public List<ReportInfoResponse> getReports() {
        return reportProxyService.getReports();
    }

    @GetMapping("/{reportId}/analytics")
    public ReportAnalyticsResponse getAnalytics(@PathVariable String reportId) {
        return reportProxyService.getAnalytics(reportId);
    }

    @GetMapping("/{reportId}/download")
    public ResponseEntity<byte[]> downloadReport(@PathVariable String reportId) {
        ReportProxyService.DownloadedReport report = reportProxyService.downloadReport(reportId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(report.filename())
                        .build()
                        .toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(report.content());
    }
}
