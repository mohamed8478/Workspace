package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Meeting;
import com.cmpe.workspace.entity.Transcript;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.repository.MeetingRepository;
import com.cmpe.workspace.repository.TranscriptRepository;
import com.cmpe.workspace.ws.dto.responce.MeetingReportResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MeetingReportService {

    private static final Logger log = LoggerFactory.getLogger(MeetingReportService.class);

    private final MeetingRepository meetingRepository;
    private final TranscriptRepository transcriptRepository;
    private final MeetingReportAiService meetingReportAiService;
    private final MeetingReportEmailService meetingReportEmailService;

    @Async
    @Transactional
    public void sendReportAfterMeeting(Long meetingId) {
        Meeting meeting = meetingRepository.findByIdWithParticipants(meetingId)
                .orElse(null);

        if (meeting == null) {
            log.warn("Meeting report skipped because meeting {} was not found", meetingId);
            return;
        }

        if (meeting.isReportSent()) {
            log.info("Meeting report already sent for meeting {}", meetingId);
            return;
        }

        List<User> participants = meeting.getParticipants() == null
                ? List.of()
                : meeting.getParticipants().stream()
                        .map(participant -> participant.getUser())
                        .filter(user -> user != null)
                        .toList();

        if (participants.isEmpty()) {
            markReportFailure(meeting, "No participants found for meeting report");
            return;
        }

        try {
            List<Transcript> transcripts = loadTranscripts(meeting);
            MeetingReportResponse report = meetingReportAiService.buildReport(meeting, transcripts, participants);
            boolean sent = meetingReportEmailService.sendMeetingReport(meeting, participants, report);

            if (!sent) {
                markReportFailure(meeting, "Report email could not be sent. Check SMTP configuration and participant emails.");
                return;
            }

            meeting.setReportSent(true);
            meeting.setReportSentAt(LocalDateTime.now());
            meeting.setReportSendError(null);
            meetingRepository.save(meeting);
        } catch (Exception e) {
            log.error("Meeting report failed unexpectedly for meeting {}", meetingId, e);
            markReportFailure(meeting, "Unexpected report error: " + safeErrorMessage(e));
        }
    }

    private List<Transcript> loadTranscripts(Meeting meeting) {
        String roomName = meeting.getLivekitRoomName();
        if (roomName == null || roomName.isBlank()) {
            return List.of();
        }

        return transcriptRepository.findByRoomNameOrderBySpeechStartedAtAsc(roomName);
    }

    private void markReportFailure(Meeting meeting, String errorMessage) {
        log.warn("Meeting report failed for meeting {}: {}", meeting.getId(), errorMessage);
        meeting.setReportSendError(errorMessage);
        meetingRepository.save(meeting);
    }

    private String safeErrorMessage(Exception e) {
        return e.getMessage() == null || e.getMessage().isBlank()
                ? e.getClass().getSimpleName()
                : e.getMessage();
    }
}
