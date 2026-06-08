package com.cmpe.workspace.entity;

import com.cmpe.workspace.enums.MeetingStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
public class Meeting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private LocalDateTime startTime;
    private String description;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeetingStatus status = MeetingStatus.SCHEDULED;

    private String livekitRoomName; // null until room is created
    private LocalDateTime activatedAt;
    private LocalDateTime endedAt;
    private LocalDateTime lastParticipantSeenAt;

    @Column(nullable = false)
    private boolean hasEverJoined = false;

    @Column(nullable = false)
    private boolean reportSent = false;

    private LocalDateTime reportSentAt;

    @Column(columnDefinition = "TEXT")
    private String reportSendError;

    @OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MeetingParticipant> participants;

}
