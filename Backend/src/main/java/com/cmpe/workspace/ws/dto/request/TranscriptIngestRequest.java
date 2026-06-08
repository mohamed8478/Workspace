package com.cmpe.workspace.ws.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.jetbrains.annotations.NotNull;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TranscriptIngestRequest {

    @NotBlank
    private String roomName;

    @NotBlank
    private String participantIdentity;

    @NotBlank
    private String text;

    @NotNull
    private Instant speechStartedAt;

    @NotNull
    private Instant speechEndedAt;
}
