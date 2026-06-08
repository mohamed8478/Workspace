package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Transcript;
import com.cmpe.workspace.repository.TranscriptRepository;
import com.cmpe.workspace.ws.dto.request.TranscriptIngestRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@RequiredArgsConstructor
@Service
public class TranscriptService {
    private final TranscriptRepository repository;

    public Transcript save(TranscriptIngestRequest request) {
        Transcript transcript = new Transcript();
        transcript.setRoomName(request.getRoomName());
        transcript.setParticipantIdentity(request.getParticipantIdentity());
        transcript.setText(request.getText());
        transcript.setSpeechStartedAt(request.getSpeechStartedAt());
        transcript.setSpeechEndedAt(request.getSpeechEndedAt());
        transcript.setCreatedAt(Instant.now());
        return repository.save(transcript);
    }


}
