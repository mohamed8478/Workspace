package com.cmpe.workspace.ws.dto.responce;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportInfoResponse {
    private String id;
    private String label;
    private String filename;
    private Boolean available;
    private Long sizeBytes;
    private String lastModified;
    private String downloadUrl;
}
