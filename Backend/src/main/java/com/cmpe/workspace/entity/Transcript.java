package com.cmpe.workspace.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
public class Transcript {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_name", nullable = false, length = 255)
    private String roomName;

    @Column(name = "participant_identity", nullable = false, length = 255)
    private String participantIdentity;

    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(name = "speech_started_at", nullable = false)
    private Instant speechStartedAt;

    @Column(name = "speech_ended_at", nullable = false)
    private Instant speechEndedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
