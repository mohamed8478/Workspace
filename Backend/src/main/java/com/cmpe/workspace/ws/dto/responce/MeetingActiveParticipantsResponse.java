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
public class MeetingActiveParticipantsResponse {
    private Long meetingId;
    private String roomName;
    private int activeCount;
    private List<ActiveParticipantResponse> participants;
}
