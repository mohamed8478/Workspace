package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.entity.Transcript;
import com.cmpe.workspace.service.impl.TranscriptService;
import com.cmpe.workspace.ws.dto.request.TranscriptIngestRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transcripts")
@RequiredArgsConstructor
public class TranscriptController {
    private final TranscriptService service;


    @PostMapping("/ingest")
    public ResponseEntity<Transcript> ingest(@RequestBody TranscriptIngestRequest request) {
        Transcript saved = service.save(request);
        return ResponseEntity.ok(saved);
    }

}
