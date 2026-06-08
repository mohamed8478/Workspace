package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Meeting;
import com.cmpe.workspace.entity.MeetingParticipant;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.enums.MeetingStatus;
import com.cmpe.workspace.repository.MeetingParticipantRepository;
import com.cmpe.workspace.repository.MeetingRepository;
import com.cmpe.workspace.repository.UserRepository;
import com.cmpe.workspace.ws.dto.MeetingParticipantDto;
import com.cmpe.workspace.ws.dto.request.MeetingRequest;
import com.cmpe.workspace.ws.dto.responce.ActiveParticipantResponse;
import com.cmpe.workspace.ws.dto.responce.MeetingActiveParticipantsResponse;
import com.cmpe.workspace.ws.dto.responce.MeetingResponse;
import com.cmpe.workspace.ws.dto.responce.TokenResponse;
import io.livekit.server.AccessToken;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@RequiredArgsConstructor
@Service
public class MeetingService {
    private final MeetingRepository meetingRepository;
    private final MeetingParticipantRepository meetingParticipantRepository;
    private final UserRepository userRepository;
    private final TaskScheduler taskScheduler;
    private final LiveKitRoomService liveKitRoomService;
    private final LivekitAgentDispatchService livekitAgentDispatchService;
    private final MeetingReportService meetingReportService;
    private static final long NO_JOIN_TIMEOUT_MINUTES = 30;
    private static final long EMPTY_AFTER_JOIN_GRACE_SECONDS = 30;


    @Value("${app.livekit.api.key}")
    private String LIVEKIT_API_KEY;

    @Value("${app.livekit.api.secret}")
    private String LIVEKIT_API_SECRET;

    @Value("${app.livekit.api.url}")
    private String LIVEKIT_SERVER_URL;

    private static final Logger log = LoggerFactory.getLogger(MeetingService.class);
    private static final ZoneId APP_ZONE = ZoneId.systemDefault();

    @Transactional
    public MeetingResponse save(MeetingRequest request) {
        Meeting meeting = new Meeting();
        meeting.setStartTime(request.getStartTime());
        meeting.setTitle(request.getTitle());
        meeting.setDescription(request.getDescription());

        meeting.setStatus(MeetingStatus.SCHEDULED);
        Meeting saved = meetingRepository.save(meeting);

        List<User> users = userRepository.findAllById(request.getParticipantsId());
        if (users.size() != request.getParticipantsId().size()) {
            throw new RuntimeException("One or more users not found");
        }

        List<MeetingParticipant> participants = users.stream().map(u -> {
            MeetingParticipant mp = new MeetingParticipant();
            mp.setUser(u);
            mp.setMeeting(saved);
            return mp;
        }).collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        meetingParticipantRepository.saveAll(participants);
        saved.setParticipants(participants);

        LocalDateTime now = LocalDateTime.now(APP_ZONE);
        if (!saved.getStartTime().isAfter(now)) {
            activateMeeting(saved.getId());
        } else {
            scheduleActivation(saved.getId(), saved.getStartTime());
        }

        return toResponse(meetingRepository.findById(saved.getId()).orElse(saved));
    }

    public List<MeetingResponse> getMeetings(){
        LocalDateTime now = LocalDateTime.now(APP_ZONE).minusMinutes(1);
        return meetingRepository.findByStartTimeGreaterThanEqual(now)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void activateMeeting(Long meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId).orElseThrow();
        if (meeting.getStatus() != MeetingStatus.SCHEDULED) return;

        String roomName = liveKitRoomService.createRoom(meeting);
        meeting.setLivekitRoomName(roomName);
        meeting.setStatus(MeetingStatus.ACTIVE);
        meeting.setActivatedAt(LocalDateTime.now(APP_ZONE));
        meeting.setEndedAt(null);
        meeting.setLastParticipantSeenAt(null);
        meetingRepository.saveAndFlush(meeting);

        scheduleNoJoinTimeoutCheck(meeting.getId(), meeting.getActivatedAt());
    }

    private void safeActivate(Long meetingId) {
        try {
            activateMeeting(meetingId);
        } catch (Exception e) {
            log.error("Failed to activate meeting {}", meetingId, e);
        }
    }

    private void scheduleActivation(Long meetingId, LocalDateTime startTime) {
        Instant triggerAt = startTime.atZone(APP_ZONE).toInstant();
        Instant now = Instant.now();
        if (triggerAt.isBefore(now)) {
            triggerAt = now.plusSeconds(1);
        }
        taskScheduler.schedule(() -> safeActivate(meetingId), triggerAt);
    }

    private void scheduleNoJoinTimeoutCheck(Long meetingId, LocalDateTime activatedAt) {
        Instant triggerAt = activatedAt.plusMinutes(NO_JOIN_TIMEOUT_MINUTES).atZone(APP_ZONE).toInstant();
        taskScheduler.schedule(() -> safeCloseNoJoin(meetingId), triggerAt);
    }

