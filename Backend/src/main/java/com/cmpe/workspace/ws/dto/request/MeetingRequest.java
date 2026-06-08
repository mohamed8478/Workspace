package com.cmpe.workspace.ws.dto.request;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MeetingRequest {
    private String title;
    private LocalDateTime startTime;
    private String description;
    private List<Long> participantsId;
}
