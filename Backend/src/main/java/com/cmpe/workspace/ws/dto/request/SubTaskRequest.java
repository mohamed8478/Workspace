package com.cmpe.workspace.ws.dto.request;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SubTaskRequest {
    private String title;
    private Boolean completed;
}
