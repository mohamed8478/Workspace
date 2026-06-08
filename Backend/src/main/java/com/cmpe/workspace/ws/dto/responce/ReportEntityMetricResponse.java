package com.cmpe.workspace.ws.dto.responce;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportEntityMetricResponse {
    private String name;
    private long salesCount;
    private double totalWeight;
}
