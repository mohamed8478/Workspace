package com.cmpe.workspace.ws.dto.responce;

import com.cmpe.workspace.enums.MeetingStatus;
import com.cmpe.workspace.ws.dto.MeetingParticipantDto;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MeetingResponse {
    private Long id;
    private String title;
    private LocalDateTime startTime;
    private String description;
    private MeetingStatus status;
    private String livekitRoomName;
    private List<MeetingParticipantDto> participants;
}
