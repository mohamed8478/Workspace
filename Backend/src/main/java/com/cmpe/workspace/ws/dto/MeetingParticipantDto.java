package com.cmpe.workspace.ws.dto;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MeetingParticipantDto {
    private Long id;
    private String name;
}
