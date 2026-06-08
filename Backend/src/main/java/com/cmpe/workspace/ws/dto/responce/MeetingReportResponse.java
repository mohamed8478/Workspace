package com.cmpe.workspace.ws.dto.responce;

import com.cmpe.workspace.entity.User;

import java.util.List;

public record MeetingReportResponse(
        String meetingSummary,
        List<ParticipantMeetingSummary> participantSummaries
) {

    public ParticipantMeetingSummary summaryFor(User user) {
        if (user == null || participantSummaries == null) {
            return null;
        }

        return participantSummaries.stream()
                .filter(summary -> user.getId() != null && user.getId().equals(summary.userId()))
                .findFirst()
                .orElseGet(() -> participantSummaries.stream()
                        .filter(summary -> user.getEmail() != null && user.getEmail().equalsIgnoreCase(summary.email()))
                        .findFirst()
                        .orElse(null));
    }
}
