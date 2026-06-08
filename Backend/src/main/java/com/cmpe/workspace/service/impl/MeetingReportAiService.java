package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Meeting;
import com.cmpe.workspace.entity.Transcript;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.ws.dto.responce.MeetingReportResponse;
import com.cmpe.workspace.ws.dto.responce.ParticipantMeetingSummary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MeetingReportAiService {

    private static final Logger log = LoggerFactory.getLogger(MeetingReportAiService.class);
    private static final int MAX_MEETING_TRANSCRIPT_CHARS = 8_000;
    private static final int MAX_PARTICIPANT_TRANSCRIPT_CHARS = 3_000;

    private final ChatClient chatClient;

    public MeetingReportAiService(ChatModel chatModel) {
        this.chatClient = ChatClient.create(chatModel);
    }

    public MeetingReportResponse buildReport(
            Meeting meeting,
            List<Transcript> transcripts,
            List<User> participants
    ) {
        List<Transcript> safeTranscripts = transcripts == null ? List.of() : transcripts;
        List<User> safeParticipants = participants == null ? List.of() : participants;

        if (safeTranscripts.isEmpty()) {
            return emptyReport(safeParticipants);
        }

        String meetingSummary = generateMeetingSummary(meeting, safeTranscripts);
        List<ParticipantMeetingSummary> participantSummaries = safeParticipants.stream()
                .map(participant -> generateParticipantSummary(participant, safeTranscripts))
                .toList();

        return new MeetingReportResponse(meetingSummary, participantSummaries);
    }

    private MeetingReportResponse emptyReport(List<User> participants) {
        List<ParticipantMeetingSummary> participantSummaries = participants.stream()
                .map(participant -> new ParticipantMeetingSummary(
                        participant.getId(),
                        displayName(participant),
                        participant.getEmail(),
                        "- No speech was captured for this participant."
                ))
                .toList();

        return new MeetingReportResponse(
                """
                Meeting overview
                - No transcript was captured for this meeting.

                Decisions
                - No information found in the transcript.

                Action items
                - No information found in the transcript.

                Open questions
                - No information found in the transcript.
                """.trim(),
                participantSummaries
        );
    }

    private String generateMeetingSummary(Meeting meeting, List<Transcript> transcripts) {
        String prompt = """
                You are Workspace's meeting notes assistant.

                Create a concise, professional meeting recap email inspired by modern video meeting notes.

                Rules:
                - Use only the transcript facts.
                - Do not invent decisions, dates, owners, or action items.
                - Do not mention AI, prompts, or transcript analysis.
                - Use clear English unless the transcript is mostly French, Arabic, or Moroccan Darija.
                - Keep it readable and useful for busy participants.
                - Output plain text only.

                Return exactly these sections:

                Meeting overview
                - ...

                Key discussion points
                - ...

                Decisions
                - ...

                Action items
                - Owner: action, if the owner is explicit.

                Open questions
                - ...

                If a section has no transcript information, write:
                - No information found in the transcript.

                Meeting title: %s

                Transcript:
                %s
                """.formatted(
                safeText(meeting.getTitle()),
                limitText(formatTranscript(transcripts), MAX_MEETING_TRANSCRIPT_CHARS)
        );

        return askAi(prompt, fallbackMeetingSummary());
    }

    private ParticipantMeetingSummary generateParticipantSummary(User participant, List<Transcript> transcripts) {
        List<Transcript> participantTranscripts = filterTranscriptsForParticipant(participant, transcripts);

        if (participantTranscripts.isEmpty()) {
            return new ParticipantMeetingSummary(
                    participant.getId(),
                    displayName(participant),
                    participant.getEmail(),
                    "- No speech was captured for this participant."
            );
        }

        String prompt = """
                You are preparing the personalized contribution section of a meeting recap email.

                Summarize what this participant said, proposed, decided, asked, or committed to.

                Rules:
                - Use only this participant's transcript lines.
                - Write in second person using "You".
                - Keep it to 3 to 6 bullet points.
                - Include action items only if the participant clearly committed to them.
                - Do not invent missing details.
                - Output bullet points only.

                Participant: %s

                Participant transcript:
                %s
                """.formatted(
                displayName(participant),
                limitText(formatTranscript(participantTranscripts), MAX_PARTICIPANT_TRANSCRIPT_CHARS)
        );

        return new ParticipantMeetingSummary(
                participant.getId(),
                displayName(participant),
                participant.getEmail(),
                askAi(prompt, "- You participated in the meeting, but your contribution summary could not be generated.")
        );
    }

    private String askAi(String prompt, String fallback) {
        try {
            String content = chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();

            if (content == null || content.isBlank()) {
                return fallback;
            }

            return content.trim();
        } catch (Exception e) {
            log.warn("Could not generate AI meeting report content: {}", e.getMessage());
            return fallback;
        }
    }

    private List<Transcript> filterTranscriptsForParticipant(User participant, List<Transcript> transcripts) {
        Set<String> candidateIdentities = participantIdentityCandidates(participant);

        return transcripts.stream()
                .filter(transcript -> candidateIdentities.contains(normalize(transcript.getParticipantIdentity())))
                .toList();
    }

    private Set<String> participantIdentityCandidates(User participant) {
        List<String> candidates = new ArrayList<>();
        candidates.add(participant.getEmail());
        candidates.add(participant.getUsername());
        candidates.add(participant.getFullName());

        String email = participant.getEmail();
        if (email != null && email.contains("@")) {
            candidates.add(email.substring(0, email.indexOf('@')));
        }

        return candidates.stream()
                .map(this::normalize)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
    }

    private String formatTranscript(List<Transcript> transcripts) {
        return transcripts.stream()
                .map(transcript -> "%s: %s".formatted(
                        safeText(transcript.getParticipantIdentity()),
                        safeText(transcript.getText())
                ))
                .collect(Collectors.joining("\n"));
    }

    private String limitText(String text, int maxChars) {
        if (text == null || text.length() <= maxChars) {
            return text == null ? "" : text;
        }

        return text.substring(0, maxChars) + "\n[Transcript truncated for length]";
    }

    private String fallbackMeetingSummary() {
        return """
                Meeting overview
                - The meeting transcript was captured, but the automatic summary could not be generated.

                Key discussion points
                - Review the transcript for details.

                Decisions
                - No information found in the transcript.

                Action items
                - No information found in the transcript.

                Open questions
                - No information found in the transcript.
                """.trim();
    }

    private String displayName(User user) {
        String fullName = user.getFullName();
        if (fullName != null && !fullName.isBlank()) {
            return fullName.trim();
        }

        String email = user.getEmail();
        if (email != null && !email.isBlank()) {
            return email.trim();
        }

        return "Participant";
    }

    private String safeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toLowerCase(Locale.ROOT);
    }
}
