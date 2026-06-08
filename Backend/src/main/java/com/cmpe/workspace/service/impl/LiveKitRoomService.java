package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Meeting;
import io.livekit.server.RoomServiceClient;
import livekit.LivekitModels;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
public class LiveKitRoomService {

    @Value("${app.livekit.api.key}")
    private String LIVEKIT_API_KEY;

    @Value("${app.livekit.api.secret}")
    private String LIVEKIT_API_SECRET;

    @Value("${app.livekit.api.url}")
    private String LIVEKIT_SERVER_URL;

    private RoomServiceClient client() {
        return RoomServiceClient.create(
                LIVEKIT_SERVER_URL,
                LIVEKIT_API_KEY,
                LIVEKIT_API_SECRET
        );
    }

    public String createRoom(Meeting meeting) {
        String roomName = "meeting-" + meeting.getId() + "-" +
                meeting.getTitle()
                        .toLowerCase()
                        .replaceAll("[^a-z0-9]", "-");

        try {
            client().createRoom(roomName).execute();

        } catch (Exception e) {
            throw new RuntimeException("Failed to create LiveKit room: " + e.getMessage(), e);
        }

        return roomName;
    }

    public List<LivekitModels.ParticipantInfo> listParticipants(String roomName) {
        try {
            return client().listParticipants(roomName).execute().body();
        } catch (Exception e) {
            throw new RuntimeException("Failed to list LiveKit participants: " + e.getMessage(), e);
        }
    }

    public int getParticipantCount(String roomName) {
        return getVisibleParticipantCount(roomName);
    }

    public int getVisibleParticipantCount(String roomName) {
        List<LivekitModels.ParticipantInfo> participants = listParticipants(roomName);
        return participants == null
                ? 0
                : (int) participants.stream()
                        .filter(this::isVisibleParticipant)
                        .count();
    }

    public boolean isVisibleParticipant(LivekitModels.ParticipantInfo participant) {
        if (participant == null) {
            return false;
        }

        if (isLiveKitAgent(participant)) {
            return false;
        }

        return !looksLikeHiddenAgent(participant.getIdentity())
                && !looksLikeHiddenAgent(participant.getName())
                && !looksLikeHiddenAgent(participant.getMetadata());
    }

    private boolean isLiveKitAgent(LivekitModels.ParticipantInfo participant) {
        try {
            return "AGENT".equalsIgnoreCase(participant.getKind().name());
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean looksLikeHiddenAgent(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }

        String normalized = value.trim().toLowerCase(Locale.ROOT);

        return normalized.equals("stt")
                || normalized.equals("agent")
                || normalized.equals("assistant")
                || normalized.equals("stt-agent")
                || normalized.equals("ai-agent")
                || normalized.equals("ai_assistant")
                || normalized.equals("ai-assistant")
                || normalized.equals("meeting-agent")
                || normalized.equals("transcript-agent")
                || normalized.equals("backend-dispatcher")
                || normalized.startsWith("agent-")
                || normalized.startsWith("agent_")
                || normalized.startsWith("assistant-")
                || normalized.startsWith("assistant_")
                || normalized.startsWith("ai-agent-")
                || normalized.startsWith("ai_agent_")
                || normalized.contains("\"role\":\"agent\"")
                || normalized.contains("\"role\": \"agent\"")
                || normalized.contains("\"hidden\":true")
                || normalized.contains("\"hidden\": true")
                || normalized.contains("workspace-hidden-agent");
    }

    public void deleteRoom(String roomName) {
        try {
            client().deleteRoom(roomName).execute();
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete LiveKit room: " + e.getMessage(), e);
        }
    }
}