    private void safeCloseNoJoin(Long meetingId) {
        try {
            closeIfNoOneJoinedInFirstWindow(meetingId);
        } catch (Exception e) {
            log.error("Failed to close meeting {} after no-join timeout", meetingId, e);
        }
    }

    @Transactional
    public void closeIfNoOneJoinedInFirstWindow(Long meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId).orElseThrow();
        if (meeting.getStatus() != MeetingStatus.ACTIVE || meeting.isHasEverJoined()) {
            return;
        }

        LocalDateTime activatedAt = meeting.getActivatedAt();
        if (activatedAt == null || activatedAt.plusMinutes(NO_JOIN_TIMEOUT_MINUTES).isAfter(LocalDateTime.now(APP_ZONE))) {
            return;
        }

        int activeCount = liveKitRoomService.getParticipantCount(meeting.getLivekitRoomName());
        if (activeCount == 0) {
            endMeeting(meeting);
        }
    }

    @Transactional
    public void closeIfEmptyAfterJoin(Long meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId).orElseThrow();
        if (meeting.getStatus() != MeetingStatus.ACTIVE || !meeting.isHasEverJoined()) {
            return;
        }

        int activeCount = liveKitRoomService.getParticipantCount(meeting.getLivekitRoomName());
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        if (activeCount > 0) {
            markParticipantSeen(meeting, now);
            return;
        }

        if (!emptyGracePeriodExpired(meeting, now)) {
            if (meeting.getLastParticipantSeenAt() == null) {
                meeting.setLastParticipantSeenAt(now);
                meetingRepository.save(meeting);
            }
            return;
        }

        if (activeCount == 0) {
            endMeeting(meeting);
        }
    }

    @Transactional
    private void endMeeting(Meeting meeting) {
        meeting.setStatus(MeetingStatus.ENDED);
        meeting.setEndedAt(LocalDateTime.now(APP_ZONE));
        meetingRepository.saveAndFlush(meeting);
        meetingReportService.sendReportAfterMeeting(meeting.getId());
        try {
            liveKitRoomService.deleteRoom(meeting.getLivekitRoomName());
        } catch (Exception e) {
            log.warn("Could not delete LiveKit room {} for meeting {}", meeting.getLivekitRoomName(), meeting.getId(), e);
        }
    }

    @Scheduled(fixedDelay = 10000)
    public void reconcileActiveMeetings() {
        List<Meeting> activeMeetings = meetingRepository.findByStatus(MeetingStatus.ACTIVE);
        LocalDateTime now = LocalDateTime.now(APP_ZONE);

        for (Meeting meeting : activeMeetings) {
            try {
                int activeCount = liveKitRoomService.getParticipantCount(meeting.getLivekitRoomName());

                if (activeCount > 0) {
                    markParticipantSeen(meeting, now);
                    continue;
                }

                if (meeting.isHasEverJoined()) {
                    closeIfEmptyAfterJoin(meeting.getId());
                    continue;
                }

                LocalDateTime activatedAt = meeting.getActivatedAt();
                if (activatedAt != null && !activatedAt.plusMinutes(NO_JOIN_TIMEOUT_MINUTES).isAfter(now)) {
                    endMeeting(meeting);
                }
            } catch (Exception e) {
                log.error("Failed reconciling meeting {}", meeting.getId(), e);
            }
        }
    }


    @PostConstruct
    public void rescheduleOnStartup() {
        LocalDateTime now = LocalDateTime.now(APP_ZONE);
        meetingRepository.findByStatus(MeetingStatus.SCHEDULED).forEach(m -> {
            if (!m.getStartTime().isAfter(now)) {
                safeActivate(m.getId());
            } else {
                scheduleActivation(m.getId(), m.getStartTime());
            }
        });

        meetingRepository.findByStatus(MeetingStatus.ACTIVE).forEach(m -> {
            if (m.getStartTime().isAfter(now)) {
                m.setStatus(MeetingStatus.SCHEDULED);
                m.setActivatedAt(null);
                m.setEndedAt(null);
                m.setLastParticipantSeenAt(null);
                m.setHasEverJoined(false);
                if (m.getLivekitRoomName() != null && !m.getLivekitRoomName().isBlank()) {
                    try {
                        liveKitRoomService.deleteRoom(m.getLivekitRoomName());
                    } catch (Exception e) {
                        log.warn("Could not delete premature LiveKit room {} for meeting {}", m.getLivekitRoomName(), m.getId(), e);
                    }
                }
                m.setLivekitRoomName(null);
                meetingRepository.save(m);
                scheduleActivation(m.getId(), m.getStartTime());
                return;
            }

            if (m.getActivatedAt() == null) {
                m.setActivatedAt(now);
                meetingRepository.save(m);
            }
            scheduleNoJoinTimeoutCheck(m.getId(), m.getActivatedAt());
        });
    }

    /** Upcoming meetings (SCHEDULED) — for the schedule list */
    public List<MeetingResponse> getUpcomingMeetings() {
        return meetingRepository
                .findByStatusOrderByStartTimeAsc(MeetingStatus.SCHEDULED)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** ✅ Fix 2: Active meetings where the current user is a participant */
    public List<MeetingResponse> getActiveMeetingsForUser(Long userId) {
        reconcileActiveMeetings();
        LocalDateTime now = LocalDateTime.now(APP_ZONE);
        return meetingRepository
                .findActiveMeetingsByParticipant(userId)
                .stream()
                .filter(meeting -> !meeting.getStartTime().isAfter(now))
                .map(this::toResponse)
                .toList();
    }

    public MeetingActiveParticipantsResponse getActiveParticipants(Long meetingId, Long userId) {
        if (!meetingParticipantRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant of this meeting");
        }

        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        if (meeting.getStatus() != MeetingStatus.ACTIVE || meeting.getLivekitRoomName() == null) {
            return MeetingActiveParticipantsResponse.builder()
                    .meetingId(meetingId)
                    .roomName(meeting.getLivekitRoomName())
                    .activeCount(0)
                    .participants(List.of())
                    .build();
        }

        List<livekit.LivekitModels.ParticipantInfo> liveParticipants = liveKitRoomService
                .listParticipants(meeting.getLivekitRoomName());
        if (liveParticipants == null) {
            liveParticipants = List.of();
        }

        List<ActiveParticipantResponse> activeParticipants = liveParticipants.stream()
                .filter(liveKitRoomService::isVisibleParticipant)
                .map(p -> ActiveParticipantResponse.builder()
                        .identity(p.getIdentity())
                        .name(p.getName())
                        .build())
                .toList();

        if (!activeParticipants.isEmpty() && !meeting.isHasEverJoined()) {
            markParticipantSeen(meeting, LocalDateTime.now(APP_ZONE));
        } else if (!activeParticipants.isEmpty()) {
            markParticipantSeen(meeting, LocalDateTime.now(APP_ZONE));
        }

        if (activeParticipants.isEmpty() && meeting.isHasEverJoined()) {
            closeIfEmptyAfterJoin(meetingId);
            meeting = meetingRepository.findById(meetingId).orElse(meeting);
        }

        return MeetingActiveParticipantsResponse.builder()
                .meetingId(meeting.getId())
                .roomName(meeting.getLivekitRoomName())
                .activeCount(activeParticipants.size())
                .participants(activeParticipants)
                .build();
    }

    private void markParticipantSeen(Meeting meeting, LocalDateTime seenAt) {
        boolean changed = false;

        if (!meeting.isHasEverJoined()) {
            meeting.setHasEverJoined(true);
            changed = true;
        }

        LocalDateTime previousSeenAt = meeting.getLastParticipantSeenAt();
        if (previousSeenAt == null || previousSeenAt.plusSeconds(5).isBefore(seenAt)) {
            meeting.setLastParticipantSeenAt(seenAt);
            changed = true;
        }

        if (changed) {
            meetingRepository.save(meeting);
        }
    }

    private boolean emptyGracePeriodExpired(Meeting meeting, LocalDateTime now) {
        LocalDateTime lastSeenAt = meeting.getLastParticipantSeenAt();
        if (lastSeenAt == null) {
            return false;
        }

        return !lastSeenAt.plusSeconds(EMPTY_AFTER_JOIN_GRACE_SECONDS).isAfter(now);
    }

    private MeetingResponse toResponse(Meeting m) {
        return MeetingResponse.builder()
                .id(m.getId())
                .title(m.getTitle())
                .startTime(m.getStartTime())
                .description(m.getDescription())
                .status(m.getStatus())
                .livekitRoomName(m.getLivekitRoomName())
                .participants(
                        m.getParticipants() == null ? List.of() :   // ← null guard
                                m.getParticipants().stream()
                                        .map(p -> MeetingParticipantDto.builder()
                                                .id(p.getUser().getId())
                                                .name(p.getUser().getFullName())
                                                .build())
                                        .toList()
                )
                .build();
    }

    public TokenResponse generateToken(Long meetingId, Long userId, String username) {
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new RuntimeException("Meeting not found"));

        if (!meetingParticipantRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant of this meeting");
        }

        if (meeting.getStatus() == MeetingStatus.SCHEDULED && !meeting.getStartTime().isAfter(LocalDateTime.now(APP_ZONE))) {
            activateMeeting(meeting.getId());
            meeting = meetingRepository.findById(meetingId).orElseThrow();
        }

        if (meeting.getStatus() != MeetingStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Meeting is not active yet");
        }

        String roomName = meeting.getLivekitRoomName();
        if (roomName == null || roomName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Meeting room is not ready");
        }

        try {
            livekitAgentDispatchService.dispatchSttAgentOnce(roomName);
        } catch (Exception e) {
            log.warn("Failed to dispatch STT agent for room {}", roomName, e);
        }

        AccessToken token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        token.setName(username);
        token.setIdentity(username);
        token.addGrants(new RoomJoin(true), new RoomName(roomName));

        return TokenResponse.builder()
                .token(token.toJwt())
                .roomName(roomName)
                .meetingId(meetingId)
                .build();
    }

}


