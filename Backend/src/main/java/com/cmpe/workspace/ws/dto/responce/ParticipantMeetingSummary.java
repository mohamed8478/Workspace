package com.cmpe.workspace.ws.dto.responce;

public record ParticipantMeetingSummary(
        Long userId,
        String name,
        String email,
        String summary
) {
}
