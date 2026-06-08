package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.entity.Meeting;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.service.impl.MeetingReportService;
import com.cmpe.workspace.service.impl.MeetingService;
import com.cmpe.workspace.ws.dto.request.MeetingRequest;
import com.cmpe.workspace.ws.dto.responce.MeetingActiveParticipantsResponse;
import com.cmpe.workspace.ws.dto.responce.MeetingResponse;
import com.cmpe.workspace.ws.dto.responce.TokenResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/meeting")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;
    private final MeetingReportService meetingReportService;

    @PostMapping
    public ResponseEntity<Void> create(@RequestBody MeetingRequest request) {
        meetingService.save(request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping
    public ResponseEntity<List<MeetingResponse>> getMeetings(){
        return ResponseEntity.ok(meetingService.getMeetings());
    }



    /** For the "Upcoming Schedule" section */
    @GetMapping("/upcoming")
    public List<MeetingResponse> getUpcoming() {
        return meetingService.getUpcomingMeetings();
    }

    /** For the "Live Now" section — filtered by current user */
    @GetMapping("/active")
    public List<MeetingResponse> getActiveMeetings(
            @AuthenticationPrincipal User userDetails) {
        Long userId = ((User) userDetails).getId();
        return meetingService.getActiveMeetingsForUser(userId);
    }

    /** Get token to join — only works for invited users */
    @GetMapping("/{id}/token")
    public TokenResponse getToken(
            @PathVariable Long id,
            @AuthenticationPrincipal User userDetails) {
        return meetingService.generateToken(id, userDetails.getId(), userDetails.getUsername());
    }

    /** Get active participants from LiveKit server state */
    @GetMapping("/{id}/active-participants")
    public MeetingActiveParticipantsResponse getActiveParticipants(
            @PathVariable Long id,
            @AuthenticationPrincipal User userDetails) {
        return meetingService.getActiveParticipants(id, userDetails.getId());
    }

    @PostMapping("/{id}/report/send")
    public ResponseEntity<Void> sendMeetingReport(@PathVariable Long id) {
        meetingReportService.sendReportAfterMeeting(id);
        return ResponseEntity.accepted().build();
    }
}
