package com.cmpe.workspace.ws.dto.responce;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SubTaskResponse {
    private Long id;
    private String title;
    private boolean completed;
    private int position;
}
